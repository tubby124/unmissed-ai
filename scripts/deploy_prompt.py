#!/usr/bin/env python3
"""
deploy_prompt.py — Versioned prompt deploy for unmissed.ai clients

Usage:
  python3 scripts/deploy_prompt.py <slug> "<change description>"
  python3 scripts/deploy_prompt.py <slug> --dry-run           # show diff vs live, don't deploy
  python3 scripts/deploy_prompt.py <slug> --rollback N        # deploy version N as new current

Examples:
  python3 scripts/deploy_prompt.py windshield-hub "Fixed double-question in sensor check"
  python3 scripts/deploy_prompt.py urban-vibe --dry-run
  python3 scripts/deploy_prompt.py urban-vibe --rollback 5

What it does (normal deploy):
  1. Reads clients/<slug>/SYSTEM_PROMPT.txt
  2. Inserts a new row in prompt_versions (auto-increments version number)
  3. Marks previous version inactive
  4. Updates clients.system_prompt + clients.active_prompt_version_id
  5. PATCHes the Ultravox agent with full callTemplate (partial PATCH wipes fields)
  6. Verifies all required fields on live agent after PATCH
  7. Appends to clients/<slug>/PROMPT_CHANGELOG.md
"""

import sys, json, hashlib, datetime, urllib.request, urllib.error, os

# ── Config ──────────────────────────────────────────────────────────────────

SUPABASE_URL = "https://qwhvblomlgeapzhnuwlb.supabase.co"
SUPABASE_KEY = None
ULTRAVOX_KEY = None


def _load_env():
    """Load required env vars. Called at the start of each command, not at import time."""
    global SUPABASE_KEY, ULTRAVOX_KEY
    for name in ("SUPABASE_SERVICE_KEY", "ULTRAVOX_API_KEY"):
        if not os.environ.get(name):
            print(f"ERROR: {name} env var not set. Export it in ~/.zshrc or pass inline.")
            sys.exit(1)
    SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
    ULTRAVOX_KEY = os.environ["ULTRAVOX_API_KEY"]

