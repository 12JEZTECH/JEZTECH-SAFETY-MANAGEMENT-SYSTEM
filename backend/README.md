# JEZTECH SafetyOS API

## Local setup

1. Install Docker Desktop.
2. Copy the root `.env.example` to `.env`. Set a long, unique `POSTGRES_PASSWORD`.
3. Copy `backend/.env.example` to `backend/.env`.
4. Set `DATABASE_URL` to the same database password (for Docker Compose, host is `db`).
5. Generate two different random secrets of at least 32 characters for `JWT_SECRET` and `QR_HMAC_SECRET`.
6. Set a unique `BOOTSTRAP_ADMIN_PASSWORD` of at least 14 characters.
7. Run:

   ```bash
   docker compose up -d --build
   docker compose exec api npm run migrate
   docker compose exec api npm run seed
   ```

8. Open `http://localhost:8080` and sign in using the Super Admin email/password configured in `backend/.env`.

The initial database migration is for a new SafetyOS database. Do not run it against an existing production database without a backup and schema review.

## Role model

- `super_admin`: platform organisation provisioning and full tenant administration.
- `admin`: organisation administration and user approvals, excluding Super Admin-only privileges.
- `safety_department`: safety operations and compliance work.
- `auditor_officer`: industrial inspection assessments, findings, score/verdict, sign-off, report exports, QR tags and closure verification.
- `user`: permitted operational workspace access.
- `wall_display_kiosk`: read-only, aggregate WallScreen access.

Elevated registrations are pending until approved. Users cannot grant themselves roles. The bootstrap Super Admin is created only by the explicit seed command.

## API surface

- `GET /api/health`
- `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`
- `GET/PUT /api/workspace`
- `GET/POST /api/users`, `PATCH /api/users/:id`, `POST /api/users/:id/reset-password`, `GET /api/audit-logs`
- `GET/POST /api/sites`, `PATCH /api/sites/:id`
- `GET/POST /api/platform/tenants`, `PATCH /api/platform/tenants/:id` (Super Admin)
- `GET/POST /api/v1/auditor/inspections`
- `GET /api/v1/auditor/inspections/:id`, `POST /api/v1/auditor/inspections/:id/findings`, `POST /api/v1/auditor/inspections/:id/signoff`
- `GET /api/v1/auditor/inspections.csv`, `GET /api/v1/auditor/inspections/:id/pdf`
- `GET /api/v1/auditor/capas`, `POST /api/v1/auditor/findings/:findingId/management-response`, `POST /api/v1/auditor/findings/:findingId/verify-closure`
- `POST /api/v1/auditor/equipment-tags/generate`, `POST /api/v1/auditor/equipment-tags/resolve`, `GET /api/v1/auditor/site-risk/:siteId`
- `GET/POST /api/v1/contractors`, `POST /api/v1/contractors/:id/check-in`, `POST /api/v1/contractors/:id/check-out`, `GET /api/v1/contractors/muster-roll`, `GET /api/v1/contractors/muster-roll.pdf`
- `GET /api/v1/reports/executive-summary`, `POST /api/v1/auditor/digest/send-now`
- `GET /api/wallboard/summary`; authenticated tenant-scoped Socket.IO events: `safety:inspection-created`, `safety:finding-added`, `safety:risk-updated`, `wallboard:refresh`.

## Monitoring, email and backups

Monthly executive summaries run at 07:00 Africa/Nairobi on the first day of each month. Contractor/visitor overstay checks run every 30 minutes after a 12-hour open pass. Configure SMTP variables for email dispatch; when SMTP is not configured, the process writes a preview to the service log. WallScreen API responses contain aggregate counts only, not worker/visitor names.

Run `scripts/backup_postgres.sh` to create and verify a custom-format PostgreSQL dump (14-day retention by default). Restore with `scripts/restore_postgres.sh path/to/backup.dump`; the script requires typing `RESTORE`.

## Frontend note

`frontend/index.html` is a small API-connected operations console for sign-in, site creation, inspection creation, CSV export and gate-pass issuance. It is not a complete port of the full legacy SafetyOS HTML workspace. The previous full HTML should be integrated as the next frontend task against these API routes.

## Render

`render.yaml` describes a Render web service and PostgreSQL database. After provisioning, configure the unsynced bootstrap administrator values, run the initial migration and seed commands as a one-off job/console command, verify `/api/health`, then test all role workflows. Creating the Blueprint does not itself apply database migrations or create the Super Admin.

## Verification and limitations

GitHub Actions CI passed for the latest pushed commit. The workflow checks JavaScript syntax and repository smoke tests. A live PostgreSQL migration, browser end-to-end tests, production security audit, SMTP delivery, and Render deployment have not been completed. Treat this as an implementation foundation, not a production-certified regulatory system. Evidence attachments currently store references only; configure private object storage before accepting uploaded evidence. Confirm regulatory obligations with qualified Kenyan safety professionals.
