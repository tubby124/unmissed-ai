#!/usr/bin/env bash
# repair-agents.sh
# Repairs the 3 existing Ultravox draft agents by PATCHing them with the correct callTemplate.
# Also restores ultravox_agent_id in Supabase for each client.
#
# Usage: bash scripts/repair-agents.sh
# Run from: agent-app/ directory (or anywhere — uses hardcoded env)
#
# What it does:
#   1. Fetches each client's system_prompt + agent_voice_id from Supabase
#   2. PATCHes the existing Ultravox agent with the correct callTemplate (fixes draft → callable)
#   3. Restores ultravox_agent_id in Supabase clients table

set -euo pipefail

ULTRAVOX_API_KEY="4FowyUSm.ZEkda8oOwMgWl8HUGMBnSegpOGjU3acw"
SUPABASE_URL="https://qwhvblomlgeapzhnuwlb.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3aHZibG9tbGdlYXB6aG51d2xiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk0Nzk2OSwiZXhwIjoyMDg4NTIzOTY5fQ.XvgQznENIOtDjFhjRVItFlULchbPQoIlgElBZCUVNbE"
DEFAULT_VOICE="aa601962-1cbd-4bbd-9d96-3c7a93c3414a"
UV_BASE="https://api.ultravox.ai/api"

# Existing draft agent IDs (created earlier, now empty shells — will be repaired)
declare -A AGENT_IDS=(
  ["hasan-sharif"]="f19b4ad7-233e-4125-a547-94e007238cf8"
  ["urban-vibe"]="5f88f03b-5aaf-40fc-a608-2f7ed765d6a6"
  ["windshield-hub"]="00652ba8-5580-4632-97be-0fd2090bbb71"
)

repair_client() {
  local SLUG="$1"
  local AGENT_ID="${AGENT_IDS[$SLUG]}"

  echo ""
  echo "=== Repairing: $SLUG (agentId: $AGENT_ID) ==="

  # 1. Fetch client data from Supabase
  echo "  Fetching client data from Supabase..."
  CLIENT_JSON=$(curl -sf \
    "${SUPABASE_URL}/rest/v1/clients?slug=eq.${SLUG}&select=id,system_prompt,agent_voice_id" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}")

  CLIENT_ID=$(echo "$CLIENT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'])")
  SYSTEM_PROMPT=$(echo "$CLIENT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['system_prompt'] or '')")
  VOICE=$(echo "$CLIENT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d[0]['agent_voice_id']; print(v if v else '${DEFAULT_VOICE}')")

  if [ -z "$SYSTEM_PROMPT" ]; then
    echo "  ERROR: No system_prompt found for $SLUG — skipping"
    return 1
  fi

  echo "  Client ID: $CLIENT_ID"
  echo "  Prompt length: ${#SYSTEM_PROMPT} chars"
  echo "  Voice: $VOICE"

  # 2. PATCH the agent with correct callTemplate structure
  echo "  PATCHing Ultravox agent ${AGENT_ID}..."
  PATCH_BODY=$(python3 -c "
import json, sys

system_prompt = sys.stdin.read()
# Append {{callerContext}} placeholder if not already present
if '{{callerContext}}' not in system_prompt:
    system_prompt = system_prompt + '\n\n{{callerContext}}'

payload = {
    'callTemplate': {
        'systemPrompt': system_prompt,
        'model': 'ultravox-v0.7',
        'voice': '${VOICE}',
        'maxDuration': '600s',
        'medium': {'twilio': {}},
        'recordingEnabled': True,
        'inactivityMessages': [
            {'duration': '8s', 'message': 'Hello? You still there?'},
            {'duration': '15s', 'message': \"I'll let you go — feel free to call back anytime. Bye!\"}
        ],
        'timeExceededMessage': \"I need to wrap up — feel free to call back or text this number. Bye!\",
        'vadSettings': {
            'turnEndpointDelay': '0.64s',
            'minimumTurnDuration': '0.1s',
            'minimumInterruptionDuration': '0.2s'
        },
        'contextSchema': {
            'type': 'object',
            'properties': {
                'callerContext': {'type': 'string'}
            }
        }
    }
}
print(json.dumps(payload))
" <<< "$SYSTEM_PROMPT")

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

  PUBLISHED_REVISION=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('publishedRevisionId', 'NULL'))")
  echo "  Patch OK. publishedRevisionId: $PUBLISHED_REVISION"

  if [ "$PUBLISHED_REVISION" = "NULL" ] || [ "$PUBLISHED_REVISION" = "None" ]; then
    echo "  WARNING: publishedRevisionId is still null — callTemplate may have been rejected"
    return 1
  fi

  # 3. Restore ultravox_agent_id in Supabase
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
    echo "  Supabase updated. ultravox_agent_id = $AGENT_ID restored for slug=$SLUG"
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
echo "Done. Verify agents by calling:"
echo "  curl -s https://api.ultravox.ai/api/agents/f19b4ad7-233e-4125-a547-94e007238cf8 -H 'X-API-Key: ${ULTRAVOX_API_KEY}' | python3 -m json.tool | grep publishedRevisionId"
