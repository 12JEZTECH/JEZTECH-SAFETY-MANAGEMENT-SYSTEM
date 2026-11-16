-- Seed the mandatory release-gate controls. Missing evidence remains NOT_STARTED.
INSERT INTO release_controls(tenant_id,project_id,control_code,control_name,category,required,owner_label)
SELECT p.tenant_id,p.project_id,c.code,c.name,c.category,true,c.owner
FROM release_projects p
CROSS JOIN (VALUES
 ('SEC-001','Administrator MFA enforced','Identity','Security Lead'),
 ('SEC-002','Role-based access control verified','Identity','Security Lead'),
 ('SEC-003','Production secrets managed and rotated','Infrastructure','Platform Lead'),
 ('SEC-004','HTTPS/TLS verified on production endpoints','Infrastructure','Platform Lead'),
 ('SEC-005','Independent penetration test completed','Application Security','Security Lead'),
 ('SEC-006','Audit event coverage verified','Monitoring','Engineering Lead'),
 ('SEC-007','Backup restore drill passed','Resilience','Operations Lead'),
 ('SEC-008','OWASP protection and validation verified','Application Security','Engineering Lead'),
 ('SEC-009','Incident records immutable and traceable','Data Integrity','Engineering Lead'),
 ('SEC-010','Business continuity plan tested','Resilience','Operations Lead'),
 ('SAFE-012','Hazard register operational and reviewed','Safety Operations','Safety Manager'),
 ('SAFE-011','Corrective action workflow verified','Safety Operations','Safety Manager'),
 ('SAFE-013','Near-miss reporting and escalation verified','Safety Operations','Safety Manager'),
 ('SAFE-014','Escalation engine verified','Safety Operations','Safety Manager'),
 ('SAFE-015','Monitoring and alert delivery verified','Monitoring','Security Lead'),
 ('SAFE-016','Vulnerability scanning evidence recorded','Application Security','Security Lead'),
 ('REL-APPROVAL','Release approval board sign-off recorded','Governance','Release Manager')
) AS c(code,name,category,owner)
ON CONFLICT (tenant_id,project_id,control_code) DO NOTHING;
