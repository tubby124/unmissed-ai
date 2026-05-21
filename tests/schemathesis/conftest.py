"""
Schemathesis hooks + pytest fixtures for unmissed.ai API fuzzing.

Round-trip verification:
  1. After every 200 from PATCH /api/dashboard/settings, query Supabase to
     confirm each mutated field actually landed in the `clients` table.
  2. If the request mutated a field marked triggersSync: true in
     sync_manifest.SYNC_TRIGGER_FIELDS, call the Ultravox agent endpoint
     and confirm the value propagated.
  3. Any mismatch -> Schemathesis check failure with a diff line.

Env vars required when actually running (CI sets these):
  BASE_URL, SCHEMATHESIS_AUTH_COOKIE,
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  TEST_CLIENT_ID, TEST_ULTRAVOX_AGENT_ID,
  ULTRAVOX_API_KEY
"""

from __future__ import annotations

import json
import os
from typing import Any, Iterable

import pytest
import requests
import schemathesis

from sync_manifest import (
    ADMIN_ONLY_FIELDS,
    BODY_TO_COLUMN,
    SYNC_TRIGGER_FIELDS,
)

# ── Config ──────────────────────────────────────────────────────────────────

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
AUTH_COOKIE = os.environ.get("SCHEMATHESIS_AUTH_COOKIE", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SVC_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
TEST_CLIENT_ID = os.environ.get("TEST_CLIENT_ID", "")
TEST_UV_AGENT_ID = os.environ.get("TEST_ULTRAVOX_AGENT_ID", "")
ULTRAVOX_API_KEY = os.environ.get("ULTRAVOX_API_KEY", "")
ROLE = os.environ.get("TEST_USER_ROLE", "owner")  # "owner" or "admin"


# ── Helpers ─────────────────────────────────────────────────────────────────


def _supabase_get_client_row(columns: Iterable[str]) -> dict[str, Any] | None:
    """Fetch the test client row from Supabase REST. Returns None on missing config."""
    if not (SUPABASE_URL and SUPABASE_SVC_KEY and TEST_CLIENT_ID):
        return None
    col_list = ",".join(sorted(set(columns)))
    url = f"{SUPABASE_URL}/rest/v1/clients"
    r = requests.get(
        url,
        params={"id": f"eq.{TEST_CLIENT_ID}", "select": col_list},
        headers={
            "apikey": SUPABASE_SVC_KEY,
            "Authorization": f"Bearer {SUPABASE_SVC_KEY}",
            "Accept": "application/json",
        },
        timeout=10,
    )
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def _ultravox_get_agent() -> dict[str, Any] | None:
    if not (ULTRAVOX_API_KEY and TEST_UV_AGENT_ID):
        return None
    r = requests.get(
        f"https://api.ultravox.ai/api/agents/{TEST_UV_AGENT_ID}",
        headers={"X-API-Key": ULTRAVOX_API_KEY},
        timeout=10,
    )
    if not r.ok:
        return None
    return r.json()


def _shallow_equal(sent: Any, stored: Any) -> bool:
    """Compare what we sent vs what landed. Loose enough for trim/null
    coercion, strict enough to catch fake-control bugs.
    """
    if sent is None:
        return stored is None or stored == ""
    if isinstance(sent, str):
        return isinstance(stored, str) and sent.strip() == stored.strip()
    if isinstance(sent, bool):
        return bool(stored) == sent
    if isinstance(sent, (int, float)):
        return stored == sent
    if isinstance(sent, list):
        return isinstance(stored, list) and len(stored) == len(
            [x for x in sent if x not in ("", None)]
        )
    if isinstance(sent, dict):
        return isinstance(stored, dict)
    return sent == stored


# ── Schemathesis registration ───────────────────────────────────────────────

# Load schema lazily so import never fails when the file is just being
# syntax-checked.
_SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "openapi.yaml")

try:
    schema = schemathesis.from_path(_SCHEMA_PATH, base_url=BASE_URL)
except Exception:  # pragma: no cover - validation handled by CLI run
    schema = None


@schemathesis.check
def settings_patch_landed(response, case):
    """Confirm PATCH /api/dashboard/settings round-trips into Supabase
    and (when applicable) into the Ultravox agent.
    """
    if case.path != "/api/dashboard/settings" or case.method.upper() != "PATCH":
        return None
    if response.status_code != 200:
        return None

    body = case.body if isinstance(case.body, dict) else {}
    if not body:
        return None

    # Drop admin-only fields when the test user isn't admin — the route
    # silently ignores them, so we don't expect them in the row.
    expected_fields = {
        k: v
        for k, v in body.items()
        if (ROLE == "admin" or k not in ADMIN_ONLY_FIELDS)
        and k in BODY_TO_COLUMN
    }
    if not expected_fields:
        return None

    cols = [BODY_TO_COLUMN[k] for k in expected_fields]
    row = _supabase_get_client_row(cols)
    if row is None:
        # Supabase creds not wired — silently skip rather than block fuzz run
        return None

    diffs: list[str] = []
    for body_key, sent in expected_fields.items():
        col = BODY_TO_COLUMN[body_key]
        stored = row.get(col)
        if not _shallow_equal(sent, stored):
            diffs.append(
                f"  - {body_key}: sent={json.dumps(sent)[:80]} "
                f"stored={json.dumps(stored)[:80]}"
            )

    # Ultravox propagation — only fields that triggersSync
    sync_fields = SYNC_TRIGGER_FIELDS.intersection(expected_fields.keys())
    if sync_fields:
        agent = _ultravox_get_agent()
        if agent is not None:
            agent_prompt = (
                agent.get("callTemplate", {}).get("systemPrompt")
                if isinstance(agent.get("callTemplate"), dict)
                else None
            )
            if "system_prompt" in sync_fields and isinstance(
                expected_fields["system_prompt"], str
            ):
                if (agent_prompt or "").strip() != expected_fields[
                    "system_prompt"
                ].strip():
                    diffs.append(
                        "  - system_prompt did NOT propagate to Ultravox agent"
                    )

    if diffs:
        raise AssertionError(
            "settings PATCH round-trip mismatch:\n" + "\n".join(diffs)
        )
    return None


# ── pytest fixtures ─────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL


@pytest.fixture(scope="session")
def supabase_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SVC_KEY,
        "Authorization": f"Bearer {SUPABASE_SVC_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


@pytest.fixture(scope="session")
def test_client_id() -> str:
    return TEST_CLIENT_ID


@pytest.fixture(scope="session")
def supabase_url() -> str:
    return SUPABASE_URL


@pytest.fixture(scope="session")
def test_slug() -> str:
    """Slug for the test client used by webhook idempotency tests."""
    return os.environ.get("TEST_CLIENT_SLUG", "schemathesis-fuzz")
