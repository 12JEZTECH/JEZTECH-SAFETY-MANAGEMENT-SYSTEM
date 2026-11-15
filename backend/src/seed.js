import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {pool,withTenantTransaction} from './config/db.js';
const tenantName=process.env.BOOTSTRAP_TENANT_NAME||'JEZTECH Demo Organization';
const adminName=process.env.BOOTSTRAP_ADMIN_NAME||'SafetyOS Super Admin';
const adminEmail=(process.env.BOOTSTRAP_ADMIN_EMAIL||'superadmin@safetyos.demo').toLowerCase();
const adminPassword=process.env.BOOTSTRAP_ADMIN_PASSWORD;
if(!adminPassword||adminPassword.length<14){console.error('Set BOOTSTRAP_ADMIN_PASSWORD to a unique password of at least 14 characters in backend/.env');process.exit(1)}
try{
 let t=await pool.query('SELECT tenant_id FROM tenants WHERE organization_name=$1 LIMIT 1',[tenantName]);let tenantId=t.rows[0]?.tenant_id;
 if(!tenantId){t=await pool.query('INSERT INTO tenants(organization_name) VALUES($1) RETURNING tenant_id',[tenantName]);tenantId=t.rows[0].tenant_id}
 const hash=await bcrypt.hash(adminPassword,12);
 await withTenantTransaction(tenantId,'',async c=>{
  const u=await c.query("INSERT INTO users(tenant_id,full_name,email,password_hash,role,requested_role,department,active,pending) VALUES($1,$2,$3,$4,'super_admin','super_admin','Platform Administration',true,false) ON CONFLICT (tenant_id,email) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash,role='super_admin',requested_role='super_admin',active=true,pending=false RETURNING user_id",[tenantId,adminName,adminEmail,hash]);
  await c.query("SELECT set_config('app.user_id',$1,true)",[u.rows[0].user_id]);
  await c.query("INSERT INTO sites(tenant_id,site_name) VALUES($1,'Main Site') ON CONFLICT(tenant_id,site_name) DO NOTHING",[tenantId]);
 });
 console.log('Bootstrap complete. Tenant:',tenantName,'Super Admin:',adminEmail,'Password is the value configured in backend/.env');
}catch(e){console.error(e);process.exitCode=1}finally{await pool.end()}
