import {Server} from 'socket.io';
import jwt from 'jsonwebtoken';
import {pool} from '../config/db.js';
let io;
export function initSocketServer(httpServer){
 io=new Server(httpServer,{cors:{origin:(process.env.CORS_ORIGIN||'http://localhost:8080').split(',').map(x=>x.trim()),methods:['GET','POST']}});
 io.use(async(socket,next)=>{try{const token=socket.handshake.auth?.token;if(!token)return next(new Error('Authentication required'));const p=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256']});const r=await pool.query("SELECT u.user_id,u.tenant_id,u.active,u.pending,t.status FROM users u JOIN tenants t ON t.tenant_id=u.tenant_id WHERE u.user_id=$1 AND u.tenant_id=$2",[p.sub,p.tenantId]);const u=r.rows[0];if(!u||!u.active||u.pending||!['ACTIVE','TRIAL'].includes(u.status))return next(new Error('Account not active'));socket.data.tenantId=u.tenant_id;socket.data.userId=u.user_id;next()}catch(e){next(new Error('Invalid session'))}});
 io.on('connection',socket=>{socket.join('tenant:'+socket.data.tenantId);});
 return io;
}
export function emitTenantEvent(tenantId,event,payload={}){if(io)io.to('tenant:'+tenantId).emit(event,payload)}
