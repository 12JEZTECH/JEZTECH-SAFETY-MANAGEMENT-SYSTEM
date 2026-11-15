# JEZTECH SafetyOS Enterprise

JEZTECH SafetyOS is a role-based Enterprise Safety Management System for organisations in Kenya and other markets.

## Included in this repository

- Node.js/Express backend with JWT authentication and bcrypt password hashing
- PostgreSQL schema with tenant-scoped row-level security policies
- Roles for Super Admin, Admin, Safety Department, Auditor Officer, Standard User and WallScreen kiosk
- Safety workspace persistence, site administration and audit logging
- Industrial inspection assessments, findings, corrective actions, management responses, auditor sign-off and PDF/CSV exports
- HMAC-signed equipment QR payloads and contractor/visitor gate pass workflow
- Aggregate WallScreen endpoint, tenant-authenticated Socket.IO events and scheduled digest/overstay jobs
- Docker Compose setup, PostgreSQL backup/restore scripts, Render Blueprint and GitHub Actions CI

## Run locally

Follow [Backend Setup](backend/README.md). The initial database migration is intended for a new database. Set secrets locally; never commit `.env` files.

## Current scope

The repository contains a backend implementation foundation and a small API-connected console. The full legacy SafetyOS frontend still needs to be ported and integrated with the normalized API. CI has passed JavaScript syntax and smoke checks; live PostgreSQL, browser E2E, email-provider and Render deployment tests remain outstanding.

The platform supports safety workflow management and evidence tracking. It is not a substitute for qualified safety professionals or formal regulatory certification.
