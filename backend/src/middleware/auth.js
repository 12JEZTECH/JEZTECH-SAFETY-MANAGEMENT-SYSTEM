import jwt from 'jsonwebtoken';
import {pool,withTenantTransaction} from '../config/db.js';
export async function authenticateToken(req,res,next){
 const header=req.headers.authorization||'';
 const token=header.replace(/^Bearer\s+/i,'');
 if(!token||token===header)return res.status(401).json({error:'Authentication required.'});
 try{
  const payload=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256']});
  if(payload.purpose==='mfa_challenge')return res.status(401).json({error:'Complete MFA verification before accessing the application.'});
  const q=await pool.query('SELECT u.user_id,u.tenant_id,u.full_name,u.email,u.role,u.active,u.pending,u.token_version,u.mfa_enabled,t.status AS tenant_status FROM users u JOIN tenants t ON t.tenant_id=u.tenant_id WHERE u.user_id=$1 AND u.tenant_id=$2',[payload.sub,payload.tenantId]);
  const u=q.rows[0];
  if(!u||!u.active||u.pending||!['ACTIVE','TRIAL'].includes(u.tenant_status))return res.status(401).json({error:'This account or organisation is inactive.'});
  if(Number(payload.ver??0)!==Number(u.token_version??0))return res.status(401).json({error:'Session has been revoked. Sign in again.'});
  req.auth={userId:u.user_id,tenantId:u.tenant_id,role:u.role,email:u.email,name:u.full_name,mfaEnabled:!!u.mfa_enabled};
  if(['super_admin','admin'].includes(u.role)&&!u.mfa_enabled&&!req.path.startsWith('/mfa/')&&req.path!=='/me')return res.status(403).json({error:'MFA enrollment is mandatory for administrator accounts. Enable MFA before continuing.'});
  next();
 }catch(e){if(['JsonWebTokenError','TokenExpiredError','NotBeforeError'].includes(e.name))return res.status(401).json({error:'Session is invalid or expired.'});next(e);}
}
export const requireRole=roles=>(req,res,next)=>roles.includes(req.auth?.role)?next():res.status(403).json({error:'You do not have permission.'});
export const tenantTx=(req,fn)=>withTenantTransaction(req.auth.tenantId,req.auth.userId,fn);

import {hasPermission} from '../security/permissions.js';
export const requirePermission=permission=>(req,res,next)=>hasPermission(req.auth?.role,permission)?next():res.status(403).json({error:'You do not have permission to perform this action.'});
