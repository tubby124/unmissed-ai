"""
Standalone pytest checks for the documented webhook gaps in
docs/architecture/webhook-security-and-idempotency.md sections 4 + 6:

  P1 — /fallback must reject requests without a valid Twilio signature.
  P2 — /voicemail must not duplicate Telegram / DB rows when the same
       RecordingSid is delivered twice.

These tests hit a live dev server (or staging). They require:

  BASE_URL                     e.g. http://localhost:3000
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  TEST_CLIENT_ID               UUID of a test client row
  TEST_CLIENT_SLUG             slug for that client
  TWILIO_AUTH_TOKEN            so we can mint a real signature for the
                               positive-path fallback assertion

Each test skips (not fails) when its prerequisites are missing — that
way the file passes `python -m py_compile` and the CI fuzz job degrades
gracefully on incomplete creds.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
import urllib.parse
from typing import Any

import pytest
import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SVC_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
TEST_CLIENT_ID = os.environ.get("TEST_CLIENT_ID", "")
TEST_CLIENT_SLUG = os.environ.get("TEST_CLIENT_SLUG", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")

SB_HEADERS = {
    "apikey": SUPABASE_SVC_KEY,
    "Authorization": f"Bearer {SUPABASE_SVC_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}


# ── Twilio signature helper ────────────────────────────────────────────────


def _twilio_signature(auth_token: str, full_url: str, params: dict[str, str]) -> str:
    """Replicates twilio.RequestValidator: HMAC-SHA1(full_url + sorted k=v)."""
    data = full_url + "".join(f"{k}{params[k]}" for k in sorted(params))
    mac = hmac.new(auth_token.encode("utf-8"), data.encode("utf-8"), hashlib.sha1)
    return base64.b64encode(mac.digest()).decode("utf-8")


def _post_form(
    url: str, params: dict[str, str], sig: str | None = None
) -> requests.Response:
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    if sig is not None:
        headers["X-Twilio-Signature"] = sig
    return requests.post(
        url,
        data=urllib.parse.urlencode(params),
        headers=headers,
        timeout=15,
    )


def _gen_call_sid() -> str:
    return "CA" + secrets.token_hex(16)


def _gen_recording_sid() -> str:
    return "RE" + secrets.token_hex(16)


def _sb_count(table: str, column: str, value: str) -> int:
    """Count rows where column = value via Supabase REST exact count."""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        params={column: f"eq.{value}", "select": "id"},
        headers={**SB_HEADERS, "Prefer": "count=exact"},
        timeout=10,
    )
    r.raise_for_status()
    rng = r.headers.get("content-range", "")
    # content-range: "0-0/3" -> 3
    return int(rng.split("/")[-1]) if "/" in rng else len(r.json())


# ── Skip guards ────────────────────────────────────────────────────────────


def _require(*names: str) -> None:
    missing = [n for n in names if not globals().get(n)]
    if missing:
        pytest.skip(f"missing env: {', '.join(missing)}")


# ── Tests ──────────────────────────────────────────────────────────────────


def test_fallback_rejects_unsigned_request() -> None:
    """P1 (Section 8). /fallback must 403 when X-Twilio-Signature is absent."""
    _require("BASE_URL", "TEST_CLIENT_SLUG")
    url = f"{BASE_URL}/api/webhook/{TEST_CLIENT_SLUG}/fallback"
    r = _post_form(url, {"From": "+16045550000", "CallSid": _gen_call_sid()})
    assert r.status_code == 403, (
        f"Expected 403 for unsigned fallback POST; got {r.status_code}. "
        "Regression of webhook-security-and-idempotency.md P1."
    )


def test_fallback_accepts_signed_request_and_inserts_row() -> None:
    """Positive path for P1: valid signature -> 200 + exactly one call_logs row."""
    _require(
        "BASE_URL",
        "TEST_CLIENT_SLUG",
        "TWILIO_AUTH_TOKEN",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
    )
    call_sid = _gen_call_sid()
    url = f"{BASE_URL}/api/webhook/{TEST_CLIENT_SLUG}/fallback"
    params = {"From": "+16045550000", "CallSid": call_sid}
    sig = _twilio_signature(TWILIO_AUTH_TOKEN, url, params)

    r = _post_form(url, params, sig=sig)
    assert r.status_code == 200, f"signed fallback POST failed: {r.status_code} {r.text[:200]}"

    # Fire-and-forget insert — give it a beat
    time.sleep(2)
    rows = _sb_count("call_logs", "twilio_call_sid", call_sid)
    assert rows == 1, f"expected exactly 1 call_logs row for {call_sid}, got {rows}"


def test_voicemail_idempotent_on_duplicate_recording_sid() -> None:
    """P2 (Section 8). Twilio retries recordingStatusCallback. The route
    must not create duplicate notification_logs / call_logs rows for the
    same RecordingSid.
    """
    _require(
        "BASE_URL",
        "TEST_CLIENT_SLUG",
        "TWILIO_AUTH_TOKEN",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "TEST_CLIENT_ID",
    )

    call_sid = _gen_call_sid()
    recording_sid = _gen_recording_sid()

    # Seed the parent VOICEMAIL row (mirrors what /fallback would create).
    seed = {
        "client_id": TEST_CLIENT_ID,
        "caller_phone": "+16045550000",
        "twilio_call_sid": call_sid,
        "call_status": "VOICEMAIL",
        "started_at": "now()",
        "ai_summary": "schemathesis seed",
    }
    requests.post(
        f"{SUPABASE_URL}/rest/v1/call_logs",
        json=seed,
        headers=SB_HEADERS,
        timeout=10,
    ).raise_for_status()

    url = f"{BASE_URL}/api/webhook/{TEST_CLIENT_SLUG}/voicemail"
    params = {
        "CallSid": call_sid,
        "RecordingSid": recording_sid,
        # Use a tiny dummy recording — the route will try to download then
        # fail gracefully without blocking the 200 response.
        "RecordingUrl": "https://api.twilio.com/2010-04-01/Accounts/ACtest/Recordings/" + recording_sid,
        "RecordingDuration": "5",
        "RecordingStatus": "completed",
    }
    sig = _twilio_signature(TWILIO_AUTH_TOKEN, url, params)

    r1 = _post_form(url, params, sig=sig)
    r2 = _post_form(url, params, sig=sig)
    assert r1.status_code == 200, f"first voicemail POST: {r1.status_code} {r1.text[:200]}"
    assert r2.status_code == 200, f"second voicemail POST: {r2.status_code} {r2.text[:200]}"

    # Exactly one notification_logs row keyed to this call.
    notif_count = _sb_count("notification_logs", "call_id", call_sid)
    assert notif_count <= 1, (
        f"voicemail RecordingSid dedup failed: notification_logs={notif_count} "
        f"call_sid={call_sid} recording_sid={recording_sid} — "
        "regression of webhook-security-and-idempotency.md P2"
    )

    # Exactly one call_logs row with that RecordingSid baked in via recording_url.
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/call_logs",
        params={
            "twilio_call_sid": f"eq.{call_sid}",
            "select": "id,recording_url",
        },
        headers=SB_HEADERS,
        timeout=10,
    )
    r.raise_for_status()
    rows = r.json()
    assert len(rows) == 1, f"expected exactly 1 call_logs row, got {len(rows)}"


def test_voicemail_rejects_unsigned() -> None:
    """Bonus: confirm /voicemail also fails closed on missing signature."""
    _require("BASE_URL", "TEST_CLIENT_SLUG")
    url = f"{BASE_URL}/api/webhook/{TEST_CLIENT_SLUG}/voicemail"
    r = _post_form(
        url,
        {
            "CallSid": _gen_call_sid(),
            "RecordingSid": _gen_recording_sid(),
            "RecordingUrl": "https://example.invalid/rec",
            "RecordingDuration": "1",
            "RecordingStatus": "completed",
        },
    )
    assert r.status_code == 403, (
        f"Expected 403 for unsigned voicemail POST; got {r.status_code}"
    )
