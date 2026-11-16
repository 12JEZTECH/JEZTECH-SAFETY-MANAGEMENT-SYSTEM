import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pool} from './config/db.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const directory=path.resolve(here,'../database');
const client=await pool.connect();
try{
 await client.query('SELECT pg_advisory_lock($1)',[734920261]);
 await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (migration_name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
 // Adopt the original baseline on installations created before migration tracking existed.
 const tracked=await client.query('SELECT 1 FROM schema_migrations WHERE migration_name=$1',['001_initial.sql']);
 if(!tracked.rowCount){
  const baseline=await client.query("SELECT to_regclass('public.tenants') AS tenants,to_regclass('public.users') AS users,to_regclass('public.sites') AS sites,to_regclass('public.audit_logs') AS audit_logs");
  const b=baseline.rows[0];
  if(b.tenants&&b.users&&b.sites&&b.audit_logs){
   const checks=await client.query("SELECT (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('user_id','tenant_id','role','password_hash')) AS user_columns,(SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='safety_inspections' AND column_name IN ('inspection_id','tenant_id','signed_off_at')) AS inspection_columns");
   if(Number(checks.rows[0].user_columns)===4&&Number(checks.rows[0].inspection_columns)===3){
    await client.query("INSERT INTO schema_migrations(migration_name) VALUES('001_initial.sql') ON CONFLICT DO NOTHING");
    console.log('Adopted existing 001_initial.sql baseline; no destructive re-run.');
   }
  }
 }
 const files=(await fs.readdir(directory)).filter(n=>/^\d+_[a-z0-9_-]+\.sql$/i.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 for(const name of files){
  const seen=await client.query('SELECT 1 FROM schema_migrations WHERE migration_name=$1',[name]);
  if(seen.rowCount){console.log('Skipping '+name+' (already applied)');continue;}
  const sql=await fs.readFile(path.join(directory,name),'utf8');
  await client.query('BEGIN');
  try{await client.query(sql);await client.query('INSERT INTO schema_migrations(migration_name) VALUES($1)',[name]);await client.query('COMMIT');console.log('Applied '+name);}
  catch(error){await client.query('ROLLBACK');throw error;}
 }
}catch(error){console.error('Migration failed:',error);process.exitCode=1;}
finally{try{await client.query('SELECT pg_advisory_unlock($1)',[734920261])}catch{}client.release();await pool.end();}
