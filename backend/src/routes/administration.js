import {Router} from 'express';
import {z} from 'zod';
import {pool,withTenantTransaction} from '../config/db.js';
import {authenticateToken,requireRole,tenantTx} from '../middleware/auth.js';
import {writeAudit} from '../services/audit.js';
const router=Router(),admin=requireRole(['super_admin']);
const uuid=z.string().uuid(),money=z.number().finite().min(0).max(999999999);
const wrap=fn=>async(req,res,next)=>{try{await fn(req,res)}catch(e){next(e)}};
router.use(authenticateToken);
router.get('/plans',wrap(async(req,res)=>res.json((await pool.query('SELECT * FROM subscription_plans WHERE active ORDER BY monthly_price')).rows)));
router.post('/plans',admin,wrap(async(req,res)=>{
 const x=z.object({name:z.string().min(2).max(100),monthly_price:money,trial_days:z.number().int().min(0).max(365)}).parse(req.body);
 const r=await tenantTx(req,async c=>{const q=await c.query('INSERT INTO subscription_plans(name,monthly_price,trial_days) VALUES($1,$2,$3) ON CONFLICT(name) DO UPDATE SET monthly_price=excluded.monthly_price,trial_days=excluded.trial_days RETURNING *',[x.name,x.monthly_price,x.trial_days]);await writeAudit(c,req,'SUBSCRIPTION_PLAN_SAVED','subscription_plans',q.rows[0].plan_id);return q.rows[0]});res.json(r);
}));
router.get('/dashboard',admin,wrap(async(req,res)=>{
 const tenants=(await pool.query('SELECT tenant_id,organization_name,status FROM tenants ORDER BY organization_name')).rows;
 const clients=[];for(const t of tenants){const data=await withTenantTransaction(t.tenant_id,req.auth.userId,async c=>({subscriptions:(await c.query('SELECT * FROM client_subscriptions WHERE tenant_id=$1 ORDER BY starts_at DESC',[t.tenant_id])).rows,invoices:(await c.query('SELECT * FROM subscription_invoices WHERE tenant_id=$1 ORDER BY created_at DESC',[t.tenant_id])).rows,payments:(await c.query('SELECT * FROM subscription_payments WHERE tenant_id=$1 ORDER BY created_at DESC',[t.tenant_id])).rows}));clients.push({...t,...data})}
 res.json({clients,backups:(await pool.query('SELECT backup_id,status,started_at,completed_at,size_bytes,restore_verified_at FROM backup_runs ORDER BY started_at DESC LIMIT 30')).rows});
}));
router.post('/subscriptions',admin,wrap(async(req,res)=>{
 const x=z.object({tenant_id:uuid,plan_id:uuid,days:z.number().int().min(1).max(366),trial:z.boolean().default(false)}).parse(req.body);
 const r=await withTenantTransaction(x.tenant_id,req.auth.userId,async c=>{
 await c.query('SELECT tenant_id FROM tenants WHERE tenant_id=$1 FOR UPDATE',[x.tenant_id]);
 const p=(await c.query('SELECT * FROM subscription_plans WHERE plan_id=$1 AND active',[x.plan_id])).rows[0];if(!p)throw Object.assign(new Error('Plan not found'),{status:404});
 if(x.trial&&x.days>p.trial_days)throw Object.assign(new Error('Trial exceeds plan allowance'),{status:400});
 const old=await c.query("SELECT 1 FROM client_subscriptions WHERE tenant_id=$1 AND status IN ('ACTIVE','TRIAL') AND expires_at>now()",[x.tenant_id]);if(old.rowCount)throw Object.assign(new Error('Current subscription already exists'),{status:409});
 const q=await c.query("INSERT INTO client_subscriptions(tenant_id,plan_id,status,expires_at,agreed_price) VALUES($1,$2,$3,now()+$4*interval '1 day',$5) RETURNING *",[x.tenant_id,x.plan_id,x.trial?'TRIAL':'SUSPENDED',x.days,x.trial?0:p.monthly_price]);
 if(!x.trial)await c.query("INSERT INTO subscription_invoices(tenant_id,subscription_id,amount,due_at) VALUES($1,$2,$3,now()+interval '7 days')",[x.tenant_id,q.rows[0].subscription_id,p.monthly_price]);
 return q.rows[0]});res.status(201).json(r);
}));
router.get('/support',wrap(async(req,res)=>res.json(await tenantTx(req,async c=>(await c.query('SELECT * FROM client_support_tickets WHERE tenant_id=$1 AND (requester_id=$2 OR $3) ORDER BY created_at DESC',[req.auth.tenantId,req.auth.userId,['admin','super_admin'].includes(req.auth.role)])).rows))));
router.post('/support',wrap(async(req,res)=>{
 const x=z.object({subject:z.string().min(3).max(180),message:z.string().min(5).max(5000),kind:z.enum(['SUPPORT','CONSULTATION'])}).parse(req.body);
 res.status(201).json(await tenantTx(req,async c=>(await c.query('INSERT INTO client_support_tickets(tenant_id,requester_id,subject,message,kind) VALUES($1,$2,$3,$4,$5) RETURNING *',[req.auth.tenantId,req.auth.userId,x.subject,x.message,x.kind])).rows[0]));
}));
export default router;
