import cron from 'node-cron';
import nodemailer from 'nodemailer';
import {pool,withTenantTransaction} from '../config/db.js';
function transporter(){if(!process.env.SMTP_HOST||!process.env.SMTP_FROM)return null;return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:Number(process.env.SMTP_PORT)===465,auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined})}
export async function scanContractorOverstays(){
 const tenants=(await pool.query("SELECT tenant_id,organization_name FROM tenants WHERE status='ACTIVE'")).rows;
 const mail=transporter();let total=0;
 for(const tenant of tenants){
  const claim=await withTenantTransaction(tenant.tenant_id,'',async c=>{
   const recipients=(await c.query("SELECT email FROM users WHERE tenant_id=$1 AND role IN ('super_admin','admin','safety_department') AND active=true AND pending=false",[tenant.tenant_id])).rows.map(r=>r.email);
   const rows=(await c.query("UPDATE contractor_gate_passes SET overstay_alert_sent_at=now() WHERE tenant_id=$1 AND checked_in_at < now()-interval '12 hours' AND checked_out_at IS NULL AND overstay_alert_sent_at IS NULL RETURNING gate_pass_id,pass_code,person_name,site_id,checked_in_at",[tenant.tenant_id])).rows;
   return {rows,recipients};
  });
  if(!claim.rows.length)continue;
  total+=claim.rows.length;
  const text=claim.rows.map(x=>x.pass_code+' · '+x.person_name+' · site '+x.site_id+' · checked in '+x.checked_in_at).join('\n');
  try{
   if(mail&&claim.recipients.length){await mail.sendMail({from:process.env.SMTP_FROM,to:claim.recipients.join(','),subject:tenant.organization_name+' — contractor/visitor overstay alert',text:'The following gate passes have remained open for more than 12 hours:\n\n'+text+'\n\nPlease verify the person is safe and record check-out.'})}
   else console.warn('[SafetyOS overstay alert preview]',{tenant:tenant.organization_name,recipients:claim.recipients.length,passes:claim.rows.map(x=>({pass_code:x.pass_code,site_id:x.site_id,checked_in_at:x.checked_in_at}))});
  }catch(error){
   await withTenantTransaction(tenant.tenant_id,'',async c=>{await c.query('UPDATE contractor_gate_passes SET overstay_alert_sent_at=NULL WHERE tenant_id=$1 AND gate_pass_id=ANY($2::uuid[])',[tenant.tenant_id,claim.rows.map(x=>x.gate_pass_id)])});
   console.error('Overstay email failed; alerts released for retry:',error.message);
  }
 }
 return total;
}
export function startContractorOverstayMonitor(){cron.schedule('*/30 * * * *',()=>scanContractorOverstays().catch(e=>console.error('Overstay scan failed',e)),{timezone:'Africa/Nairobi'});console.log('Contractor overstay scan scheduled every 30 minutes.')}