# Per-client Ultravox settings — add new clients here
# VOICE IS NOT STORED HERE. Voice always comes from:
#   1. --voice CLI flag (one-time override)
#   2. clients.agent_voice_id in Supabase (authoritative — set via dashboard)
#   3. Live Ultravox agent (preserved if DB has no voice set)
# If none of the above have a voice, deploy fails with a clear error.
CLIENT_CONFIG = {
    "urban-vibe": {
        "ultravox_agent_id": "5f88f03b-5aaf-40fc-a608-2f7ed765d6a6",
        "greeting": "Thanks for calling Urban Vibe Properties — I'm Alisha, Ray's virtual assistant. How can I help?",
        "vad_min_interruption": "0.400s",
    },
    "windshield-hub": {
        "ultravox_agent_id": "00652ba8-5580-4632-97be-0fd2090bbb71",
        "greeting": None,
        "vad_min_interruption": "0.400s",
    },
    "hasan-sharif": {
        "ultravox_agent_id": "f19b4ad7-233e-4125-a547-94e007238cf8",
        "greeting": None,
        "vad_min_interruption": "0.400s",
    },
    "exp-realty": {
        "ultravox_agent_id": "c9019927-49a7-4676-b97b-5c6395e58a37",
        "greeting": None,
        "vad_min_interruption": "0.400s",
    },
    "true-color-display-printing-ltd": {
        "ultravox_agent_id": "ce4bbe2b-6f7d-4f32-b3ce-e9b044aeef3e",
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

def uv_get(agent_id):
    url = f"https://api.ultravox.ai/api/agents/{agent_id}"
    req = urllib.request.Request(url, headers={"X-API-Key": ULTRAVOX_KEY})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

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
    _load_env()
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

    # Get client row (includes agent_voice_id for voice priority chain)
    rows = sb_get(f"clients?slug=eq.{slug}&select=id,active_prompt_version_id,booking_enabled,agent_voice_id,forwarding_number")
    if not rows:
        print(f"ERROR: Client '{slug}' not found in Supabase.")
        sys.exit(1)
    client_id = rows[0]["id"]
    booking_enabled = rows[0].get("booking_enabled") or False
    db_voice_id = rows[0].get("agent_voice_id") or None
    forwarding_number = rows[0].get("forwarding_number") or None

    # Get current max version
    versions = sb_get(f"prompt_versions?client_id=eq.{client_id}&select=version&order=version.desc&limit=1")
    next_version = (versions[0]["version"] + 1) if versions else 1

    print(f"[{slug}] Deploying v{next_version} — \"{change_description}\"")
    print(f"  Prompt: {len(prompt)} chars | hash: {prompt_hash}")

    # Deactivate ALL previous versions first (unique constraint: only 1 active per client)
    sb_patch(f"prompt_versions?client_id=eq.{client_id}", {"is_active": False})

    # Insert new version (supabase_synced=True — the prompt IS in Supabase at this point)
    new_version = sb_post("prompt_versions", {
        "client_id": client_id,
        "version": next_version,
        "content": prompt,
        "change_description": change_description,
        "is_active": True,
        "version_hash": prompt_hash,
        "supabase_synced": True,
    })
    new_version_id = new_version[0]["id"]
    print(f"  ✓ Supabase version_id: {new_version_id}")

    # Update clients table
    sb_patch(f"clients?slug=eq.{slug}", {
        "system_prompt": prompt,
        "active_prompt_version_id": new_version_id
    })
    print(f"  ✓ clients.system_prompt + active_prompt_version_id updated")

    # Build selectedTools — always include hangUp; add calendar tools if booking_enabled
    APP_URL = "https://unmissed-ai-production.up.railway.app"
    selected_tools = [{"toolName": "hangUp"}]
    if booking_enabled:
        selected_tools += [
            {
                "temporaryTool": {
                    "modelToolName": "checkCalendarAvailability",
                    "precomputable": True,
                    "timeout": "10s",
                    "description": "Check available appointment slots for a given date. Returns a slots array — each slot has a displayTime string (e.g. '9:00 AM'). Read up to 3 slots back to the caller naturally. If available=false or slots is empty, no openings exist for that day. When the caller asks for a specific time, pass it as the time parameter — the tool returns the 3 closest available slots to that time. If the exact time isn't available, say 'I don't have exactly [time] but I can do [closest slot] — does that work?' — NEVER say a time is 'booked' unless the tool explicitly says so.",
                    "dynamicParameters": [
                        {
                            "name": "date",
                            "location": "PARAMETER_LOCATION_QUERY",
                            "schema": {"type": "string", "description": "Date in YYYY-MM-DD format. Use the TODAY value from callerContext to resolve relative dates like 'tomorrow' or 'next Monday'."},
                            "required": True,
                        },
                        {
                            "name": "time",
                            "location": "PARAMETER_LOCATION_QUERY",
                            "schema": {"type": "string", "description": "Preferred time in 24h HH:MM format (e.g. '16:00' for 4 PM). When provided, returns 3 slots closest to this time. Omit if caller has no preference."},
                            "required": False,
                        }
                    ],
                    "http": {
                        "baseUrlPattern": f"{APP_URL}/api/calendar/{slug}/slots",
                        "httpMethod": "GET",
                    },
                }
            },
            {
                "temporaryTool": {
                    "modelToolName": "bookAppointment",
                    "timeout": "10s",
                    "description": "Book an appointment for a caller. IMPORTANT: pass time exactly as the displayTime value returned by checkCalendarAvailability (e.g. '9:00 AM', '2:30 PM') — do not reformat it. Always include callerPhone from CALLER PHONE in callerContext. If response has booked=false and nextAvailable, offer that slot. If response has fallback=true, switch to message-taking mode instead.",
                    "dynamicParameters": [
                        {"name": "date",        "location": "PARAMETER_LOCATION_BODY", "schema": {"type": "string", "description": "Date in YYYY-MM-DD format"}, "required": True},
                        {"name": "time",        "location": "PARAMETER_LOCATION_BODY", "schema": {"type": "string", "description": "Exact displayTime from checkCalendarAvailability e.g. '9:00 AM'. Do not reformat."}, "required": True},
                        {"name": "service",     "location": "PARAMETER_LOCATION_BODY", "schema": {"type": "string"}, "required": False},
                        {"name": "callerName",  "location": "PARAMETER_LOCATION_BODY", "schema": {"type": "string"}, "required": True},
                        {"name": "callerPhone", "location": "PARAMETER_LOCATION_BODY", "schema": {"type": "string", "description": "Caller's phone number from CALLER PHONE in callerContext"}, "required": True},
                    ],
                    "http": {
                        "baseUrlPattern": f"{APP_URL}/api/calendar/{slug}/book",
                        "httpMethod": "POST",
                    },
                }
            },
        ]
        print(f"  ✓ Calendar tools injected (booking_enabled=True, slug={slug})")

    # Transfer tool — inject if client has a forwarding_number
    if forwarding_number:
        transfer_secret = os.environ.get("WEBHOOK_SIGNING_SECRET")
        transfer_tool = {
            "temporaryTool": {
                "modelToolName": "transferCall",
                "description": "Transfer the call to the owner ONLY when the caller explicitly asks to speak to someone directly, says 'put me through', 'connect me', or insists on speaking to a person. Do not use for general questions the agent can answer.",
                "dynamicParameters": [
                    {
                        "name": "reason",
                        "location": "PARAMETER_LOCATION_BODY",
                        "schema": {"type": "string", "description": "Reason for transfer"},
                        "required": False,
                    }
                ],
                "automaticParameters": [
                    {
                        "name": "call_id",
                        "location": "PARAMETER_LOCATION_BODY",
                        "knownValue": "KNOWN_PARAM_CALL_ID",
                    }
                ],
                "http": {
                    "baseUrlPattern": f"{APP_URL}/api/webhook/{slug}/transfer",
                    "httpMethod": "POST",
                },
            }
        }
        if transfer_secret:
            transfer_tool["temporaryTool"]["staticParameters"] = [
                {"name": "X-Transfer-Secret", "location": "PARAMETER_LOCATION_HEADER", "value": transfer_secret}
            ]
        selected_tools.append(transfer_tool)
        print(f"  ✓ Transfer tool injected (forwarding_number={forwarding_number})")

    # Voice priority chain:
    #   1. --voice CLI flag (highest — one-time override, also updates clients.agent_voice_id)
    #   2. clients.agent_voice_id from Supabase (authoritative — set via dashboard Voice tab)
    #   3. Live Ultravox agent voice (fallback if DB has no voice yet)
    # CLIENT_CONFIG no longer stores voice — prevents stale values from silently overwriting live config.
    live_agent = uv_get(cfg["ultravox_agent_id"])
    live_voice = live_agent.get("callTemplate", {}).get("voice")

    if cfg.get("_voice_override"):
        deploy_voice = cfg["_voice_override"]
        voice_source = "overridden via --voice flag"
    elif db_voice_id:
        deploy_voice = db_voice_id
        voice_source = "from DB (clients.agent_voice_id)"
    elif live_voice:
        deploy_voice = live_voice
        voice_source = "preserved from live Ultravox agent"
    else:
        raise SystemExit(
            f"ERROR: No voice found for {slug}.\n"
            "  Set one via the dashboard Voice tab (updates clients.agent_voice_id)\n"
            "  or pass --voice <uuid> to deploy with a specific voice."
        )
    print(f"  Voice: {deploy_voice} ({voice_source})")

    # PATCH Ultravox — always send full callTemplate (partial PATCH wipes omitted fields)
    call_template = {
        "systemPrompt": prompt,
        "voice": deploy_voice,
        "model": "ultravox-v0.7",
        "maxDuration": "600s",
        "medium": {"twilio": {}},
        "recordingEnabled": True,
        "selectedTools": selected_tools,
        "contextSchema": {
            "type": "object",
            "properties": {
                "callerContext":  {"type": "string"},
                "businessFacts":  {"type": "string"},
                "extraQa":        {"type": "string"},
                "contextData":    {"type": "string"},
            }
        },
        "vadSettings": {
            "turnEndpointDelay": "0.640s",
            "minimumTurnDuration": "0.100s",
            "minimumInterruptionDuration": cfg.get("vad_min_interruption", "0.200s"),
        },
        "timeExceededMessage": "I need to wrap up \u2014 feel free to call back or text this number. Bye!",
        "inactivityMessages": [
            {"duration": "30s", "message": "Hello? You still there?"},
            {"duration": "15s", "message": "I'll let you go \u2014 feel free to call back anytime. Bye!", "endBehavior": "END_BEHAVIOR_HANG_UP_SOFT"},
        ],
        "firstSpeakerSettings": {"agent": {"uninterruptible": True}},
    }
    if cfg.get("greeting"):
        call_template["firstSpeakerSettings"]["agent"]["text"] = cfg["greeting"]

    uv_result = uv_patch(cfg["ultravox_agent_id"], call_template)
    uv_revision = uv_result.get("publishedRevisionId", "n/a")

    # Post-PATCH verification — read back live agent and check required fields
    # Ultravox PATCH is a full callTemplate replace; missing fields are silently wiped.
    uv_live = uv_get(cfg["ultravox_agent_id"])
    live_ct = uv_live.get("callTemplate", {})
    required = ["systemPrompt", "voice", "medium", "recordingEnabled", "selectedTools",
                "inactivityMessages", "firstSpeakerSettings", "vadSettings", "timeExceededMessage"]
    missing = [f for f in required if not live_ct.get(f)]
    if missing:
        print(f"  ⚠ DEPLOY WARNING: live agent missing fields after PATCH: {missing}")
        print(f"    Re-run deploy or manually patch agent {cfg['ultravox_agent_id']}")
    else:
        print(f"  ✓ Live agent verified — all required fields present")

    # Mark ultravox_synced
    sb_patch(f"prompt_versions?id=eq.{new_version_id}", {"ultravox_synced": True})
    print(f"  ✓ Ultravox PATCH — revision: {uv_revision}")

    # Append to local changelog
    changelog_path = os.path.join(BASE_DIR, "clients", local_dir, "PROMPT_CHANGELOG.md")
    now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    entry = f"\n## v{next_version} — {now}\n**Change:** {change_description}\n**Chars:** {len(prompt)} | **Hash:** {prompt_hash}\n**Supabase version_id:** {new_version_id}\n**Ultravox revision:** {uv_revision}\n"

    if not os.path.exists(changelog_path):
        header = f"# Prompt Changelog — {slug}\n\nGenerated by scripts/deploy_prompt.py. One entry per deploy.\nTo roll back: `python3 scripts/deploy_prompt.py {slug} --rollback N`\nTo check drift: `python3 scripts/prompt_status.py {slug}`\n"
        with open(changelog_path, "w") as f:
            f.write(header)

    with open(changelog_path, "a") as f:
        f.write(entry)
    print(f"  ✓ Changelog updated: clients/{slug}/PROMPT_CHANGELOG.md")

    print(f"\nDone. v{next_version} is live.")
    return next_version, new_version_id


# ── Dry run ──────────────────────────────────────────────────────────────────

def dry_run(slug):
    """Compare local SYSTEM_PROMPT.txt vs Supabase live — show diff without deploying."""
    _load_env()
    cfg = CLIENT_CONFIG.get(slug)
    if not cfg:
        print(f"ERROR: No CLIENT_CONFIG entry for '{slug}'.")
        sys.exit(1)

    local_dir = cfg.get("local_dir", slug)
    prompt_path = os.path.join(BASE_DIR, "clients", local_dir, "SYSTEM_PROMPT.txt")
    if not os.path.exists(prompt_path):
        print(f"ERROR: No SYSTEM_PROMPT.txt at {prompt_path}")
        sys.exit(1)

    with open(prompt_path, "r") as f:
        local_prompt = f.read()

    local_hash = hashlib.sha256(local_prompt.encode()).hexdigest()[:16]

    rows = sb_get(f"clients?slug=eq.{slug}&select=system_prompt,id,booking_enabled,agent_voice_id,forwarding_number")
    if not rows:
        print(f"ERROR: Client '{slug}' not found in Supabase.")
        sys.exit(1)

    sb_prompt = rows[0].get("system_prompt") or ""
    sb_hash = hashlib.sha256(sb_prompt.encode()).hexdigest()[:16]
    booking_enabled = rows[0].get("booking_enabled") or False
    db_voice_id = rows[0].get("agent_voice_id") or None
    forwarding_number = rows[0].get("forwarding_number") or None

    client_id = rows[0]["id"]
    vers = sb_get(f"prompt_versions?client_id=eq.{client_id}&is_active=eq.true&select=version,change_description")
    sb_ver = f"v{vers[0]['version']}" if vers else "?"
    sb_desc = vers[0].get("change_description", "") if vers else ""

    # Ultravox live state (hash + tool list)
    uv_hash = "ERROR"
    uv_tools = []
    try:
        uv_data = uv_get(cfg["ultravox_agent_id"])
        uv_prompt = uv_data.get("callTemplate", {}).get("systemPrompt", "")
        uv_hash = hashlib.sha256(uv_prompt.encode()).hexdigest()[:16]
        raw_tools = uv_data.get("callTemplate", {}).get("selectedTools") or []
        for t in raw_tools:
            if t.get("toolName"):
                uv_tools.append(t["toolName"])
            elif t.get("temporaryTool", {}).get("modelToolName"):
                uv_tools.append(t["temporaryTool"]["modelToolName"])
    except Exception:
        pass

    # What tools would be injected on next deploy
    would_inject = ["hangUp"]
    if booking_enabled:
        would_inject += ["checkCalendarAvailability", "bookAppointment"]
    if forwarding_number:
        would_inject.append("transferCall")

    # Voice drift check
    uv_voice = None
    try:
        uv_voice = uv_data.get("callTemplate", {}).get("voice")
    except Exception:
        pass

    print(f"\n[{slug}] Dry run")
    print(f"  Current Supabase: {sb_ver} ({sb_hash}) — \"{sb_desc}\"")
    print(f"  Local file:       {local_hash}  ({len(local_prompt)} chars)")
    print(f"  Ultravox live:    {uv_hash}")
    print(f"  Voice (DB):       {db_voice_id or 'not set'}")
    print(f"  Voice (live UV):  {uv_voice or 'unknown'}")
    if db_voice_id and uv_voice and db_voice_id != uv_voice:
        print(f"  ⚠ VOICE DRIFT: DB ({db_voice_id}) ≠ Ultravox ({uv_voice}). Deploy will sync to DB voice.")
    if not db_voice_id and not uv_voice:
        print(f"  ✗ NO VOICE SET: deploy will fail. Set voice via dashboard or use --voice <uuid>.")
    print(f"  Tools (live UV):  {uv_tools if uv_tools else 'unknown'}")
    print(f"  Tools (on deploy):{would_inject}  (booking_enabled={booking_enabled})")
    if sorted(uv_tools) != sorted(would_inject) and uv_tools:
        print(f"  ⚠ TOOL CHANGE: live tools differ from what would be injected on next deploy")

    if local_hash == sb_hash:
        print("\n  No content changes — local file matches Supabase.")
        if sb_hash != uv_hash:
            print(f"  ⚠ DRIFT: Supabase ({sb_hash}) ≠ Ultravox ({uv_hash}). Re-deploy to sync.")
        else:
            print("  Supabase and Ultravox are in sync. Nothing to deploy.")
        return

    char_diff = len(local_prompt) - len(sb_prompt)
    sign = "+" if char_diff >= 0 else ""
    print(f"\n  Char diff: {sign}{char_diff}")

    # Show first 3 differing lines
    local_lines = local_prompt.splitlines()
    sb_lines = sb_prompt.splitlines()
    diffs = []
    for i in range(max(len(local_lines), len(sb_lines))):
        l = local_lines[i] if i < len(local_lines) else "(line removed)"
        s = sb_lines[i] if i < len(sb_lines) else "(line added)"
        if l != s:
            diffs.append((i + 1, s, l))
        if len(diffs) >= 3:
            break

    if diffs:
        print(f"\n  First {len(diffs)} changed line(s):")
        for line_no, old, new in diffs:
            print(f"    Line {line_no}:")
            print(f"      - {old[:120]}")
            print(f"      + {new[:120]}")

    print(f"\nRun without --dry-run to deploy.")


# ── Rollback ─────────────────────────────────────────────────────────────────

def rollback(slug, version_num):
    """Deploy a previous version (vN) as the new current version. Preserves audit history."""
    _load_env()
    cfg = CLIENT_CONFIG.get(slug)
    if not cfg:
        print(f"ERROR: No CLIENT_CONFIG entry for '{slug}'.")
        sys.exit(1)

    rows = sb_get(f"clients?slug=eq.{slug}&select=id")
    if not rows:
        print(f"ERROR: Client '{slug}' not found in Supabase.")
        sys.exit(1)
    client_id = rows[0]["id"]

    versions = sb_get(f"prompt_versions?client_id=eq.{client_id}&version=eq.{version_num}&select=content,version_hash,change_description")
    if not versions:
        print(f"ERROR: Version {version_num} not found for client '{slug}'.")
        print(f"  Check available versions: python3 scripts/prompt_status.py {slug}")
        sys.exit(1)

    source = versions[0]
    print(f"[{slug}] Rolling back to v{version_num}")
    print(f"  Original change: {source['change_description']}")
    print(f"  Original hash:   {source['version_hash']}")

    # Write content to local file so deploy() reads it
    local_dir = cfg.get("local_dir", slug)
    prompt_path = os.path.join(BASE_DIR, "clients", local_dir, "SYSTEM_PROMPT.txt")
    with open(prompt_path, "w") as f:
        f.write(source["content"])
    print(f"  Local file overwritten with v{version_num} content")

    description = f"Rollback to v{version_num} — {source['change_description']}"
    deploy(slug, description)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(
        description="Deploy, dry-run, or rollback a voice agent prompt."
    )
    parser.add_argument("slug", help="Client slug (e.g. urban-vibe)")
    parser.add_argument("description", nargs="?", default="", help="Change description (required for normal deploy)")
    parser.add_argument("--dry-run", action="store_true", help="Show diff vs live without deploying")
    parser.add_argument("--rollback", type=int, metavar="N", help="Roll back to version N")
    parser.add_argument("--voice", type=str, metavar="UUID", help="Override voice UUID (one-time). Omit to preserve current live voice.")
    args = parser.parse_args()

    if args.dry_run:
        dry_run(args.slug)
    elif args.rollback is not None:
        rollback(args.slug, args.rollback)
    else:
        if not args.description:
            parser.error("A change description is required for normal deploys.")
        # Pass voice override through CLIENT_CONFIG if provided
        if args.voice:
            if args.slug in CLIENT_CONFIG:
                CLIENT_CONFIG[args.slug]["_voice_override"] = args.voice
        deploy(args.slug, args.description)
