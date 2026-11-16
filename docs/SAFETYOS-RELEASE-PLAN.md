# SafetyOS Release Governance and Delivery Plan

This plan operationalises the supplied SafetyOS delivery plan. It is a planning baseline, not evidence that a control has passed.

## Release milestones and ownership

| Milestone | Target | Exit criteria | Executive owner | Delivery owner |
|---|---|---|---|---|
| M1 Security Foundation Complete | Sprint 1 | MFA, RBAC, secrets management and TLS verified | CIO / Sponsor | Security Lead |
| M2 Production Platform Ready | Sprint 2 | Pen test complete, backups restored successfully, OWASP controls validated | CTO | Engineering Lead |
| M3 Operational Safety Workflows Ready | Sprint 3 | Hazard register, corrective actions and near-miss workflows operational | Head of Safety | Safety Manager |
| M4 Security Operations & Monitoring Ready | Sprint 4 | Monitoring, alerting, session controls and incident response playbooks live | CISO | Security Lead |
| M5 Compliance & Governance Ready | Sprint 5 | Compliance reporting, PTW and contractor management deployed | Compliance Director | Compliance Officer |
| M6 UAT Sign-Off | Sprint 5 | Business, Safety, Security and Compliance approval obtained | Product Owner | QA Lead |
| M7 Production Readiness Review | Sprint 5 | Readiness >= 90%, no Critical vulnerabilities | Steering Committee | Release Manager |
| M8 Go-Live | Release Day | CAB approval and deployment completed | Executive Sponsor | DevOps Lead |
| M9 Hypercare Exit | +14 days | No Sev1 incidents and SLA achieved | Product Owner | Operations Lead |

Milestone dates are intentionally blank until the release calendar is approved. Assign named user accounts to owner_user_id when the organisation has confirmed the accountable people; role labels are planning ownership, not user identities.

## Dashboard data model

Migration: `backend/database/005_release_governance.sql`.

| Entity | Purpose | Key fields |
|---|---|---|
| release_projects | Release / programme container | project_id, tenant_id, release_version, dates, status |
| release_epics | Jira epics | epic_id, project_id, owner, status, target_sprint |
| release_tickets | Jira stories/tasks | ticket_id, epic_id, priority, points, sprint, owner, status, risk_score, due_date, labels |
| release_sprints | Capacity and delivery progress | capacity_points, committed_points, completed_points, dates, status |
| release_milestones | Delivery checkpoints | code, target, exit criteria, executive/delivery owners, status, evidence |
| release_risks | Weighted risk register | severity, likelihood, regulatory_impact, business_impact, calculated_score, priority, mitigation owner |
| release_controls | Release gate evidence | control code, category, required, status, evidence, owner, verifier |
| release_approvals | Approval board decisions | approver role/user, decision, comments, decided_at |

All records are tenant-scoped and use PostgreSQL row-level security. The weighted risk formula is calculated by PostgreSQL:
`(severity * 5) + (likelihood * 3) + (regulatory_impact * 4) + (business_impact * 3)`.
Priority bands: P0 >=80; P1 60-79; P2 40-59; P3 below 40.

## Dashboard calculations

- Readiness % = passed mandatory controls / total mandatory controls * 100. Do not count missing or unverified evidence as passed.
- Sprint completion % = completed story points / committed story points * 100; return 0 or N/A when committed points are zero.
- Risk exposure = open risk scores / all recorded risk scores. Display numerator and denominator with the percentage.
- P0 completion = completed P0 tickets / all P0 tickets * 100.
- Go / No-Go = GO only when readiness >=90%, all P0 tickets are Done, Critical vulnerabilities = 0, and DR restore test = Passed. Otherwise NO-GO.
- RAG: Green >=90% and no blocking gate; Amber 75-89%; Red <75% or any failed mandatory gate.

## KPI definitions

Capture current values from verified evidence rather than copying the illustrative figures in the source plan. The supplied baseline states 69% readiness, a 21-point gap to the 90% target, MFA 0%, RBAC 50%, audit coverage 40%, backup recovery 0%, and incident traceability 60%; treat these as initial planning values until re-measured.

## Ownership / RACI

Use the source RACI matrix for accountability. The migration supports both a user_id and a role/label because the plan names delivery functions but does not identify individual employees. The Product Owner remains accountable for the release outcome; the relevant functional owner is responsible for delivery.

## Jira import

Import `exports/safetyos-jira-import.csv` through Jira's CSV importer. Map:
- Issue Type -> Issue Type
- Issue Key -> Issue Key (or omit if Jira should generate keys)
- Summary -> Summary
- Description -> Description
- Priority -> Priority
- Story Points -> Story Points
- Sprint -> Sprint
- Epic Link -> Epic Link
- Assignee -> Assignee (map labels to actual Jira users before import)
- Labels -> Labels

The CSV contains the four epics and the 24 stories explicitly listed in the supplied Jira CSV template. Story keys, sprint names and assignee labels are planning identifiers; confirm Jira project configuration and user accounts before import.

## Release gate

NO-GO until all P0 controls have verifiable evidence, readiness is at least 90%, risk rating is Medium or lower, no Critical finding remains open, and the approval board has signed off. A successful CI run alone does not prove production readiness.
