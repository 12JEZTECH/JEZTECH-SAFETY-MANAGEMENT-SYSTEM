import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { z } from 'zod';
import { pool, withTenantTransaction } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { writeAudit } from '../services/audit.js';
import { generateTotpSecret, verifyTotp, encryptSecret, decryptSecret } from '../services/totp.js';
const router=Router();
const loginSchema=z.object({email:z.string().email().max(180),password:z.string().min(1).max(200),mfaCode:z.string().optional()});
const registerSchema=z.object({name:z.string().min(2).max(140),email:z.string().email().max(180),department:z.string().min(1).max(120),tenantId:z.string().uuid(),requestedRole:z.enum(['user','supervisor','safety_department','auditor_officer']),password:z.string().min(14).refine(v=>Buffer.byteLength(v)<=72)});
function tokenFor(user){return jwt.sign({tenantId:user.tenant_id,ver:user.token_version||0},process.env.JWT_SECRET,{subject:user.user_id,expiresIn:process.env.JWT_EXPIRES_IN||'8h',algorithm:'HS256'});}
async function recoveryIndex(user,code){const hashes=Array.isArray(user.mfa_recovery_code_hashes)?user.mfa_recovery_code_hashes:[];for(let i=0;i<hashes.length;i++)if(await bcrypt.compare(String(code||''),hashes[i]))return i;return -1;}
router.post('/login',async(req,res,next)=>{try{
 const x=loginSchema.parse(req.body);
 const q=await pool.query("SELECT u.*,t.organization_name,t.status FROM users u JOIN tenants t USING(tenant_id) WHERE lower(u.email)=lower($1) ORDER BY u.created_at LIMIT 1",[x.email]);
 const u=q.rows[0];if(!u)return res.status(401).json({error:'Email or password is incorrect.'});
 if(u.locked_until&&new Date(u.locked_until)>new Date())return res.status(423).json({error:'Account temporarily locked. Try again later.'});
 if(!(await bcrypt.compare(x.password,u.password_hash))){
  await withTenantTransaction(u.tenant_id,u.user_id,async c=>{await c.query("UPDATE users SET failed_login_attempts=failed_login_attempts+1,locked_until=CASE WHEN failed_login_attempts+1>=5 THEN now()+interval '15 minutes' ELSE locked_until END WHERE user_id=$1",[u.user_id]);await c.query("INSERT INTO security_events(tenant_id,actor_user_id,event_type,severity,source_ip,user_agent,details) VALUES($1,$2,'LOGIN_FAILED','WARN',$3,$4,$5::jsonb)",[u.tenant_id,u.user_id,req.ip,req.get('user-agent')||null,JSON.stringify({email:u.email})]);});
  return res.status(401).json({error:'Email or password is incorrect.'});
 }
 if(!u.active||u.pending)return res.status(403).json({error:'This account is awaiting administrator approval or is disabled.'});
 if(!['ACTIVE','TRIAL'].includes(u.status))return res.status(403).json({error:'This organisation is currently suspended.'});
 if(u.mfa_enabled){
  if(!x.mfaCode){const challenge=jwt.sign({tenantId:u.tenant_id,purpose:'mfa_challenge',ver:u.token_version||0},process.env.JWT_SECRET,{subject:u.user_id,expiresIn:'5m',algorithm:'HS256'});return res.status(202).json({mfaRequired:true,challengeToken:challenge});}
  let valid=false,index=-1;try{valid=verifyTotp(decryptSecret(u.mfa_secret_ciphertext),x.mfaCode);}catch{}
  if(!valid){index=await recoveryIndex(u,x.mfaCode);valid=index>=0;}
  if(!valid){await withTenantTransaction(u.tenant_id,u.user_id,async c=>c.query("INSERT INTO security_events(tenant_id,actor_user_id,event_type,severity,source_ip,user_agent) VALUES($1,$2,'MFA_CHALLENGE_FAILED','HIGH',$3,$4)",[u.tenant_id,u.user_id,req.ip,req.get('user-agent')||null]));return res.status(401).json({error:'Authenticator code is invalid.'});}
  if(index>=0){const next=u.mfa_recovery_code_hashes.filter((_,i)=>i!==index);await withTenantTransaction(u.tenant_id,u.user_id,async c=>c.query('UPDATE users SET mfa_recovery_code_hashes=$2::jsonb WHERE user_id=$1',[u.user_id,JSON.stringify(next)]));}
 }
 await withTenantTransaction(u.tenant_id,u.user_id,async c=>{await c.query('UPDATE users SET last_login_at=now(),failed_login_attempts=0,locked_until=NULL WHERE user_id=$1',[u.user_id]);await writeAudit(c,{auth:{tenantId:u.tenant_id,userId:u.user_id},ip:req.ip},'USER_SIGN_IN','users',u.user_id);await c.query("INSERT INTO security_events(tenant_id,actor_user_id,event_type,severity,source_ip,user_agent) VALUES($1,$2,'LOGIN_SUCCESS','INFO',$3,$4)",[u.tenant_id,u.user_id,req.ip,req.get('user-agent')||null]);});
 res.json({token:tokenFor(u),user:{id:u.user_id,name:u.full_name,email:u.email,role:u.role,department:u.department,org:u.organization_name,mfaEnabled:!!u.mfa_enabled}});
}catch(e){next(e)}});
router.post('/mfa/verify',async(req,res,next)=>{try{
 const x=z.object({challengeToken:z.string().min(20),code:z.string().min(6).max(20)}).parse(req.body);
 const challenge=jwt.verify(x.challengeToken,process.env.JWT_SECRET,{algorithms:['HS256']});
 if(challenge.purpose!=='mfa_challenge')return res.status(401).json({error:'Invalid MFA challenge.'});
 const q=await pool.query('SELECT u.*,t.organization_name,t.status FROM users u JOIN tenants t USING(tenant_id) WHERE u.user_id=$1 AND u.tenant_id=$2',[challenge.sub,challenge.tenantId]),u=q.rows[0];
 if(!u||!u.active||u.pending||!u.mfa_enabled||Number(challenge.ver??0)!==Number(u.token_version??0))return res.status(401).json({error:'MFA challenge is no longer valid.'});
 let valid=false,index=-1;try{valid=verifyTotp(decryptSecret(u.mfa_secret_ciphertext),x.code);}catch{}
 if(!valid){index=await recoveryIndex(u,x.code);valid=index>=0;}
 if(!valid){await withTenantTransaction(u.tenant_id,u.user_id,async db=>db.query("INSERT INTO security_events(tenant_id,actor_user_id,event_type,severity,source_ip,user_agent) VALUES($1,$2,'MFA_CHALLENGE_FAILED','HIGH',$3,$4)",[u.tenant_id,u.user_id,req.ip,req.get('user-agent')||null]));return res.status(401).json({error:'Authenticator code is invalid.'});}
 await withTenantTransaction(u.tenant_id,u.user_id,async db=>{if(index>=0){const rest=u.mfa_recovery_code_hashes.filter((_,i)=>i!==index);await db.query('UPDATE users SET mfa_recovery_code_hashes=$2::jsonb WHERE user_id=$1',[u.user_id,JSON.stringify(rest)]);}await db.query('UPDATE users SET last_login_at=now(),failed_login_attempts=0,locked_until=NULL WHERE user_id=$1',[u.user_id]);await writeAudit(db,{auth:{tenantId:u.tenant_id,userId:u.user_id},ip:req.ip},'MFA_SIGN_IN_VERIFIED','users',u.user_id);await db.query("INSERT INTO security_events(tenant_id,actor_user_id,event_type,severity,source_ip,user_agent) VALUES($1,$2,'MFA_CHALLENGE_SUCCESS','INFO',$3,$4)",[u.tenant_id,u.user_id,req.ip,req.get('user-agent')||null]);});
 res.json({token:tokenFor(u),user:{id:u.user_id,name:u.full_name,email:u.email,role:u.role,department:u.department,org:u.organization_name}});
}catch(e){if(['JsonWebTokenError','TokenExpiredError','NotBeforeError'].includes(e.name))return res.status(401).json({error:'MFA challenge is invalid or expired.'});next(e)}});
router.post('/mfa/enroll',authenticateToken,async(req,res,next)=>{try{
 if(!process.env.MFA_ENCRYPTION_KEY||process.env.MFA_ENCRYPTION_KEY.length<32)return res.status(503).json({error:'MFA_ENCRYPTION_KEY must be configured with at least 32 characters.'});
 const account=await pool.query('SELECT password_hash,mfa_enabled FROM users WHERE user_id=$1 AND tenant_id=$2',[req.auth.userId,req.auth.tenantId]);
 if(account.rows[0]?.mfa_enabled)return res.status(409).json({error:'MFA is already enabled. Disable it with your password and authenticator code before enrolling again.'});
 const input=z.object({password:z.string().min(1)}).parse(req.body);
 if(!account.rows[0]||!(await bcrypt.compare(input.password,account.rows[0].password_hash)))return res.status(401).json({error:'Password confirmation failed.'});
 const secret=generateTotpSecret(),ciphertext=encryptSecret(secret);
 await withTenantTransaction(req.auth.tenantId,req.auth.userId,async c=>{await c.query('UPDATE users SET mfa_secret_ciphertext=$2,mfa_enabled=false,mfa_recovery_code_hashes=$3::jsonb WHERE user_id=$1',[req.auth.userId,ciphertext,'[]']);await writeAudit(c,req,'MFA_ENROLLMENT_STARTED','users',req.auth.userId);});
 const issuer=encodeURIComponent('JEZTECH SafetyOS'),label=encodeURIComponent(req.auth.email||req.auth.userId);
 res.json({secret,otpauthUrl:'otpauth://totp/'+issuer+':'+label+'?secret='+secret+'&issuer='+issuer+'&algorithm=SHA1&digits=6&period=30',message:'Add this account to an authenticator app, then confirm with the six-digit code. Store the secret securely.'});
}catch(e){next(e)}});
router.post('/mfa/confirm',authenticateToken,async(req,res,next)=>{try{
 const x=z.object({code:z.string().regex(/^\d{6}$/)}).parse(req.body);
 const q=await pool.query('SELECT mfa_secret_ciphertext FROM users WHERE user_id=$1 AND tenant_id=$2',[req.auth.userId,req.auth.tenantId]);
 if(!q.rows[0]?.mfa_secret_ciphertext)return res.status(409).json({error:'Start MFA enrollment first.'});
 if(!verifyTotp(decryptSecret(q.rows[0].mfa_secret_ciphertext),x.code))return res.status(400).json({error:'Authenticator code is not valid.'});
 const codes=Array.from({length:10},()=>crypto.randomBytes(5).toString('hex').toUpperCase()),hashes=await Promise.all(codes.map(v=>bcrypt.hash(v,10)));
 await withTenantTransaction(req.auth.tenantId,req.auth.userId,async c=>{await c.query('UPDATE users SET mfa_enabled=true,mfa_recovery_code_hashes=$2::jsonb,token_version=token_version+1 WHERE user_id=$1',[req.auth.userId,JSON.stringify(hashes)]);await writeAudit(c,req,'MFA_ENABLED','users',req.auth.userId);});
 res.json({enabled:true,recoveryCodes:codes,warning:'Save these recovery codes securely. Each code can be used once. Your current session has been revoked; sign in again.'});
}catch(e){next(e)}});
router.post('/mfa/disable',authenticateToken,async(req,res,next)=>{try{
 const x=z.object({password:z.string().min(1),code:z.string().min(6)}).parse(req.body);
 const q=await pool.query('SELECT password_hash,mfa_secret_ciphertext,mfa_recovery_code_hashes FROM users WHERE user_id=$1 AND tenant_id=$2',[req.auth.userId,req.auth.tenantId]);
 if(!q.rows[0]||!(await bcrypt.compare(x.password,q.rows[0].password_hash)))return res.status(401).json({error:'Password is incorrect.'});
 let valid=false;try{valid=verifyTotp(decryptSecret(q.rows[0].mfa_secret_ciphertext),x.code);}catch{}
 if(!valid)valid=(await recoveryIndex(q.rows[0],x.code))>=0;
 if(!valid)return res.status(401).json({error:'Authenticator or recovery code is invalid.'});
 await withTenantTransaction(req.auth.tenantId,req.auth.userId,async c=>{await c.query("UPDATE users SET mfa_enabled=false,mfa_secret_ciphertext=NULL,mfa_recovery_code_hashes='[]'::jsonb,token_version=token_version+1 WHERE user_id=$1",[req.auth.userId]);await writeAudit(c,req,'MFA_DISABLED','users',req.auth.userId);});
 res.json({disabled:true,message:'MFA disabled. Other active sessions have been revoked.'});
}catch(e){next(e)}});
router.post('/logout',authenticateToken,async(req,res,next)=>{try{await withTenantTransaction(req.auth.tenantId,req.auth.userId,async c=>{await c.query('UPDATE users SET token_version=token_version+1 WHERE user_id=$1',[req.auth.userId]);await writeAudit(c,req,'USER_SIGN_OUT','users',req.auth.userId)});res.json({ok:true})}catch(e){next(e)}});

