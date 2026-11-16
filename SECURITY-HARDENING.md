# Security hardening roadmap

## Phase 1 foundation
- Additive numbered SQL migration runner with a schema_migrations ledger.
- MFA-ready user fields, encrypted-secret storage slot, hashed recovery-code storage, login lockout metadata and token version.
- Tenant-scoped security event ledger.
- Append-only audit log enforced by PostgreSQL update/delete triggers.

## Required deployment configuration
- Keep DATABASE_URL, JWT_SECRET, QR_HMAC_SECRET, SMTP credentials and any MFA encryption key in Render environment secrets, never Git.
- Generate independent random secrets. Rotate compromised secrets immediately and invalidate existing sessions.
- Use a dedicated PostgreSQL application role that is not table owner and has no DDL privileges. The audit trigger is not tamper-proof against a database owner/superuser.
- Require TLS for hosted database connections; configure provider-managed encryption at rest and encrypted backups.
- Set CORS_ORIGIN to exact trusted frontend origins. Keep wildcard origins disabled.
- Use TLS at the hosting edge and configure proxy trust only for the known hosting topology.

## Still requiring implementation/verification
- Complete TOTP enrollment/challenge/recovery flows and privileged-account MFA enforcement.
- Enforce token-version/session revocation in all authentication paths.
- Wire lockout counters and security event capture to login, password reset, role changes and administrative actions.
- Move incident/finding records from mutable JSON workspace state into versioned relational records with append-only revisions and approval transitions.
- Add strict schema validation to every route, per-route rate limits, dependency and secret scanning, backup restore drills, browser E2E and external penetration testing.
- Configure private object storage for evidence.
- Apply retention schedules and privacy notices based on legal advice and documented purpose.

## Role mapping
Current database roles are retained for compatibility: super_admin (Super Admin), admin (Safety Manager / organisation administrator), safety_department (Supervisor / safety team), user (Employee), and auditor_officer (Auditor). Do not rename role values until every route, seed and existing account has been migrated and tested.

## Verification status
CI syntax/smoke tests do not prove live database migration, MFA operation, encryption-at-rest configuration, WAF protection, regulatory compliance or penetration-test readiness. Record each separately after it has actually been tested.
