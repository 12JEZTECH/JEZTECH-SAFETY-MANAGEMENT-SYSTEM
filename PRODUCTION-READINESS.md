# JEZTECH SafetyOS — Production Readiness

This is the production release gate. A code change is not a verified control until test evidence is recorded.

## Priority definitions
- P0: Mandatory before production.
- P1: First 30 days after production readiness.
- P2: Operational enhancements.
- P3: Strategic enhancements.

GitHub execution tracker: https://github.com/12JEZTECH/JEZTECH-SAFETY-MANAGEMENT-SYSTEM/issues/2

## P0 backlog

| ID | Control | Implementation status | Evidence still required |
|---|---|---|---|
| SEC-001 | Privileged MFA | TOTP enrollment, encrypted secret storage, recovery codes, login challenge and administrator MFA gate added on upgrade branch | Test Super Admin/Admin enrollment, sign-in, recovery, disable, key rotation and account recovery |
| SEC-002 | RBAC / least privilege | Permission matrix added; supervisor role added without renaming legacy roles | Route-by-route authorization matrix, tenant boundary tests and negative tests for every role |
| SEC-003 | Secrets protection | Environment files ignored by Git; MFA encryption key documented | Configure Render secret environment, rotate database/JWT/QR/MFA credentials, verify no secrets in repository history |
| SEC-004 | HTTPS/TLS | Deployment-level requirement documented | Verify actual Render HTTPS, redirect, database TLS and CORS origins |
| SEC-005 | Penetration test | Not performed | Independent assessment and remediation report |
| SEC-006 | Audit trail | Append-only audit trigger and security event ledger added | Verify coverage for every sensitive mutation; test database owner/superuser threat boundary |
| SEC-007 | Backups | Existing backup/restore scripts documented | Configure scheduled off-site backups and perform restore drill |
| SEC-008 | API security | Schema validation on selected routes, global/auth rate limits, Helmet and CORS configured | Review every route; add API fuzzing, CSRF assessment and endpoint-specific rate limits |
| SEC-009 | Incident integrity | Incident records, immutable revision snapshots and no-delete trigger added | Test lifecycle transitions, approvals, amendment history and database privilege separation |
| SEC-010 | Disaster recovery | Rollback and recovery requirement documented | Test failed-release rollback and restore exercise |

## P1 — First 30 days
- [ ] SAFE-011 Corrective action owners, due dates, evidence and verified closure.
- [ ] SAFE-012 Hazard register and mandatory risk assessment scoring.
- [ ] SAFE-013 Near-miss reporting and investigation.
- [ ] SAFE-014 Overdue corrective-action escalation and notification delivery.
- [ ] SAFE-015 Centralised monitoring and security alerts.
- [ ] SAFE-016 Dependency and application vulnerability scanning.
- [ ] SAFE-017 Confirm provider encryption at rest and implement selected-field encryption where justified.
- [ ] SAFE-018 Endpoint-specific rate-limit policy.
- [ ] SAFE-019 Session expiry, revocation and account recovery verification.
- [ ] SAFE-020 Security incident response playbook.

## P2 — Operational enhancements
- [ ] SAFE-021 Compliance dashboard.
- [ ] SAFE-022 Contractor management.
- [ ] SAFE-023 Emergency drill management.
- [ ] SAFE-024 Permit-to-work workflow and approval validation.
- [ ] SAFE-025 Behaviour observation reporting.
- [ ] SAFE-026 Safety KPI dashboards.
- [ ] SAFE-027 Offline mobile reporting.
- [ ] SAFE-028 Training and certification tracking.

## P3 — Strategic enhancements
- [ ] SAFE-029 AI-assisted hazard classification.
- [ ] SAFE-030 Predictive risk analytics.
- [ ] SAFE-031 Safety trend forecasting.
- [ ] SAFE-032 IoT site monitoring.
- [ ] SAFE-033 Executive risk heat maps.
- [ ] SAFE-034 Automated regulatory reporting.

## Release verification
- [ ] Browser end-to-end tests completed.
- [ ] Fresh PostgreSQL migration completed.
- [ ] Existing database migration/adoption tested on a restored copy.
- [ ] Migration re-run is idempotent.
- [ ] Tenant isolation and RLS tests pass.
- [ ] RBAC tests pass for Super Admin, Safety Manager, Supervisor, Employee and Auditor mappings.
- [ ] MFA tests pass for privileged users.
- [ ] Frontend/backend workflows pass.
- [ ] Render deployment and health check pass.
- [ ] HTTPS/TLS and secret configuration reviewed.
- [ ] Backup restoration succeeds.
- [ ] Vulnerability scan has no unresolved Critical issues.
- [ ] Independent penetration test completed.
- [ ] Monitoring and alert delivery verified.
- [ ] Incident, permit and corrective-action workflows validated.
- [ ] Recovery and rollback exercise signed off.

## Role compatibility mapping
The database preserves legacy role identifiers to avoid breaking existing accounts.

| Business role | Stored role |
|---|---|
| Super Admin | super_admin |
| Safety Manager | safety_department |
| Supervisor | supervisor |
| Employee | user |
| Auditor | auditor_officer |

The legacy admin role remains an organisation administrator. It is not silently renamed to Safety Manager.

## Deployment configuration
Set these as protected production environment variables in Render; never commit their values:
- DATABASE_URL — production PostgreSQL connection string.
- JWT_SECRET — unique random signing secret.
- QR_HMAC_SECRET — separate random HMAC secret.
- MFA_ENCRYPTION_KEY — independent high-entropy key used for AES-256-GCM TOTP secret encryption.
- CORS_ORIGIN — exact trusted frontend origins.
- PGSSLMODE=require where required by the database provider.
- TRUST_PROXY_HOPS — only the actual trusted proxy count.

Do not reuse development or CI secrets in production. Plan controlled rotation because changing the MFA encryption key requires re-encrypting existing MFA secrets before removing the old key.

## Go / No-Go
GO only when every P0 item is verified and signed off, there are no unresolved Critical vulnerabilities, and any High risks have formally approved mitigations.

NO-GO if migrations, restore, tenant isolation, privileged MFA, RBAC, HTTPS, or incident integrity have not been verified.

A successful GitHub CI run is evidence of automated checks only. It does not establish that Render, production PostgreSQL, backups, browser workflows or penetration testing have passed.

## Implementation update — 2026-11-16

The upgrade branch now includes a tenant-scoped relational hazard register and corrective-action workflow:
- Migration `006_hazards_and_capa.sql` creates hazard and corrective-action tables with forced tenant RLS.
- Hazard risk scores and P0–P3 bands are calculated by PostgreSQL using the approved weighted formula.
- Authenticated API routes support hazard creation/listing/status transitions and corrective-action assignment, progress, evidence submission and independent verification.
- The frontend exposes the new Hazard & CAPA workspace at `/hazards.html`, linked from the main navigation.
- Least-privilege permissions are defined for administrator, safety department, supervisor and auditor roles.

These are implementation statements, not verification claims. CI must pass the migration and tests before these controls can be marked verified. The browser module requires a signed-in session from the main SafetyOS application. The API enforces tenant-scoped user/site references; provide UUIDs from the current organisation.

Remaining work still includes full release-governance API/UI, complete end-to-end integration for every legacy workspace module, endpoint-by-endpoint authorization and tenant-boundary tests, operational monitoring and alert delivery evidence, external penetration testing, production secrets/TLS configuration, and a successful backup/restore drill.
