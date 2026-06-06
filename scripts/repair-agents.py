#!/usr/bin/env python3
"""
repair-agents.py
Repairs existing Ultravox draft agents by PATCHing them with each client's
stored callTemplate, then restores ultravox_agent_id in Supabase.

Required env:
  ULTRAVOX_API_KEY
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import json
import os
import sys
import urllib.error
import urllib.request


ULTRAVOX_API_KEY = os.environ["ULTRAVOX_API_KEY"]
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DEFAULT_VOICE = os.environ.get("DEFAULT_VOICE", "aa601962-1cbd-4bbd-9d96-3c7a93c3414a")
UV_BASE = os.environ.get("ULTRAVOX_BASE", "https://api.ultravox.ai/api").rstrip("/")

CLIENTS = [
    {"slug": "hasan-sharif", "agent_id": "f19b4ad7-233e-4125-a547-94e007238cf8"},
    {"slug": "urban-vibe", "agent_id": "5f88f03b-5aaf-40fc-a608-2f7ed765d6a6"},
    {"slug": "windshield-hub", "agent_id": "00652ba8-5580-4632-97be-0fd2090bbb71"},
]

DEFAULT_VAD = {
    "turnEndpointDelay": "0.64s",
    "minimumTurnDuration": "0.1s",
    "minimumInterruptionDuration": "0.2s",
}

DEFAULT_INACTIVITY = [
    {"duration": "8s", "message": "Hello? You still there?"},
    {"duration": "15s", "message": "I'll let you go — feel free to call back anytime. Bye!"},
]


def http(method, url, headers, data=None):
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            return error.code, json.loads(raw)
        except Exception:
            return error.code, {"raw": raw.decode(errors="replace")}


def supabase_get(path, params=""):
    return http(
        "GET",
        f"{SUPABASE_URL}/rest/v1/{path}?{params}",
        {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
    )


def supabase_patch(path, data):
    return http(
        "PATCH",
        f"{SUPABASE_URL}/rest/v1/{path}",
        {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        data,
    )


def uv_patch(agent_id, data):
    return http(
        "PATCH",
        f"{UV_BASE}/agents/{agent_id}",
        {"X-API-Key": ULTRAVOX_API_KEY, "Content-Type": "application/json"},
        data,
    )


def uv_get(agent_id):
    return http(
        "GET",
        f"{UV_BASE}/agents/{agent_id}",
        {"X-API-Key": ULTRAVOX_API_KEY},
    )


def repair(slug, agent_id):
    print(f"\n=== {slug} (agentId: {agent_id}) ===")

    status, rows = supabase_get("clients", f"slug=eq.{slug}&select=id,system_prompt,agent_voice_id")
    if status != 200 or not rows:
        print(f"  ERROR: Supabase fetch failed (HTTP {status}): {rows}")
        return False

    if len(rows) != 1:
        print(f"  ERROR: expected one client row, got {len(rows)}")
        return False

    row = rows[0]
    client_id = row["id"]
    prompt = row.get("system_prompt") or ""
    voice = row.get("agent_voice_id") or DEFAULT_VOICE

    if not prompt:
        print("  ERROR: system_prompt is empty")
        return False

    print(f"  client_id : {client_id}")
    print(f"  prompt    : {len(prompt)} chars")
    print(f"  voice     : {voice}")

    if "{{callerContext}}" not in prompt:
        prompt += "\n\n{{callerContext}}"

    print("  PATCHing agent...")
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
        print("  WARNING: publishedRevisionId is still null")
        return False

    status, _ = supabase_patch(f"clients?id=eq.{client_id}", {"ultravox_agent_id": agent_id})
    if status in (200, 204):
        print("  Supabase: ultravox_agent_id restored")
    else:
        print(f"  WARNING: Supabase update returned HTTP {status}")

    print(f"  {slug} repaired")
    return True


def smoke_test(agent_id):
    print(f"\n  [smoke] GET agent {agent_id}...")
    status, body = uv_get(agent_id)
    if status != 200:
        print(f"  [smoke] ERROR: HTTP {status}")
        return

    published = body.get("publishedRevisionId")
    name = body.get("name")
    stats = body.get("statistics", {})
    call_template = body.get("callTemplate") or {}

    print(f"  [smoke] name              : {name}")
    print(f"  [smoke] publishedRevision : {published}")
    print(f"  [smoke] systemPrompt      : {'present' if call_template.get('systemPrompt') else 'MISSING'}")
    print(f"  [smoke] voice             : {'present' if call_template.get('voice') else 'MISSING'}")
    print(f"  [smoke] statistics.calls  : {stats.get('calls', 0)}")
    print(f"  [smoke] callable          : {'YES' if published else 'NO'}")


print("=" * 60)
print("Ultravox Agent Repair + Smoke Test")
print("=" * 60)

results = {client["slug"]: repair(client["slug"], client["agent_id"]) for client in CLIENTS}

print("\n" + "=" * 60)
print("Smoke Tests")
print("=" * 60)
for client in CLIENTS:
    smoke_test(client["agent_id"])

print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
all_ok = True
for slug, ok in results.items():
    print(f"  {'OK' if ok else 'FAIL'} {slug}")
    all_ok = all_ok and ok

sys.exit(0 if all_ok else 1)
