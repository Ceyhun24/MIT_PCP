#!/usr/bin/env bash
# Test-only: builds a local database with FAKE "TEST" listings and serves it
# the way Supabase does (PostgREST behind /rest/v1), so the site can be run
# and tested without a Supabase account. Real use goes through Supabase.
#
# Needs: psql, a local Postgres+PostGIS ($TEST_DATABASE_URL, superuser) and
# the PostgREST binary ($POSTGREST_BIN).
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL}"
: "${POSTGREST_BIN:?Set POSTGREST_BIN to the postgrest executable}"
DB=kurstap_dev
URL="${TEST_DATABASE_URL%/*}/$DB"
psql "$TEST_DATABASE_URL" -qc "drop database if exists $DB with (force)" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f"; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/02_dev_fixtures.sql
psql "$URL" -q -c "do \$\$ begin create role authenticator login noinherit; exception when duplicate_object then null; end \$\$;" \
  -c "grant anon, authenticated, service_role to authenticator"
DEV_DB_URI="$(echo "$URL" | sed -E 's#//[^@/]*@#//authenticator@#')" node scripts/dev/local-supabase.mjs
