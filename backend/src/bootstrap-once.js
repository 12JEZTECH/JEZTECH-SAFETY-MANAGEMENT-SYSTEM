import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {pool} from './config/db.js';
const c=await pool.connect();
try {
 await c.query('BEGIN');
 await c.query('SELECT pg_advisory_xact_lock(72839101)');
 const q=await c.query("SELECT 1 FROM users WHERE role='super_admin' LIMIT 1");
 if(!q.rowCount){
 const email=process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
 const password=process.env.BOOTSTRAP_ADMIN_PASSWORD;
 if(!email||!password||password.length<14||Buffer.byteLength(password)>72)throw Error('Invalid bootstrap credentials');
 const existing=await c.query('SELECT 1 FROM users WHERE lower(email)=$1',[email]);
 if(existing.rowCount)throw Error('Bootstrap email already exists; manual review required');
 const name=process.env.BOOTSTRAP_TENANT_NAME||'JEZTECH Demo Organization';
 let t=(await c.query('SELECT tenant_id FROM tenants WHERE organization_name=$1 LIMIT 1',[name])).rows[0];
 if(!t)t=(await c.query('INSERT INTO tenants(organization_name) VALUES($1) RETURNING tenant_id',[name])).rows[0];
 await c.query("SELECT set_config('app.tenant_id',$1,true)",[t.tenant_id]);
 const u=(await c.query("INSERT INTO users(tenant_id,full_name,email,password_hash,role,requested_role,department,active,pending) VALUES($1,$2,$3,$4,'super_admin','super_admin','Platform Administration',true,false) RETURNING user_id",[t.tenant_id,process.env.BOOTSTRAP_ADMIN_NAME||'JEZTECH Super Admin',email,await bcrypt.hash(password,12)])).rows[0];
 await c.query("SELECT set_config('app.user_id',$1,true)",[u.user_id]);
 await c.query("INSERT INTO sites(tenant_id,site_name) VALUES($1,'Main Site') ON CONFLICT(tenant_id,site_name) DO NOTHING",[t.tenant_id]);
 }
 await c.query('COMMIT');
 console.log('Administrator bootstrap complete');
}catch(e){await c.query('ROLLBACK');console.error(e.message);process.exitCode=1;}finally{c.release();await pool.end();}
