import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pool} from './config/db.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const directory=path.resolve(here,'../database');
const client=await pool.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (migration_name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const files=(await fs.readdir(directory))
    .filter(name=>/^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  for (const name of files) {
    const seen=await pool.query('SELECT 1 FROM schema_migrations WHERE migration_name=$1',[name]);
    if (seen.rowCount) { console.log('Skipping '+name+' (already applied)'); continue; }
    const sql=await fs.readFile(path.join(directory,name),'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(migration_name) VALUES($1)',[name]);
      await client.query('COMMIT');
      console.log('Applied '+name);
    } catch(error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} catch(error) {
  console.error('Migration failed:',error);
  process.exitCode=1;
} finally {
  client.release();
  await pool.end();
}
