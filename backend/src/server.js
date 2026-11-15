import 'dotenv/config';
const requiredSecrets=['JWT_SECRET','QR_HMAC_SECRET'];
for(const key of requiredSecrets){if(!process.env[key]||process.env[key].length<32){console.error(key+' must be configured with at least 32 characters.');process.exit(1)}}
if(process.env.JWT_SECRET===process.env.QR_HMAC_SECRET){console.error('JWT_SECRET and QR_HMAC_SECRET must be different values.');process.exit(1)}
const [{default:app},{pool},{startMonthlyExecutiveDigest},{startContractorOverstayMonitor}]=await Promise.all([
 import('./app.js'),import('./config/db.js'),import('./jobs/monthlyExecutiveDigest.js'),import('./jobs/contractorOverstayMonitor.js')
]);
const port=Number(process.env.PORT||8080);
const server=app.listen(port,'0.0.0.0',()=>{console.log('JEZTECH SafetyOS API listening on '+port);startMonthlyExecutiveDigest();startContractorOverstayMonitor()});
async function shutdown(){console.log('Shutting down SafetyOS API');server.close(async()=>{await pool.end();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref()}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