const institutionSchema=z.object({organization_name:z.string().trim().min(2).max(180),institution_type:z.enum(['GENERAL','SCHOOL','TVET','UNIVERSITY','HOSPITAL','CLINIC','FACTORY','CONSTRUCTION','GOVERNMENT','COMMERCIAL','OTHER']),name:z.string().trim().min(2).max(140),email:z.string().trim().email().max(180),password:z.string().min(14).refine(v=>Buffer.byteLength(v)<=72,'Password must not exceed 72 bytes')});
router.post('/register-institution',async(req,res,next)=>{let c;try{
 const x=institutionSchema.parse(req.body);const hash=await bcrypt.hash(x.password,12);
 c=await pool.connect();await c.query('BEGIN');
 const t=await c.query("INSERT INTO tenants(organization_name,institution_type,status,trial_started_at,access_expires_at) VALUES($1,$2,'TRIAL',now(),now()+interval '30 days') RETURNING tenant_id,access_expires_at",[x.organization_name,x.institution_type]);
 const id=t.rows[0].tenant_id;await c.query("SELECT set_config('app.tenant_id',$1,true)",[id]);
 const u=await c.query("INSERT INTO users(tenant_id,full_name,email,password_hash,role,requested_role,department,active,pending) VALUES($1,$2,lower($3),$4,'admin','admin','Administration',true,false) RETURNING user_id",[id,x.name,x.email,hash]);
 await c.query("SELECT set_config('app.user_id',$1,true)",[u.rows[0].user_id]);
 await c.query("INSERT INTO sites(tenant_id,site_name) VALUES($1,'Main Site')",[id]);
 await writeAudit(c,{auth:{tenantId:id,userId:u.rows[0].user_id},ip:req.ip},'INSTITUTION_REGISTERED','tenants',id);
 await c.query('COMMIT');res.status(201).json({message:'Institution registered. Your 30-day trial is active. Sign in and enroll MFA.',expiresAt:t.rows[0].access_expires_at});
 }catch(e){if(c)await c.query('ROLLBACK');if(e.code==='23505')return res.status(409).json({error:'An account with this email already exists.'});next(e)}finally{if(c)c.release()}});
