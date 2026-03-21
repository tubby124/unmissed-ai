#!/usr/bin/env bash
# reset-test-calls.sh — Wipe test call data so returning-caller context is clean
#
# Usage:
#   bash scripts/reset-test-calls.sh                    # resets +13068507687 (default)
#   bash scripts/reset-test-calls.sh +14031234567       # resets a specific number
#   bash scripts/reset-test-calls.sh all hasan-sharif   # resets ALL calls for a client

set -euo pipefail

source ~/.secrets 2>/dev/null || true

SUPABASE_URL="https://qwhvblomlgeapzhnuwlb.supabase.co"
SUPABASE_KEY="${SUPABASE_SERVICE_KEY:-}"

if [[ -z "$SUPABASE_KEY" ]]; then
  echo "ERROR: SUPABASE_SERVICE_KEY not set. Run: source ~/.secrets"
  exit 1
fi

PHONE="${1:-+13068507687}"
CLIENT_SLUG="${2:-hasan-sharif}"

run_sql() {
  local sql="$1"
  curl -s -X POST \
    "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$sql" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}" \
    2>/dev/null || true
}

# Use psql via Supabase connection string if available, otherwise use REST
PG_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD:-}@db.qwhvblomlgeapzhnuwlb.supabase.co:5432/postgres"

reset_via_psql() {
  local where="$1"
  psql "$PG_URL" -q <<SQL
UPDATE call_logs
SET caller_name   = NULL,
    ai_summary    = NULL,
    key_topics    = NULL,
    next_steps    = NULL,
    sentiment     = NULL,
    confidence    = NULL,
    call_status   = 'COLD'
WHERE ${where};
SELECT 'Reset complete — ' || count(*) || ' rows cleared'
FROM call_logs
WHERE ${where};
SQL
}

# Build WHERE clause
if [[ "$PHONE" == "all" ]]; then
  SLUG="$CLIENT_SLUG"
  WHERE="client_id = (SELECT id FROM clients WHERE slug = '${SLUG}')"
  echo "Resetting ALL calls for client: ${SLUG}"
else
  WHERE="caller_phone = '${PHONE}'"
  echo "Resetting calls from: ${PHONE}"
fi

# Try psql first (fastest), fall back to Supabase MCP message
if command -v psql &>/dev/null && [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  reset_via_psql "$WHERE"
else
  # Fallback: print the SQL for manual run
  echo ""
  echo "Run this in Supabase SQL editor:"
  echo "---"
  cat <<SQL
UPDATE call_logs
SET caller_name   = NULL,
    ai_summary    = NULL,
    key_topics    = NULL,
    next_steps    = NULL,
    sentiment     = NULL,
    confidence    = NULL,
    call_status   = 'COLD'
WHERE ${WHERE};
SQL
  echo "---"
  echo "Or use: claude 'reset test calls from ${PHONE}'"
fi
