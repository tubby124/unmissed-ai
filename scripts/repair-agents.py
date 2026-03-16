#!/usr/bin/env python3
"""
repair-agents.py
Repairs the 3 existing Ultravox draft agents by PATCHing them with the correct callTemplate.
Also restores ultravox_agent_id in Supabase for each client.
"""

import json
import urllib.request
import urllib.error
import sys

ULTRAVOX_API_KEY = "4FowyUSm.ZEkda8oOwMgWl8HUGMBnSegpOGjU3acw"
SUPABASE_URL     = "https://qwhvblomlgeapzhnuwlb.supabase.co"
SUPABASE_KEY     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3aHZibG9tbGdlYXB6aG51d2xiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk0Nzk2OSwiZXhwIjoyMDg4NTIzOTY5fQ.XvgQznENIOtDjFhjRVItFlULchbPQoIlgElBZCUVNbE"
DEFAULT_VOICE    = "aa601962-1cbd-4bbd-9d96-3c7a93c3414a"
UV_BASE          = "https://api.ultravox.ai/api"

CLIENTS = [
    {"slug": "hasan-sharif",  "agent_id": "f19b4ad7-233e-4125-a547-94e007238cf8"},
    {"slug": "urban-vibe",    "agent_id": "5f88f03b-5aaf-40fc-a608-2f7ed765d6a6"},
    {"slug": "windshield-hub","agent_id": "00652ba8-5580-4632-97be-0fd2090bbb71"},
]

DEFAULT_VAD = {
    "turnEndpointDelay": "0.64s",
    "minimumTurnDuration": "0.1s",
    "minimumInterruptionDuration": "0.2s",
}

DEFAULT_INACTIVITY = [
    {"duration": "8s",  "message": "Hello? You still there?"},
    {"duration": "15s", "message": "I'll let you go — feel free to call back anytime. Bye!"},
]

def http(method, url, headers, data=None):
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw.decode(errors="replace")}

def supabase_get(path, params=""):
    status, body = http("GET",
        f"{SUPABASE_URL}/rest/v1/{path}?{params}",
        {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    )
    return status, body

def supabase_patch(path, data):
    status, body = http("PATCH",
        f"{SUPABASE_URL}/rest/v1/{path}",
        {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        data
    )
    return status, body

def uv_patch(agent_id, data):
    status, body = http("PATCH",
        f"{UV_BASE}/agents/{agent_id}",
        {"X-API-Key": ULTRAVOX_API_KEY, "Content-Type": "application/json"},
        data
    )
    return status, body

def uv_get(agent_id):
    status, body = http("GET",
        f"{UV_BASE}/agents/{agent_id}",
        {"X-API-Key": ULTRAVOX_API_KEY}
    )
    return status, body

def repair(slug, agent_id):
    print(f"\n=== {slug} (agentId: {agent_id}) ===")

    # 1. Fetch client data from Supabase
    status, rows = supabase_get("clients", f"slug=eq.{slug}&select=id,system_prompt,agent_voice_id")
    if status != 200 or not rows:
        print(f"  ERROR: Supabase fetch failed (HTTP {status}): {rows}")
        return False

    row        = rows[0]
    client_id  = row["id"]
    prompt     = row.get("system_prompt") or ""
    voice      = row.get("agent_voice_id") or DEFAULT_VOICE

    if not prompt:
        print(f"  ERROR: system_prompt is empty — skipping")
        return False

    print(f"  client_id : {client_id}")
    print(f"  prompt    : {len(prompt)} chars")
    print(f"  voice     : {voice}")

    # 2. Append {{callerContext}} if not already present
    if "{{callerContext}}" not in prompt:
        prompt += "\n\n{{callerContext}}"

    # 3. PATCH the agent with correct callTemplate
    print(f"  PATCHing agent...")
    patch_payload = {
        "callTemplate": {
            "systemPrompt": prompt,
            "model": "ultravox-v0.7",
            "voice": voice,
            "maxDuration": "600s",
            "medium": {"twilio": {}},
            "recordingEnabled": True,
            "inactivityMessages": DEFAULT_INACTIVITY,
            "timeExceededMessage": "I need to wrap up — feel free to call back or text this number. Bye!",
            "vadSettings": DEFAULT_VAD,
            "contextSchema": {
                "type": "object",
                "properties": {"callerContext": {"type": "string"}},
            },
        }
    }

    status, body = uv_patch(agent_id, patch_payload)
    if status != 200:
        print(f"  ERROR: PATCH failed (HTTP {status}): {body}")
        return False

    published = body.get("publishedRevisionId")
    print(f"  publishedRevisionId: {published}")

    if not published or published == "null":
        print(f"  WARNING: publishedRevisionId is still null — callTemplate may have been rejected")
        return False

    # 4. Restore ultravox_agent_id in Supabase
    status, _ = supabase_patch(f"clients?id=eq.{client_id}", {"ultravox_agent_id": agent_id})
    if status in (200, 204):
        print(f"  Supabase: ultravox_agent_id restored ✓")
    else:
        print(f"  WARNING: Supabase update returned HTTP {status}")

    print(f"  ✓ {slug} REPAIRED")
    return True

def smoke_test(agent_id, slug):
    """Verify agent is callable by fetching its current state."""
    print(f"\n  [smoke] GET agent {agent_id}...")
    status, body = uv_get(agent_id)
    if status != 200:
        print(f"  [smoke] ERROR: HTTP {status}")
        return

    published = body.get("publishedRevisionId")
    name      = body.get("name")
    stats     = body.get("statistics", {})
    ct        = body.get("callTemplate") or {}
    has_prompt = bool(ct.get("systemPrompt"))
    has_voice  = bool(ct.get("voice"))

    print(f"  [smoke] name              : {name}")
    print(f"  [smoke] publishedRevision : {published}")
    print(f"  [smoke] callTemplate.systemPrompt : {'✓ present' if has_prompt else '✗ MISSING'}")
    print(f"  [smoke] callTemplate.voice        : {'✓ present' if has_voice else '✗ MISSING'}")
    print(f"  [smoke] statistics.calls          : {stats.get('calls', 0)}")
    print(f"  [smoke] callable                  : {'✓ YES' if published else '✗ NO (still draft)'}")

print("=" * 60)
print("Ultravox Agent Repair + Smoke Test")
print("=" * 60)

results = {}
for c in CLIENTS:
    results[c["slug"]] = repair(c["slug"], c["agent_id"])

print("\n" + "=" * 60)
print("Smoke Tests")
print("=" * 60)
for c in CLIENTS:
    smoke_test(c["agent_id"], c["slug"])

print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
all_ok = True
for slug, ok in results.items():
    icon = "✓" if ok else "✗"
    print(f"  {icon} {slug}")
    if not ok:
        all_ok = False

sys.exit(0 if all_ok else 1)
