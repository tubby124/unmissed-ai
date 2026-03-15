#!/usr/bin/env python3
"""
deploy_prompt.py — Versioned prompt deploy for unmissed.ai clients

Usage:
  python3 scripts/deploy_prompt.py <slug> "<change description>"

Example:
  python3 scripts/deploy_prompt.py urban-vibe "Fixed greeting pause, switched to Ashley voice, added silence handler"

What it does:
  1. Reads clients/<slug>/SYSTEM_PROMPT.txt
  2. Inserts a new row in prompt_versions (auto-increments version number)
  3. Marks previous version inactive
  4. Updates clients.system_prompt + clients.active_prompt_version_id
  5. PATCHes the Ultravox agent
  6. Appends to clients/<slug>/PROMPT_CHANGELOG.md
"""

import sys, json, hashlib, datetime, urllib.request, urllib.error, os

# ── Config ──────────────────────────────────────────────────────────────────

SUPABASE_URL = "https://qwhvblomlgeapzhnuwlb.supabase.co"

def _require_env(name):
    val = os.environ.get(name)
    if not val:
        print(f"ERROR: {name} env var not set. Export it in ~/.zshrc or pass inline.")
        sys.exit(1)
    return val

SUPABASE_KEY = _require_env("SUPABASE_SERVICE_KEY")
ULTRAVOX_KEY = _require_env("ULTRAVOX_API_KEY")

