#!/usr/bin/env python3
"""
Register an Ultravox account-level webhook.
Usage: python3 scripts/register-ultravox-webhook.py

Outputs webhook ID + secret for Railway env vars.
"""

import os
import sys
import json
import secrets
import urllib.request
import urllib.error

ULTRAVOX_BASE = "https://api.ultravox.ai/api"
WEBHOOK_URL = "https://unmissed-ai-production.up.railway.app/api/webhook/ultravox"
EVENTS = ["call.ended", "call.billed"]


def get_api_key() -> str:
    key = os.environ.get("ULTRAVOX_API_KEY")
    if not key:
        print("ERROR: ULTRAVOX_API_KEY env var not set.")
        sys.exit(1)
    return key


def api_request(method: str, path: str, api_key: str, body: dict | None = None) -> dict | None:
    url = f"{ULTRAVOX_BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("X-API-Key", api_key)
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status == 204:
                return None
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else ""
        print(f"HTTP {e.code}: {error_body}")
        raise


def list_webhooks(api_key: str) -> list[dict]:
    result = api_request("GET", "/webhooks", api_key)
    if result and "results" in result:
        return result["results"]
    return []


def main() -> None:
    api_key = get_api_key()

    existing = list_webhooks(api_key)
    matching = [w for w in existing if w.get("url") == WEBHOOK_URL]

    if matching:
        print(f"WARNING: {len(matching)} existing webhook(s) found for this URL:")
        for w in matching:
            wid = w.get("webhookId", "unknown")
            events = w.get("events", [])
            print(f"  - ID: {wid}  events: {events}")
        print()
        answer = input("Delete existing webhook(s) and create a new one? [y/N] ").strip().lower()
        if answer != "y":
            print("Aborted.")
            sys.exit(0)

        for w in matching:
            wid = w.get("webhookId")
            if wid:
                print(f"Deleting webhook {wid}...")
                api_request("DELETE", f"/webhooks/{wid}", api_key)
                print(f"  Deleted.")

    webhook_secret = secrets.token_hex(32)

    print("Registering new webhook...")
    result = api_request("POST", "/webhooks", api_key, {
        "url": WEBHOOK_URL,
        "events": EVENTS,
        "secret": webhook_secret,
    })

    if not result:
        print("ERROR: No response from webhook creation.")
        sys.exit(1)

    webhook_id = result.get("webhookId", "unknown")

    print()
    print("Webhook registered successfully.")
    print(f"ULTRAVOX_WEBHOOK_ID={webhook_id}")
    print(f"ULTRAVOX_WEBHOOK_SECRET={webhook_secret}")
    print()
    print("Add these to Railway environment variables.")


if __name__ == "__main__":
    main()
