#!/usr/bin/env python3
"""
prompt_status.py — Per-client prompt drift check for unmissed.ai

Usage:
  python3 scripts/prompt_status.py           # all clients
  python3 scripts/prompt_status.py urban-vibe windshield-hub  # specific clients

Output columns:
  client       | sb_ver | sb_hash         | uv_hash         | local_hash      | sync
  urban-vibe   | v6     | 58846c43b73bec67 | 58846c43b73bec67 | 58846c43b73bec67 | ✅
  windshield-h | v4     | df24076fe0ccbbce | df24076fe0ccbbce | df24076fe0ccbbce | ✅

Sync states:
  ✅            — all three match (local, Supabase, Ultravox live)
  ⚠ local-drift — Supabase ↔ Ultravox match, but local file differs (uncommitted edit)
  ⚠ uv-drift   — Supabase ↔ local match, but Ultravox live differs (failed deploy?)
  ❌ OUT-OF-SYNC — all three differ (prompt chaos)
  ⚠ no-local   — no local SYSTEM_PROMPT.txt (read-only check mode)
"""

import sys, json, hashlib, urllib.request, os

SUPABASE_URL = "https://qwhvblomlgeapzhnuwlb.supabase.co"


def _require_env(name):
    val = os.environ.get(name)
    if not val:
        print(f"ERROR: {name} env var not set. Export it in ~/.zshrc or pass inline.")
        sys.exit(1)
    return val


SUPABASE_KEY = _require_env("SUPABASE_SERVICE_KEY")
ULTRAVOX_KEY = _require_env("ULTRAVOX_API_KEY")

CLIENT_CONFIG = {
    "urban-vibe": {
        "ultravox_agent_id": "5f88f03b-5aaf-40fc-a608-2f7ed765d6a6",
        "local_dir": None,
    },
    "windshield-hub": {
        "ultravox_agent_id": "00652ba8-5580-4632-97be-0fd2090bbb71",
        "local_dir": None,
    },
    "hasan-sharif": {
        "ultravox_agent_id": "f19b4ad7-233e-4125-a547-94e007238cf8",
        "local_dir": None,
    },
    "exp-realty": {
        "ultravox_agent_id": "c9019927-49a7-4676-b97b-5c6395e58a37",
        "local_dir": None,
    },
    "true-color-display-printing-ltd": {
        "ultravox_agent_id": "ce4bbe2b-6f7d-4f32-b3ce-e9b044aeef3e",
        "local_dir": "true-color",
    },
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _hash(s):
    return hashlib.sha256((s or "").encode()).hexdigest()[:16]


def _sb_get(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def _uv_get(agent_id):
    url = f"https://api.ultravox.ai/api/agents/{agent_id}"
    req = urllib.request.Request(url, headers={"X-API-Key": ULTRAVOX_KEY})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def check_client(slug, cfg):
    local_dir = cfg.get("local_dir") or slug
    prompt_path = os.path.join(BASE_DIR, "clients", local_dir, "SYSTEM_PROMPT.txt")

    # Local file
    if os.path.exists(prompt_path):
        with open(prompt_path) as f:
            local_hash = _hash(f.read())
        has_local = True
    else:
        local_hash = "MISSING"
        has_local = False

    # Supabase
    rows = _sb_get(f"clients?slug=eq.{slug}&select=system_prompt,id")
    if not rows:
        return {"client": slug, "sb_ver": "?", "sb_hash": "NOT-IN-DB",
                "uv_hash": "?", "local_hash": local_hash, "sync": "❌ NOT-IN-DB"}

    sb_prompt = rows[0].get("system_prompt") or ""
    sb_hash = _hash(sb_prompt)
    client_id = rows[0]["id"]

    vers = _sb_get(f"prompt_versions?client_id=eq.{client_id}&is_active=eq.true&select=version,change_description")
    if vers:
        sb_ver = f"v{vers[0]['version']}"
        sb_desc = vers[0].get("change_description", "")[:40]
    else:
        sb_ver = "?"
        sb_desc = ""

    # Ultravox live
    try:
        uv_data = _uv_get(cfg["ultravox_agent_id"])
        uv_prompt = uv_data.get("callTemplate", {}).get("systemPrompt", "")
        uv_hash = _hash(uv_prompt)
    except Exception as e:
        uv_hash = f"ERR:{str(e)[:12]}"

    # Sync determination
    if sb_hash == uv_hash == local_hash:
        sync = "✅"
    elif not has_local:
        sync = "⚠ no-local"
    elif sb_hash == uv_hash:
        sync = "⚠ local-drift"     # local differs from Supabase/UV (uncommitted edit)
    elif sb_hash == local_hash:
        sync = "⚠ uv-drift"       # Supabase/local match but UV wasn't patched
    elif uv_hash == local_hash:
        sync = "⚠ sb-drift"       # UV/local match but Supabase wasn't updated
    else:
        sync = "❌ OUT-OF-SYNC"

    return {
        "client": slug,
        "sb_ver": sb_ver,
        "sb_desc": sb_desc,
        "sb_hash": sb_hash,
        "uv_hash": uv_hash,
        "local_hash": local_hash,
        "sync": sync,
    }


def main():
    slugs = sys.argv[1:] if len(sys.argv) > 1 else list(CLIENT_CONFIG.keys())

    print()
    print(f"{'client':<35} {'ver':<6} {'sb_hash':<18} {'uv_hash':<18} {'local_hash':<18} sync")
    print("-" * 108)

    any_issue = False
    for slug in slugs:
        cfg = CLIENT_CONFIG.get(slug)
        if not cfg:
            print(f"{slug:<35} {'?':<6} {'N/A':<18} {'N/A':<18} {'N/A':<18} NOT-IN-CONFIG")
            continue
        try:
            r = check_client(slug, cfg)
            print(f"{r['client']:<35} {r['sb_ver']:<6} {r['sb_hash']:<18} {r['uv_hash']:<18} {r['local_hash']:<18} {r['sync']}")
            if r["sync"] != "✅":
                any_issue = True
        except Exception as e:
            print(f"{slug:<35} {'?':<6} {'ERROR':<18} {'ERROR':<18} {'ERROR':<18} ❌ {e}")
            any_issue = True

    print()
    if any_issue:
        print("To fix drift: python3 scripts/deploy_prompt.py <slug> \"sync to latest local\"")
        print("To rollback:  python3 scripts/deploy_prompt.py <slug> --rollback N")
    else:
        print("All clients in sync.")
    print()


if __name__ == "__main__":
    main()
