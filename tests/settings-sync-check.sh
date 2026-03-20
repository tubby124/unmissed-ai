#!/usr/bin/env bash
#
# settings-sync-check.sh — 3-layer consistency check
#
# Checks three layers for every active client:
#   1. DB flags  — booking_enabled, sms_enabled, forwarding_number
#   2. Prompt text — system_prompt contains/lacks CALENDAR BOOKING FLOW
#   3. Ultravox agent tools — actual tools registered match DB flags
#
# Reports mismatches as FAIL lines. Exit 1 if any FAIL.
#
# Usage: bash tests/settings-sync-check.sh
# Requires: SUPABASE_SECRET_KEY, ULTRAVOX_API_KEY env vars
#
set -euo pipefail

: "${SUPABASE_SECRET_KEY:?Set SUPABASE_SECRET_KEY env var}"
: "${ULTRAVOX_API_KEY:?Set ULTRAVOX_API_KEY env var}"

exec python3 - "$@" << 'PYEOF'
import json, os, sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://qwhvblomlgeapzhnuwlb.supabase.co')
SUPABASE_KEY = os.environ['SUPABASE_SECRET_KEY']
ULTRAVOX_BASE = 'https://api.ultravox.ai/api'
ULTRAVOX_KEY = os.environ['ULTRAVOX_API_KEY']

pass_count = 0
fail_count = 0
warn_count = 0

def log_pass(msg):
    global pass_count
    print(f'  PASS: {msg}')
    pass_count += 1

def log_fail(msg):
    global fail_count
    print(f'  FAIL: {msg}')
    fail_count += 1

def log_warn(msg):
    global warn_count
    print(f'  WARN: {msg}')
    warn_count += 1

def fetch_json(url, headers):
    req = Request(url, headers=headers)
    with urlopen(req) as resp:
        return json.loads(resp.read())

# Fetch active clients
sb_headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
}
clients = fetch_json(
    f'{SUPABASE_URL}/rest/v1/clients?status=eq.active'
    '&select=slug,booking_enabled,sms_enabled,forwarding_number,'
    'system_prompt,ultravox_agent_id,corpus_enabled',
    sb_headers,
)

print(f'Checking {len(clients)} active clients...\n')

for c in clients:
    slug = c['slug']
    print(f'=== {slug} ===')

    booking = c.get('booking_enabled') or False
    sms = c.get('sms_enabled') or False
    fwd = c.get('forwarding_number') or ''
    prompt = c.get('system_prompt') or ''
    agent_id = c.get('ultravox_agent_id') or ''
    corpus = c.get('corpus_enabled') or False

    # ── Layer 1: DB flags <-> prompt text ────────────────────────────────
    has_cal_block = '# CALENDAR BOOKING FLOW' in prompt

    if booking and not has_cal_block:
        log_fail('booking_enabled=true but prompt lacks CALENDAR BOOKING FLOW')
    elif not booking and has_cal_block:
        log_fail('booking_enabled=false but prompt still has CALENDAR BOOKING FLOW')
    else:
        log_pass('booking flag <-> prompt calendar block')

    # ── Layer 2: DB flags <-> Ultravox agent tools ───────────────────────
    if not agent_id:
        log_warn('no ultravox_agent_id — skipping tool check')
        print()
        continue

    try:
        agent = fetch_json(
            f'{ULTRAVOX_BASE}/agents/{agent_id}',
            {'X-API-Key': ULTRAVOX_KEY},
        )
    except HTTPError as e:
        log_warn(f'Ultravox API error: {e.code}')
        print()
        continue

    ct = agent.get('callTemplate', {})
    tools = ct.get('selectedTools', [])
    tool_names = []
    for t in tools:
        if 'temporaryTool' in t:
            tool_names.append(t['temporaryTool'].get('modelToolName', ''))
        elif 'toolName' in t:
            tool_names.append(t['toolName'])

    # Calendar tools
    has_cal_tools = 'checkCalendarAvailability' in tool_names
    if booking and not has_cal_tools:
        log_fail('booking_enabled=true but Ultravox agent lacks calendar tools')
    elif not booking and has_cal_tools:
        log_fail('booking_enabled=false but Ultravox agent has calendar tools')
    else:
        log_pass('booking flag <-> Ultravox calendar tools')

    # SMS tools
    has_sms = 'sendTextMessage' in tool_names
    if sms and not has_sms:
        log_fail('sms_enabled=true but Ultravox agent lacks sendTextMessage')
    elif sms and has_sms:
        log_pass('sms_enabled=true <-> sendTextMessage tool')

    # Transfer tools
    has_transfer = 'transferCall' in tool_names
    if fwd and not has_transfer:
        log_fail('forwarding_number set but Ultravox agent lacks transferCall')
    elif fwd and has_transfer:
        log_pass('forwarding_number <-> transferCall tool')

    print()

print('-' * 40)
print(f'Results: {pass_count} PASS | {fail_count} FAIL | {warn_count} WARN')
if fail_count > 0:
    print('MISMATCHES DETECTED — fix before deploying')
    sys.exit(1)
PYEOF
