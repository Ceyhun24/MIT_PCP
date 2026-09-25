#!/usr/bin/env bash
# Runs the database migrations and permission tests on a LOCAL Postgres+PostGIS
# (not on Supabase). Needs: psql and a server reachable via $TEST_DATABASE_URL,
# e.g. postgres://postgres@localhost:5432/postgres
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a local Postgres (superuser) connection string}"
DB=centers_test
psql "$TEST_DATABASE_URL" -qc "drop database if exists $DB" -c "create database $DB"
URL="${TEST_DATABASE_URL%/*}/$DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "Applying $f"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f"
done
psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/01_rls_test.sql
