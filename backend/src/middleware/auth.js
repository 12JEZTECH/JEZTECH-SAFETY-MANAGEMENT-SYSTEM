import jwt from 'jsonwebtoken';
import { pool, withTenantTransaction } from '../config/db.js';
export async function authenticateToken(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const result = await pool.query(`SELECT u.user_id,u.tenant_id,u.full_name,u.email,u.role,u.active,u.pending,t.status AS tenant_status FROM users u JOIN tenants t ON t.tenant_id=u.tenant_id WHERE u.user_id=$1 AND u.tenant_id=$2`, [payload.sub,payload.tenantId]);
    const user = result.rows[0];
    if (!user || !user.active || user.pending || !['ACTIVE','TRIAL'].includes(user.tenant_status)) return res.status(401).json({ error: 'This account or organisation is inactive.' });
    req.auth = { userId:user.user_id, tenantId:user.tenant_id, role:user.role, email:user.email, name:user.full_name };
    next();
  } catch (error) {
    if (['JsonWebTokenError','TokenExpiredError'].includes(error.name)) return res.status(401).json({ error:'Session is invalid or expired.' });
    next(error);
  }
}
export const requireRole = roles => (req,res,next) => roles.includes(req.auth?.role) ? next() : res.status(403).json({error:'You do not have permission.'});
export const tenantTx = (req,fn) => withTenantTransaction(req.auth.tenantId,req.auth.userId,fn);
