#!/usr/bin/env bash
# repair-agents.sh
# Repairs existing Ultravox draft agents by PATCHing them with each client's
# stored callTemplate, then restores ultravox_agent_id in Supabase.
#
# Usage:
#   ULTRAVOX_API_KEY=... \
#   NEXT_PUBLIC_SUPABASE_URL=... \
#   SUPABASE_SERVICE_ROLE_KEY=... \
#   bash scripts/repair-agents.sh

set -euo pipefail

ULTRAVOX_API_KEY="${ULTRAVOX_API_KEY:?Set ULTRAVOX_API_KEY}"
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:?Set NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY}"
DEFAULT_VOICE="${DEFAULT_VOICE:-aa601962-1cbd-4bbd-9d96-3c7a93c3414a}"
UV_BASE="${ULTRAVOX_BASE:-https://api.ultravox.ai/api}"

declare -A AGENT_IDS=(
  ["hasan-sharif"]="f19b4ad7-233e-4125-a547-94e007238cf8"
  ["urban-vibe"]="5f88f03b-5aaf-40fc-a608-2f7ed765d6a6"
  ["windshield-hub"]="00652ba8-5580-4632-97be-0fd2090bbb71"
)

json_value() {
  python3 -c "$1"
}

repair_client() {
  local SLUG="$1"
  local AGENT_ID="${AGENT_IDS[$SLUG]}"

  echo ""
  echo "=== Repairing: $SLUG (agentId: $AGENT_ID) ==="
  echo "  Fetching client data from Supabase..."

  CLIENT_JSON=$(curl -sf \
    "${SUPABASE_URL}/rest/v1/clients?slug=eq.${SLUG}&select=id,system_prompt,agent_voice_id" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}")

  CLIENT_COUNT=$(echo "$CLIENT_JSON" | json_value "import sys,json; print(len(json.load(sys.stdin)))")
  if [ "$CLIENT_COUNT" -ne 1 ]; then
    echo "  ERROR: expected exactly one client row for $SLUG, got $CLIENT_COUNT"
    return 1
  fi

  CLIENT_ID=$(echo "$CLIENT_JSON" | json_value "import sys,json; d=json.load(sys.stdin); print(d[0]['id'])")
  SYSTEM_PROMPT=$(echo "$CLIENT_JSON" | json_value "import sys,json; d=json.load(sys.stdin); print(d[0]['system_prompt'] or '')")
  VOICE=$(echo "$CLIENT_JSON" | DEFAULT_VOICE="$DEFAULT_VOICE" json_value "import os,sys,json; d=json.load(sys.stdin); print(d[0]['agent_voice_id'] or os.environ['DEFAULT_VOICE'])")

  if [ -z "$SYSTEM_PROMPT" ]; then
    echo "  ERROR: No system_prompt found for $SLUG"
    return 1
  fi

  echo "  Client ID: $CLIENT_ID"
  echo "  Prompt length: ${#SYSTEM_PROMPT} chars"
  echo "  Voice: $VOICE"
  echo "  PATCHing Ultravox agent ${AGENT_ID}..."

  PATCH_BODY=$(VOICE="$VOICE" python3 -c '
import json
import os
import sys

system_prompt = sys.stdin.read()
if "{{callerContext}}" not in system_prompt:
    system_prompt = system_prompt + "\n\n{{callerContext}}"

payload = {
    "callTemplate": {
        "systemPrompt": system_prompt,
        "model": "ultravox-v0.7",
        "voice": os.environ["VOICE"],
        "maxDuration": "600s",
        "medium": {"twilio": {}},
        "recordingEnabled": True,
        "inactivityMessages": [
            {"duration": "8s", "message": "Hello? You still there?"},
            {"duration": "15s", "message": "I'\''ll let you go — feel free to call back anytime. Bye!"},
        ],
        "timeExceededMessage": "I need to wrap up — feel free to call back or text this number. Bye!",
        "vadSettings": {
            "turnEndpointDelay": "0.64s",
            "minimumTurnDuration": "0.1s",
            "minimumInterruptionDuration": "0.2s",
        },
        "contextSchema": {
            "type": "object",
            "properties": {"callerContext": {"type": "string"}},
        },
    }
}
print(json.dumps(payload))
' <<< "$SYSTEM_PROMPT")

  PATCH_RESPONSE=$(curl -sf -w "\n%{http_code}" \
    "${UV_BASE}/agents/${AGENT_ID}" \
    -X PATCH \
    -H "X-API-Key: ${ULTRAVOX_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$PATCH_BODY")

  HTTP_CODE=$(echo "$PATCH_RESPONSE" | tail -1)
  BODY=$(echo "$PATCH_RESPONSE" | head -1)

  if [ "$HTTP_CODE" != "200" ]; then
    echo "  ERROR: PATCH failed with HTTP $HTTP_CODE"
    echo "  Response: $BODY"
    return 1
  fi

  PUBLISHED_REVISION=$(echo "$BODY" | json_value "import sys,json; d=json.load(sys.stdin); print(d.get('publishedRevisionId', 'NULL'))")
  echo "  Patch OK. publishedRevisionId: $PUBLISHED_REVISION"

  if [ "$PUBLISHED_REVISION" = "NULL" ] || [ "$PUBLISHED_REVISION" = "None" ]; then
    echo "  WARNING: publishedRevisionId is still null"
    return 1
  fi

  echo "  Restoring ultravox_agent_id in Supabase..."
  UPDATE_RESPONSE=$(curl -sf -w "\n%{http_code}" \
    "${SUPABASE_URL}/rest/v1/clients?id=eq.${CLIENT_ID}" \
    -X PATCH \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"ultravox_agent_id\": \"${AGENT_ID}\"}")

  UPDATE_CODE=$(echo "$UPDATE_RESPONSE" | tail -1)
  if [ "$UPDATE_CODE" = "204" ] || [ "$UPDATE_CODE" = "200" ]; then
    echo "  Supabase updated. ultravox_agent_id restored for slug=$SLUG"
  else
    echo "  WARNING: Supabase update returned HTTP $UPDATE_CODE"
  fi

  echo "  === $SLUG REPAIRED ==="
}

echo "Ultravox Agent Repair Script"
echo "============================"

for SLUG in "hasan-sharif" "urban-vibe" "windshield-hub"; do
  repair_client "$SLUG" || echo "  FAILED to repair $SLUG — check errors above"
done

echo ""
echo "Done. Verify agents with:"
echo "  curl -s https://api.ultravox.ai/api/agents/f19b4ad7-233e-4125-a547-94e007238cf8 -H 'X-API-Key: \$ULTRAVOX_API_KEY' | python3 -m json.tool | grep publishedRevisionId"
