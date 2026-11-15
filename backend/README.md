# SafetyOS API

## Start locally
1. Copy root .env.example to .env and set POSTGRES_PASSWORD.
2. Copy backend/.env.example to backend/.env.
3. Generate distinct JWT_SECRET and QR_HMAC_SECRET values (each at least 32 random bytes); set DATABASE_URL to use the same database password as POSTGRES_PASSWORD.
4. Set a unique BOOTSTRAP_ADMIN_PASSWORD of at least 14 characters.
5. Run docker compose up -d --build.
6. Run docker compose exec api npm run migrate and docker compose exec api npm run seed.
7. Open http://localhost:8080.

The migration targets a new database. Back up and review before applying to any existing database.