# Per-client Ultravox settings — add new clients here
CLIENT_CONFIG = {
    "urban-vibe": {
        "ultravox_agent_id": "5f88f03b-5aaf-40fc-a608-2f7ed765d6a6",
        "voice": "aa601962-1cbd-4bbd-9d96-3c7a93c3414a",  # Jacqueline (confirmed Mar 11)
        "greeting": "Thanks for calling Urban Vibe Properties — I'm Alisha, Ray's virtual assistant. How can I help?",
        "vad_min_interruption": "0.400s",
    },
    "windshield-hub": {
        "ultravox_agent_id": "00652ba8-5580-4632-97be-0fd2090bbb71",
        "voice": "b0e6b5c1-3100-44d5-8578-9015aa3023ae",
        "greeting": None,  # uses generated greeting
        "vad_min_interruption": "0.400s",
    },
    "hasan-sharif": {
        "ultravox_agent_id": "f19b4ad7-233e-4125-a547-94e007238cf8",
        "voice": "f90da51d-8133-4d19-aa0f-4ec99e14cb85",  # Riya (professional, clean, articulate)
        "greeting": None,
        "vad_min_interruption": "0.400s",
    },
    "exp-realty": {
        "ultravox_agent_id": "c9019927-49a7-4676-b97b-5c6395e58a37",
        "voice": "441ec053-5566-4d18-9752-452dd5120071",
        "greeting": None,
        "vad_min_interruption": "0.400s",
    },
    "true-color-display-printing-ltd": {
        "ultravox_agent_id": "ce4bbe2b-6f7d-4f32-b3ce-e9b044aeef3e",
        "voice": "aa601962-1cbd-4bbd-9d96-3c7a93c3414a",
        "greeting": None,
        "vad_min_interruption": "0.400s",
        "local_dir": "true-color",
    },
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ── HTTP helpers ─────────────────────────────────────────────────────────────

def sb_get(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Accept": "application/json"
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def sb_post(path, data):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    payload = json.dumps(data).encode()
    req = urllib.request.Request(url, data=payload, method="POST", headers={
        "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json", "Prefer": "return=representation"
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def sb_patch(path, data):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    payload = json.dumps(data).encode()
    req = urllib.request.Request(url, data=payload, method="PATCH", headers={
        "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json", "Prefer": "return=minimal"
    })
    with urllib.request.urlopen(req) as r:
        return r.status

def uv_patch(agent_id, call_template):
    url = f"https://api.ultravox.ai/api/agents/{agent_id}"
    payload = json.dumps({"callTemplate": call_template}).encode()
    req = urllib.request.Request(url, data=payload, method="PATCH", headers={
        "Content-Type": "application/json", "X-API-Key": ULTRAVOX_KEY
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


# ── Main ─────────────────────────────────────────────────────────────────────

def deploy(slug, change_description):
    cfg = CLIENT_CONFIG.get(slug)
    if not cfg:
        print(f"ERROR: No CLIENT_CONFIG entry for '{slug}'. Add it to deploy_prompt.py.")
        sys.exit(1)

    local_dir = cfg.get("local_dir", slug)
    prompt_path = os.path.join(BASE_DIR, "clients", local_dir, "SYSTEM_PROMPT.txt")
    if not os.path.exists(prompt_path):
        print(f"ERROR: No SYSTEM_PROMPT.txt at {prompt_path}")
        sys.exit(1)

    with open(prompt_path, "r") as f:
        prompt = f.read()

    prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()[:16]

    # Get client row
    rows = sb_get(f"clients?slug=eq.{slug}&select=id,active_prompt_version_id")
    if not rows:
        print(f"ERROR: Client '{slug}' not found in Supabase.")
        sys.exit(1)
    client_id = rows[0]["id"]

    # Get current max version
    versions = sb_get(f"prompt_versions?client_id=eq.{client_id}&select=version&order=version.desc&limit=1")
    next_version = (versions[0]["version"] + 1) if versions else 1

    print(f"[{slug}] Deploying v{next_version} — \"{change_description}\"")
    print(f"  Prompt: {len(prompt)} chars | hash: {prompt_hash}")

    # Deactivate ALL previous versions first (unique constraint: only 1 active per client)
    sb_patch(f"prompt_versions?client_id=eq.{client_id}", {"is_active": False})

    # Insert new version
    new_version = sb_post("prompt_versions", {
        "client_id": client_id,
        "version": next_version,
        "content": prompt,
        "change_description": change_description,
        "is_active": True,
        "version_hash": prompt_hash
    })
    new_version_id = new_version[0]["id"]
    print(f"  ✓ Supabase version_id: {new_version_id}")

    # Update clients table
    sb_patch(f"clients?slug=eq.{slug}", {
        "system_prompt": prompt,
        "active_prompt_version_id": new_version_id
    })
    print(f"  ✓ clients.system_prompt + active_prompt_version_id updated")

    # PATCH Ultravox
    call_template = {
        "systemPrompt": prompt,
        "voice": cfg["voice"],
        "model": "ultravox-v0.7",
        "maxDuration": "600s",
        "vadSettings": {"minimumInterruptionDuration": cfg["vad_min_interruption"]},
        "firstSpeakerSettings": {"agent": {"uninterruptible": True}}
    }
    if cfg.get("greeting"):
        call_template["firstSpeakerSettings"]["agent"]["text"] = cfg["greeting"]

    uv_result = uv_patch(cfg["ultravox_agent_id"], call_template)
    uv_revision = uv_result.get("currentRevision", {}).get("revisionId", "n/a")

    # Mark ultravox_synced
    sb_patch(f"prompt_versions?id=eq.{new_version_id}", {"ultravox_synced": True})
    print(f"  ✓ Ultravox PATCH — revision: {uv_revision}")

    # Append to local changelog
    changelog_path = os.path.join(BASE_DIR, "clients", local_dir, "PROMPT_CHANGELOG.md")
    now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    entry = f"\n## v{next_version} — {now}\n**Change:** {change_description}\n**Chars:** {len(prompt)} | **Hash:** {prompt_hash}\n**Supabase version_id:** {new_version_id}\n**Ultravox revision:** {uv_revision}\n"

    if not os.path.exists(changelog_path):
        header = f"# Prompt Changelog — {slug}\n\nGenerated by scripts/deploy_prompt.py. One entry per deploy.\nTo roll back: `python3 scripts/deploy_prompt.py {slug} \"rollback to vN\" --version N`\n"
        with open(changelog_path, "w") as f:
            f.write(header)

    with open(changelog_path, "a") as f:
        f.write(entry)
    print(f"  ✓ Changelog updated: clients/{slug}/PROMPT_CHANGELOG.md")

    print(f"\nDone. v{next_version} is live.")
    return next_version, new_version_id


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 scripts/deploy_prompt.py <slug> \"<change description>\"")
        sys.exit(1)
    slug = sys.argv[1]
    description = sys.argv[2]
    deploy(slug, description)
