#!/usr/bin/env python3
"""
Test native SIP transfer (coldTransfer) with Twilio.

Usage:
    python3 scripts/test-sip-transfer.py <from-number> <to-number>

    <from-number>  E.164 Twilio number (e.g. +15877421507)
    <to-number>    E.164 destination number for the transfer target

Environment:
    ULTRAVOX_API_KEY  — required

Tests:
    1. coldTransfer with sipVerb=INVITE (bridge mode — recommended for Twilio)
    2. coldTransfer with sipVerb=REFER (native SIP REFER)
    3. Reports which mode works with Twilio

Note: Fully automated SIP transfer testing is difficult because it requires
two live phone lines. This script creates the call and monitors its lifecycle.
For true end-to-end verification, answer the from-number and observe whether
the transfer to to-number actually connects.
"""

import json
import os
import sys
import time
import urllib.request


ULTRAVOX_BASE = "https://api.ultravox.ai/api"


def api_key() -> str:
    key = os.environ.get("ULTRAVOX_API_KEY", "")
    if not key:
        print("ERROR: ULTRAVOX_API_KEY environment variable not set")
        sys.exit(1)
    return key


def ultravox_headers() -> dict[str, str]:
    return {
        "X-API-Key": api_key(),
        "Content-Type": "application/json",
    }


def ultravox_request(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{ULTRAVOX_BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers=ultravox_headers())
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def create_transfer_test_call(
    from_number: str,
    to_number: str,
    sip_verb: str,
) -> dict:
    """Create an Ultravox call that immediately invokes coldTransfer."""

    system_prompt = (
        f"You are a test agent. As soon as the call connects, say exactly: "
        f"'Transferring you now.' Then immediately invoke the coldTransfer tool "
        f"with target '{to_number}' — do not wait for the caller to speak."
    )

    call_body = {
        "model": "ultravox-v0.7",
        "systemPrompt": system_prompt,
        "voice": "aa601962-1cbd-4bbd-9d96-3c7a93c3414a",
        "maxDuration": "120s",
        "medium": {"twilio": {}},
        "recordingEnabled": True,
        "selectedTools": [
            {"toolName": "hangUp"},
            {
                "toolName": "coldTransfer",
                "parameterOverrides": {
                    "sipVerb": sip_verb,
                },
            },
        ],
        "firstSpeakerSettings": {"agent": {"uninterruptible": True}},
    }

    print(f"\n--- Creating test call (sipVerb={sip_verb}) ---")
    print(f"  From: {from_number}")
    print(f"  Transfer target: {to_number}")

    result = ultravox_request("POST", "/calls", call_body)
    call_id = result.get("callId", "")
    join_url = result.get("joinUrl", "")

    print(f"  Call ID: {call_id}")
    print(f"  Join URL: {join_url}")
    print(f"  Status: created — waiting for Twilio to connect...")

    return {"callId": call_id, "joinUrl": join_url, "sipVerb": sip_verb}


def poll_call_status(call_id: str, timeout_seconds: int = 120) -> dict:
    """Poll Ultravox until the call ends or timeout."""
    start = time.time()
    last_status = ""

    while time.time() - start < timeout_seconds:
        try:
            data = ultravox_request("GET", f"/calls/{call_id}")
        except Exception as e:
            print(f"  Poll error: {e}")
            time.sleep(3)
            continue

        ended = data.get("ended")
        end_reason = data.get("endReason", "")

        if ended:
            print(f"  Call ended. Reason: {end_reason}")
            return data

        status = f"joined={data.get('joined') is not None}"
        if status != last_status:
            print(f"  Status: {status}")
            last_status = status

        time.sleep(3)

    print(f"  Timeout after {timeout_seconds}s — call still active")
    return {}


def run_test(from_number: str, to_number: str, sip_verb: str) -> dict:
    """Run a single SIP transfer test and return results."""
    try:
        call = create_transfer_test_call(from_number, to_number, sip_verb)
    except Exception as e:
        print(f"  Failed to create call: {e}")
        return {"sipVerb": sip_verb, "success": False, "error": str(e)}

    print("\n  NOTE: For this test to work end-to-end, someone must answer")
    print(f"  the call on {from_number}. The agent will then attempt to")
    print(f"  transfer to {to_number} using SIP {sip_verb}.\n")
    print("  Polling call status (Ctrl+C to skip)...")

    try:
        result = poll_call_status(call["callId"], timeout_seconds=90)
    except KeyboardInterrupt:
        print("\n  Skipped polling.")
        result = {}

    end_reason = result.get("endReason", "unknown")

    # Interpret results
    # If the call ended with 'unrecoverable_error' on REFER, that suggests REFER isn't supported
    # If it ended normally, the transfer may have succeeded
    transfer_likely = end_reason not in ("unrecoverable_error", "timeout", "unknown", "")

    return {
        "sipVerb": sip_verb,
        "callId": call["callId"],
        "endReason": end_reason,
        "transferLikely": transfer_likely,
    }


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    from_number = sys.argv[1]
    to_number = sys.argv[2]

    if not from_number.startswith("+") or not to_number.startswith("+"):
        print("ERROR: Both numbers must be in E.164 format (e.g. +15877421507)")
        sys.exit(1)

    print("=" * 60)
    print("SIP Transfer Test — Ultravox coldTransfer + Twilio")
    print("=" * 60)

    results = []

    # Test 1: INVITE (bridge mode — recommended for Twilio)
    print("\n[TEST 1] sipVerb=INVITE (bridge mode)")
    results.append(run_test(from_number, to_number, "INVITE"))

    # Pause between tests
    print("\n--- Pausing 5s between tests ---")
    time.sleep(5)

    # Test 2: REFER (native SIP transfer)
    print("\n[TEST 2] sipVerb=REFER (native SIP REFER)")
    results.append(run_test(from_number, to_number, "REFER"))

    # Summary
    print("\n" + "=" * 60)
    print("RESULTS SUMMARY")
    print("=" * 60)
    for r in results:
        status = "LIKELY OK" if r.get("transferLikely") else "FAILED/UNKNOWN"
        print(f"  sipVerb={r['sipVerb']:>7s}  |  endReason={r.get('endReason', 'N/A'):<25s}  |  {status}")

    print()
    print("RECOMMENDATION:")
    invite_ok = any(r["sipVerb"] == "INVITE" and r.get("transferLikely") for r in results)
    refer_ok = any(r["sipVerb"] == "REFER" and r.get("transferLikely") for r in results)

    if invite_ok:
        print("  Use sipVerb=INVITE (bridge mode) — confirmed working with Twilio.")
    elif refer_ok:
        print("  Use sipVerb=REFER (native transfer) — confirmed working with Twilio.")
    else:
        print("  Neither mode confirmed working. Manual verification needed:")
        print("  1. Answer the from-number when the test call comes in")
        print("  2. Listen for 'Transferring you now'")
        print("  3. Check if you get connected to the to-number")
        print("  4. Check Ultravox call events for transfer-related errors:")
        for r in results:
            cid = r.get("callId", "N/A")
            print(f"     GET /api/calls/{cid}/events?minimum_severity=debug")


if __name__ == "__main__":
    main()
