#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must be set}"
FILE="${1:?Usage: restore_postgres.sh path/to/backup.dump}"
[[ -f "$FILE" ]] || { echo "Backup not found: $FILE" >&2; exit 1; }
pg_restore --list "$FILE" >/dev/null
echo "WARNING: restore can replace database objects at DATABASE_URL."
read -r -p "Type RESTORE to continue: " CONFIRM
[[ "$CONFIRM" == "RESTORE" ]] || { echo "Restore cancelled."; exit 1; }
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$DATABASE_URL" "$FILE"
echo "Restore completed. Verify before reopening application access."
