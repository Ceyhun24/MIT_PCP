#!/usr/bin/env bash
# Test-only: builds a local database with FAKE "TEST" listings and serves it
# the way Supabase does, so the site can be run and tested without a Supabase
# account. Real use goes through Supabase.
#
# Needs: psql, a local Postgres+PostGIS ($TEST_DATABASE_URL, superuser),
# the PostgREST binary ($POSTGREST_BIN) and, for sign-in, the Supabase Auth
# (GoTrue) binary ($GOTRUE_BIN) with its "migrations" folder next to it.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL}"
: "${POSTGREST_BIN:?Set POSTGREST_BIN to the postgrest executable}"
DB=kurstap_dev
URL="${TEST_DATABASE_URL%/*}/$DB"
psql "$TEST_DATABASE_URL" -qc "drop database if exists $DB with (force)" -c "create database $DB"
psql "$URL" -q -c "do \$\$ begin create role supabase_auth_admin login superuser; exception when duplicate_object then null; end \$\$;"

if [ -n "${GOTRUE_BIN:-}" ]; then
  # Let Supabase Auth create its own "auth" schema first, like on Supabase.
  GOTRUE_DB_URI="$(echo "$URL" | sed -E 's#//[^@/]*@#//supabase_auth_admin@#')"
  [[ "$GOTRUE_DB_URI" == *\?* ]] && GOTRUE_DB_URI="$GOTRUE_DB_URI&search_path=auth" || GOTRUE_DB_URI="$GOTRUE_DB_URI?search_path=auth"
  psql "$URL" -q -c "create schema if not exists auth authorization supabase_auth_admin"
  (cd "$(dirname "$GOTRUE_BIN")" && GOTRUE_DB_DRIVER=postgres DATABASE_URL="$GOTRUE_DB_URI" GOTRUE_JWT_SECRET=x API_EXTERNAL_URL=http://localhost GOTRUE_SITE_URL=http://localhost "$GOTRUE_BIN" migrate >/dev/null)
  export GOTRUE_DB_URI
fi

psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f"; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/02_dev_fixtures.sql
psql "$URL" -q -c "do \$\$ begin create role authenticator login noinherit; exception when duplicate_object then null; end \$\$;" \
  -c "grant anon, authenticated, service_role to authenticator"
DEV_DB_URI="$(echo "$URL" | sed -E 's#//[^@/]*@#//authenticator@#')" node scripts/dev/local-supabase.mjs
