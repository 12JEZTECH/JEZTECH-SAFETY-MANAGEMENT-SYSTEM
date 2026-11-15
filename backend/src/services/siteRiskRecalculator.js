export async function recalculateSiteRisk(client,tenantId,siteId){
 const r=await client.query(`
 SELECT COUNT(*) FILTER(WHERE f.compliance_status='MAJOR_NC' AND COALESCE(c.status,'OPEN') NOT IN ('VERIFIED_CLOSED','CLOSED'))::int AS major_nc,
        COUNT(*) FILTER(WHERE f.compliance_status='MINOR_NC' AND COALESCE(c.status,'OPEN') NOT IN ('VERIFIED_CLOSED','CLOSED'))::int AS minor_nc
 FROM safety_inspections i
 JOIN inspection_findings f ON f.inspection_id=i.inspection_id AND f.tenant_id=i.tenant_id
 LEFT JOIN corrective_actions c ON c.capa_id=f.linked_capa_id AND c.tenant_id=f.tenant_id
 WHERE i.tenant_id=$1 AND i.site_id=$2
 `,[tenantId,siteId]);
 const major=r.rows[0]?.major_nc||0,minor=r.rows[0]?.minor_nc||0;
 return {site_id:siteId,unresolved_major_nc:major,unresolved_minor_nc:minor,weighted_audit_risk:Math.min(100,major*15+minor*5),method:'15 points per unresolved Major NC; 5 points per unresolved Minor NC; capped at 100'};
}