router.post('/employee-invitation',authenticateToken,async(req,res,next)=>{try{
 if(req.auth.role!=='admin')return res.status(403).json({error:'Institution administrator access required.'});
 const code=jwt.sign({purpose:'employee_invitation',tenantId:req.auth.tenantId},process.env.JWT_SECRET,{algorithm:'HS256',expiresIn:'24h'});
 res.json({code,expiresIn:'24 hours'});
 }catch(e){next(e)}});
router.post('/register',async(req,res,next)=>{try{let body={...req.body};if(body.invitationCode){try{const invite=jwt.verify(body.invitationCode,process.env.JWT_SECRET,{algorithms:['HS256']});if(invite.purpose!=='employee_invitation')throw Error();body.tenantId=invite.tenantId;}catch{return res.status(400).json({error:'Invitation code is invalid or expired. Ask your administrator for a new code.'});}}const x=registerSchema.parse(body),t=await pool.query("SELECT tenant_id FROM tenants WHERE tenant_id=$1 AND status IN ('ACTIVE','TRIAL')",[x.tenantId]);if(!t.rows[0])return res.status(400).json({error:'Invalid or unavailable institution.'});const tenant=t.rows[0].tenant_id,pending=true,hash=await bcrypt.hash(x.password,12);const r=await pool.query("INSERT INTO users(tenant_id,full_name,email,password_hash,role,requested_role,department,active,pending) VALUES($1,$2,lower($3),$4,'user',$5,$6,$7,$8) RETURNING user_id",[tenant,x.name,x.email,hash,x.requestedRole,x.department,!pending,pending]);res.status(201).json({message:pending?'Registration submitted for administrator approval.':'Registration complete.',pending,userId:r.rows[0].user_id})}catch(e){if(e.code==='23505')return res.status(409).json({error:'Account already exists.'});next(e)}});
router.get('/me',authenticateToken,(req,res)=>res.json({user:req.auth}));
export default router;
