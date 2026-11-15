export async function writeAudit(client, req, action, targetTable=null, targetId=null, metadata={}) {
 await client.query("INSERT INTO audit_logs(tenant_id,actor_user_id,action,target_table,target_record_id,ip_address,metadata) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)",[req.auth.tenantId,req.auth.userId,action,targetTable,targetId,req.ip,JSON.stringify(metadata)]);
}
