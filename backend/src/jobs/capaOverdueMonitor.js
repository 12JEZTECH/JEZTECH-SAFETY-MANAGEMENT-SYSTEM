import cron from 'node-cron';
import {pool,withTenantTransaction} from '../config/db.js';

export function startCapaOverdueMonitor(){
  const run=async()=>{
    const tenants=await pool.query("SELECT DISTINCT tenant_id FROM corrective_actions WHERE due_date<CURRENT_DATE AND status NOT IN ('VERIFIED_CLOSED','CLOSED')");
    for(const row of tenants.rows){
      try{
        await withTenantTransaction(row.tenant_id,null,async c=>{
          const overdue=await c.query("SELECT capa_id,title,due_date,priority,escalation_level FROM corrective_actions WHERE tenant_id=$1 AND due_date<CURRENT_DATE AND status NOT IN ('VERIFIED_CLOSED','CLOSED') AND (last_escalated_at IS NULL OR last_escalated_at<now()-interval '24 hours') FOR UPDATE",[row.tenant_id]);
          for(const item of overdue.rows){
            const level=Math.min(3,(item.escalation_level||0)+1);
            await c.query('UPDATE corrective_actions SET escalation_level=$3,last_escalated_at=now(),updated_at=now() WHERE tenant_id=$1 AND capa_id=$2',[row.tenant_id,item.capa_id,level]);
            await c.query("INSERT INTO security_events(tenant_id,event_type,severity,details) VALUES($1,'CAPA_OVERDUE_ESCALATED',$2,$3::jsonb)",[row.tenant_id,level>=3?'HIGH':'WARN',JSON.stringify({capaId:item.capa_id,title:item.title,dueDate:item.due_date,escalationLevel:level})]);
          }
        });
      }catch(error){console.error('CAPA overdue monitor failed for tenant',row.tenant_id,error.message)}
    }
  };
  cron.schedule('15 * * * *',()=>run().catch(e=>console.error('CAPA monitor error',e)),{timezone:'Africa/Nairobi'});
  run().catch(e=>console.error('CAPA monitor initial run error',e));
}
