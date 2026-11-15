import {Router} from 'express';
import {authenticateToken,requireRole,tenantTx} from '../middleware/auth.js';
import {writeAudit} from '../services/audit.js';
import {runMonthlyDigestNow} from '../jobs/monthlyExecutiveDigest.js';
const router=Router();router.use(authenticateToken);
router.post('/digest/send-now',requireRole(['super_admin','admin','safety_department']),async(req,res,next)=>{try{const results=await runMonthlyDigestNow(req.auth.tenantId);await tenantTx(req,async c=>writeAudit(c,req,'TRIGGER_EXECUTIVE_DIGEST_NOW','tenants',null,{results}));res.json({message:'Executive digest run completed.',results,triggered_at:new Date().toISOString()})}catch(e){next(e)}});
export default router;
