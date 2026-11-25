import 'dotenv/config';
import {pool} from './config/db.js';
try {
 const q=await pool.query("SELECT 1 FROM users WHERE role='super_admin' LIMIT 1");
 if(!q.rowCount){
 const email=process.env.BOOTSTRAP_ADMIN_EMAIL;
 const password=process.env.BOOTSTRAP_ADMIN_PASSWORD;
 if(!email||!password||password.length<14||Buffer.byteLength(password)>72)throw Error('Configure a valid bootstrap administrator email and password (14 characters minimum, 72 bytes maximum).');
 const existing=await pool.query('SELECT 1 FROM users WHERE lower(email)=lower($1)',[email]);
 if(existing.rowCount)throw Error('Bootstrap email already belongs to an account; manual review required.');
 await pool.end();
 await import('./seed.js');
 }else{await pool.end();console.log('Administrator already initialized; preserving credentials.');}
}catch(e){console.error(e.message);process.exitCode=1;await pool.end().catch(()=>{});}
