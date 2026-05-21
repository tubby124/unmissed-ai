#!/bin/bash
# Schemathesis fuzz + idempotency suite for unmissed.ai.
#
# Required env (loaded from .env.local or CI secrets):
#   BASE_URL                       default http://localhost:3000
#   SCHEMATHESIS_AUTH_COOKIE       Supabase session cookie (sb-access-token=...)
#   SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY
#   TEST_CLIENT_ID                 UUID of the fuzz target client
#   TEST_CLIENT_SLUG               slug of the fuzz target client
#   TEST_ULTRAVOX_AGENT_ID         agent id to verify sync against
#   ULTRAVOX_API_KEY
#   TWILIO_AUTH_TOKEN              for the idempotency suite
set -euo pipefail

cd "$(dirname "$0")"

BASE_URL="${BASE_URL:-http://localhost:3000}"

# Round-trip + property-based fuzz against the OpenAPI surface.
# --checks=all turns on the built-in checks (status codes, content type,
# response schema) in addition to the custom settings_patch_landed check
# registered in conftest.py.
schemathesis run openapi.yaml \
  --base-url="${BASE_URL}" \
  --checks=all \
  --hypothesis-deadline=10000 \
  --max-examples=50 \
  --hypothesis-suppress-health-check=too_slow \
  --header "Cookie: ${SCHEMATHESIS_AUTH_COOKIE:-}"

# Static idempotency + auth-gap regression assertions.
pytest test_idempotency.py -v
