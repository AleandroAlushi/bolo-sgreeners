#!/usr/bin/env bash
# Ricrea il database locale di test e applica shim + migrations.
# Uso: PGHOST=/tmp PGPORT=54329 scripts/local-db/reset.sh
set -euo pipefail
DB=${PGDATABASE:-bolo}
cd "$(dirname "$0")/../.."
psql -U postgres -d postgres -qc "drop database if exists $DB with (force)" -qc "create database $DB"
psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f scripts/local-db/supabase-shim.sql
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f"
done
psql -U postgres -d "$DB" -qc "notify pgrst, 'reload schema'"
echo "Database $DB pronto."
