import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.cwd());
test('initial database migration contains tenant scoped tables and RLS',()=>{const sql=fs.readFileSync(path.join(root,'database/001_initial.sql'),'utf8');for(const table of ['tenants','users','sites','workspace_state','safety_inspections','inspection_findings','contractor_gate_passes','audit_logs'])assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS '+table));assert.match(sql,/ENABLE ROW LEVEL SECURITY/);assert.match(sql,/CREATE POLICY tenant_scope/);});
test('backend source has all mounted route modules',()=>{for(const file of ['src/routes/auth.js','src/routes/workspace.js','src/routes/auditor.js','src/routes/contractors.js','src/routes/reports.js','src/routes/sites.js','src/routes/platform.js','src/routes/digest.js'])assert.ok(fs.existsSync(path.join(root,file)),file+' missing')});

test('security migration provisions MFA metadata, security events and immutable audit triggers',()=>{const sql=fs.readFileSync(path.join(root,'database/002_security_foundation.sql'),'utf8');for(const marker of ['mfa_enabled','mfa_secret_ciphertext','mfa_recovery_code_hashes','failed_login_attempts','locked_until','token_version','CREATE TABLE IF NOT EXISTS security_events','ENABLE ROW LEVEL SECURITY','audit_logs_no_update','audit_logs_no_delete'])assert.ok(sql.includes(marker),marker+' missing');});
test('migration runner applies numbered migrations once',()=>{const source=fs.readFileSync(path.join(root,'src/migrate.js'),'utf8');assert.match(source,/schema_migrations/);assert.match(source,/localeCompare/);assert.match(source,/INSERT INTO schema_migrations/);});
