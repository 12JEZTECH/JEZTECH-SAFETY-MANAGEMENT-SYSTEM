import {Router} from 'express';
import {authenticateToken,requireRole,tenantTx} from '../middleware/auth.js';
const router=Router();router.use(authenticateToken);
router.get('/executive-summary',requireRole(['super_admin','admin','safety_department']),async(req,res,next)=>{try{const data=await tenantTx(req,async c=>{const [inspections,findings,actions,passes]=await Promise.all([c.query('SELECT COUNT(*)::int total,AVG(overall_compliance_score)::numeric(5,1) avg_score FROM safety_inspections WHERE tenant_id=$1',[req.auth.tenantId]),c.query("SELECT COUNT(*) FILTER(WHERE compliance_status='MAJOR_NC')::int major_nc,COUNT(*) FILTER(WHERE compliance_status='MINOR_NC')::int minor_nc FROM inspection_findings WHERE tenant_id=$1",[req.auth.tenantId]),c.query("SELECT COUNT(*) FILTER(WHERE status NOT IN ('VERIFIED_CLOSED','CLOSED'))::int open_actions,COUNT(*) FILTER(WHERE status='VERIFIED_CLOSED')::int closed_actions FROM corrective_actions WHERE tenant_id=$1",[req.auth.tenantId]),c.query('SELECT COUNT(*)::int open_passes FROM contractor_gate_passes WHERE tenant_id=$1 AND checked_in_at IS NOT NULL AND checked_out_at IS NULL',[req.auth.tenantId])]);return {...inspections.rows[0],...findings.rows[0],...actions.rows[0],...passes.rows[0]}});res.json(data)}catch(e){next(e)}});
const datasets={
 inspections:{table:'safety_inspections',columns:'audit_reference_code,inspection_type,inspected_department,inspection_date,overall_compliance_score,overall_verdict',date:'inspection_date'},
 findings:{table:'inspection_findings',columns:'clause_or_area,compliance_status,auditor_comments,recommended_corrective_action,created_at',date:'created_at'},
 actions:{table:'corrective_actions',columns:'title,assigned_to,due_date,priority,status,created_at',date:'created_at'},
 visitors:{table:'contractor_gate_passes',columns:'pass_code,organization,person_type,purpose,checked_in_at,checked_out_at,created_at',date:'created_at'}
};
router.get('/print/:kind',requireRole(['super_admin','admin','safety_department','auditor_officer']),async(req,res,next)=>{try{
 const d=datasets[req.params.kind];if(!Object.hasOwn(datasets,req.params.kind))return res.status(404).json({error:'Report not found'});
 const {from,to}=req.query;
 if(![from,to].every(v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v)))||from>to)return res.status(400).json({error:'Select a valid date range'});
 const data=await tenantTx(req,async c=>{
 const org=(await c.query('SELECT organization_name,institution_type FROM tenants WHERE tenant_id=$1',[req.auth.tenantId])).rows[0];
 const rows=(await c.query('SELECT '+d.columns+' FROM '+d.table+' WHERE tenant_id=$1 AND '+d.date+'>=$2::date AND '+d.date+'<($3::date+1) ORDER BY '+d.date+' DESC LIMIT 5001',[req.auth.tenantId,from,to])).rows;
 return {organization:org,columns:d.columns.split(','),rows:rows.slice(0,5000),truncated:rows.length>5000,from,to};
 });res.json(data);
}catch(e){next(e)}});
export default router;
