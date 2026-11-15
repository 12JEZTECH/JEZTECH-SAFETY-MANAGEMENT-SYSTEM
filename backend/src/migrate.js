import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pool} from './config/db.js';
const here=path.dirname(fileURLToPath(import.meta.url));
try{const sql=await fs.readFile(path.resolve(here,'../database/001_initial.sql'),'utf8');await pool.query(sql);console.log('Database migration applied.')}catch(e){console.error(e);process.exitCode=1}finally{await pool.end()}
