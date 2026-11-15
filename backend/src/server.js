import 'dotenv/config';
import app from './app.js';
import {pool} from './config/db.js';
import {startMonthlyExecutiveDigest} from './jobs/monthlyExecutiveDigest.js';
import {startContractorOverstayMonitor} from './jobs/contractorOverstayMonitor.js';
const port=Number(process.env.PORT||8080);
const server=app.listen(port,'0.0.0.0',()=>{console.log(`JEZTECH SafetyOS API listening on ${port}`);startMonthlyExecutiveDigest();startContractorOverstayMonitor()});
async function shutdown(){console.log('Shutting down SafetyOS API');server.close(async()=>{await pool.end();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref()}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
