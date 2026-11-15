# JEZTECH SafetyOS Enterprise

JEZTECH SafetyOS is an enterprise safety management workspace for Super Admin, Admin, Safety Department, Auditor Officer and Standard User roles.

## Backend package

The initial backend source package is maintained as a separate downloadable ZIP supplied with this project. This repository README documents the intended deployment and setup entry points.

## Planned architecture

- Node.js ES-module API
- PostgreSQL persistence and tenant isolation
- JWT authentication and role-based access control
- Safety operations and Auditor Officer inspection workflows
- PDF/CSV reporting, QR equipment tags, contractor gate passes

## Local setup

See `backend/README.md` and `.env.example` for configuration. Never commit `.env` or production secrets.

> Deployment status: source scaffold only until database migrations, integration tests and a live environment are verified.
