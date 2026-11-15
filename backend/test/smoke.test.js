import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.cwd());
test('initial database migration contains tenant scoped tables and RLS',()=>{const sql=fs.readFileSync(path.join(root,'database/001_initial.sql'),'utf8');for(const table of ['tenants','users','sites','workspace_state','safety_inspections','inspection_findings','contractor_gate_passes','audit_logs'])assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS '+table));assert.match(sql,/ENABLE ROW LEVEL SECURITY/);assert.match(sql,/CREATE POLICY tenant_scope/);});
test('backend source has all mounted route modules',()=>{for(const file of ['src/routes/auth.js','src/routes/workspace.js','src/routes/auditor.js','src/routes/contractors.js','src/routes/reports.js','src/routes/sites.js','src/routes/platform.js','src/routes/digest.js'])assert.ok(fs.existsSync(path.join(root,file)),file+' missing')});
