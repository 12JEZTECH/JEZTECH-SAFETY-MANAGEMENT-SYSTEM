#!/usr/bin/env bash
set -euo pipefail
[[ -f .env ]] || cp .env.example .env
[[ -f backend/.env ]] || cp backend/.env.example backend/.env
echo "Edit .env and backend/.env now. Set matching database password and unique secrets."
echo "Then run: docker compose up -d --build && docker compose exec api npm run migrate && docker compose exec api npm run seed"
