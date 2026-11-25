import {Router} from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import {z} from 'zod';
import {rateLimit} from 'express-rate-limit';
import {pool,withTenantTransaction} from '../config/db.js';
import {writeAudit} from '../services/audit.js';
const router=Router();
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
router.use(rateLimit({windowMs:900000,limit:8,standardHeaders:true,legacyHeaders:false}));
router.post('/request',async(req,res,next)=>{try{
 const {email}=z.object({email:z.string().email().max(180)}).parse(req.body);
 const {SMTP_HOST,SMTP_USER,SMTP_PASSWORD,SMTP_FROM,PUBLIC_BASE_URL}=process.env;
 if(!SMTP_HOST||!SMTP_USER||!SMTP_PASSWORD||!SMTP_FROM||!PUBLIC_BASE_URL)return res.status(503).json({error:'Email recovery is not configured.'});
 const base=new URL(PUBLIC_BASE_URL);if(base.protocol!=='https:')return res.status(503).json({error:'Secure recovery URL required.'});
 const q=await pool.query('SELECT user_id,tenant_id,email FROM users WHERE lower(email)=lower($1) AND active AND NOT pending',[email]);
 const u=q.rows[0];
 if(u){const token=crypto.randomBytes(32).toString('hex');
 await pool.query("INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '20 minutes')",[hash(token),u.user_id]);
 const url=new URL('/recovery.html',base);url.hash=token;
 const port=Number(process.env.SMTP_PORT||465);
 try{await nodemailer.createTransport({host:SMTP_HOST,port,secure:port===465,requireTLS:true,auth:{user:SMTP_USER,pass:SMTP_PASSWORD}}).sendMail({from:SMTP_FROM,to:u.email,subject:'SafetyOS password recovery',text:'Reset your password within 20 minutes: '+url.href+' . Ignore this message if you did not request it.'});}catch{await pool.query('DELETE FROM password_reset_tokens WHERE token_hash=$1',[hash(token)]);console.error('Password recovery email delivery failed');}}
 res.json({message:'If your account is eligible, a recovery email will be sent.'});
}catch(e){next(e)}});
router.post('/confirm',async(req,res,next)=>{try{
 const {token,password}=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:z.string().min(14).max(72).refine(v=>Buffer.byteLength(v)<=72)}).parse(req.body);
 const q=await pool.query('SELECT u.user_id,u.tenant_id FROM password_reset_tokens r JOIN users u USING(user_id) WHERE r.token_hash=$1 AND r.used_at IS NULL AND r.expires_at>now() AND u.active AND NOT u.pending',[hash(token)]);
 const u=q.rows[0];if(!u)return res.status(400).json({error:'Invalid or expired recovery link.'});
 const pw=await bcrypt.hash(password,12);
 const ok=await withTenantTransaction(u.tenant_id,u.user_id,async c=>{
 await c.query('SELECT user_id FROM users WHERE user_id=$1 FOR UPDATE',[u.user_id]);
 const r=await c.query('UPDATE password_reset_tokens SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING user_id',[hash(token)]);
 if(!r.rowCount)return false;
 await c.query('UPDATE users SET password_hash=$2,token_version=token_version+1,failed_login_attempts=0,locked_until=NULL WHERE user_id=$1',[u.user_id,pw]);
 await c.query('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[u.user_id]);
 await writeAudit(c,{auth:{tenantId:u.tenant_id,userId:u.user_id},ip:req.ip},'PASSWORD_RESET','users',u.user_id);return true;});
 if(!ok)return res.status(400).json({error:'Invalid or expired recovery link.'});
 res.json({message:'Password changed. Sign in again using your existing MFA.'});
}catch(e){next(e)}});
export default router;
