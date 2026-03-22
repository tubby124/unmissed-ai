#!/bin/bash
# S18e: Post-deploy smoke test — run after every Railway deploy.
# Usage: APP_URL=https://your-app.up.railway.app CRON_SECRET=xxx bash scripts/smoke-test.sh

set -euo pipefail

APP_URL="${APP_URL:-https://unmissed-ai-production.up.railway.app}"
CRON_SECRET="${CRON_SECRET:-}"
FAILURES=0
CHECKS=0

pass() { CHECKS=$((CHECKS + 1)); echo "  PASS: $1"; }
fail() { CHECKS=$((CHECKS + 1)); FAILURES=$((FAILURES + 1)); echo "  FAIL: $1"; }

echo "=== Smoke Test: ${APP_URL} ==="
echo ""

# ── 1. Health endpoint ───────────────────────────────────────────────────────
echo "[1] Health endpoint"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/api/health" 2>/dev/null || echo "000")
if [ "$STATUS" = "200" ]; then pass "/api/health → 200"; else fail "/api/health → ${STATUS} (expected 200)"; fi

# ── 2. Cron routes accept correct method + auth ──────────────────────────────
echo "[2] Cron routes (method + auth)"

if [ -n "$CRON_SECRET" ]; then
  CRON_ROUTES=(
    "POST|/api/cron/reset-minutes"
    "POST|/api/cron/analyze-calls"
    "POST|/api/cron/follow-up-reminders"
    "POST|/api/cron/trial-expiry"
    "POST|/api/cron/daily-digest"
    "GET|/api/cron/notification-health"
  )

  for ROUTE_SPEC in "${CRON_ROUTES[@]}"; do
    METHOD="${ROUTE_SPEC%%|*}"
    ROUTE="${ROUTE_SPEC##*|}"

    if [ "$METHOD" = "GET" ]; then
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${CRON_SECRET}" "${APP_URL}${ROUTE}" 2>/dev/null || echo "000")
    else
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer ${CRON_SECRET}" "${APP_URL}${ROUTE}" 2>/dev/null || echo "000")
    fi

    if [ "$STATUS" != "405" ]; then
      pass "${ROUTE} ${METHOD} → ${STATUS} (not 405)"
    else
      fail "${ROUTE} ${METHOD} → 405 (method mismatch)"
    fi
  done
else
  echo "  SKIP: CRON_SECRET not set — skipping cron route checks"
fi

# ── 3. Native Ultravox webhook handler reachable ─────────────────────────────
echo "[3] Ultravox webhook handler"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/api/webhook/ultravox" 2>/dev/null || echo "000")
# GET on a POST-only route returns 405, which proves the handler exists
if [ "$STATUS" = "200" ] || [ "$STATUS" = "405" ] || [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
  pass "/api/webhook/ultravox → ${STATUS} (handler exists)"
else
  fail "/api/webhook/ultravox → ${STATUS} (handler missing?)"
fi

# ── 4. Auth-required endpoint rejects unauthenticated requests ───────────────
echo "[4] Auth-required endpoint (should reject)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/api/dashboard/activity" 2>/dev/null || echo "000")
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ] || [ "$STATUS" = "307" ]; then
  pass "/api/dashboard/activity → ${STATUS} (auth enforced)"
else
  fail "/api/dashboard/activity → ${STATUS} (expected 401/403/307)"
fi

# ── 5. Public pages return 200 ───────────────────────────────────────────────
echo "[5] Public pages"
PUBLIC_PAGES=("/" "/login" "/pricing" "/try")
for PAGE in "${PUBLIC_PAGES[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}${PAGE}" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then pass "${PAGE} → 200"; else fail "${PAGE} → ${STATUS} (expected 200)"; fi
done

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "=== Results: ${CHECKS} checks, ${FAILURES} failures ==="

if [ "$FAILURES" -gt 0 ]; then
  echo "SMOKE TEST FAILED"
  exit 1
else
  echo "ALL CHECKS PASSED"
  exit 0
fi
