# Schemathesis API Fuzzer

Property-based fuzzing against the three production routes that have the
highest blast radius for silent corruption:

| Route | What we catch |
|-------|---------------|
| `PATCH /api/dashboard/settings` | Fake-control bugs — fields the dashboard exposes that don't actually write to Supabase or don't propagate to the Ultravox agent |
| `POST /api/webhook/[slug]/voicemail` | Twilio retry duplicate-notification regression (P2 in `docs/architecture/webhook-security-and-idempotency.md`) |
| `POST /api/webhook/[slug]/fallback` | Missing Twilio signature gate (P1 in the same doc) |

## Install (one-time, local)

```bash
pip install schemathesis pytest supabase requests pyyaml
```

## Required env

Either export these or put them in `.env.local` and source it:

| Var | Used by | Required for |
|-----|---------|-----------|
| `BASE_URL` | both | always (defaults to http://localhost:3000) |
| `SCHEMATHESIS_AUTH_COOKIE` | schemathesis | settings PATCH fuzz (Supabase session cookie, copy from browser devtools) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | round-trip checks + idempotency | settings sync verification, call_logs assertions |
| `TEST_CLIENT_ID` | both | round-trip lookups |
| `TEST_CLIENT_SLUG` | idempotency | webhook routing |
| `TEST_ULTRAVOX_AGENT_ID` + `ULTRAVOX_API_KEY` | conftest | Ultravox propagation check |
| `TWILIO_AUTH_TOKEN` | idempotency | mints valid X-Twilio-Signature for positive-path tests |

Tests that lack their prerequisites **skip** rather than fail — so you
can run the suite in degraded environments without spurious red.

## Run

```bash
# Start the dev server in another shell
cd /path/to/unmissed-ai && npm run dev

# Then:
bash tests/schemathesis/run.sh
```

The script does two things:

1. `schemathesis run openapi.yaml --checks=all --max-examples=50` —
   property-based fuzzing across every documented field, with the custom
   `settings_patch_landed` check from `conftest.py` confirming each 200
   actually round-trips to Supabase + (for sync-trigger fields) Ultravox.
2. `pytest test_idempotency.py -v` — three concrete regressions:
   - `test_fallback_rejects_unsigned_request` — P1
   - `test_voicemail_idempotent_on_duplicate_recording_sid` — P2
   - `test_voicemail_rejects_unsigned` — defensive

## Interpreting failures

Schemathesis prints a numbered list of failing examples with the exact
JSON body it sent. If the failure is `settings_patch_landed`, the
mismatch line tells you which field was sent vs what landed in the
`clients` row — that's a **fake-control bug**.

Pytest failures from `test_idempotency.py` are straightforward — read
the assertion message; each test cites the doc section it guards.

## Updating the spec

When `src/lib/settings-schema.ts` adds, removes, or retypes a field:

1. Update `openapi.yaml` `SettingsPatchBody.properties` to match.
2. If the new field has `triggersSync: true` in `FIELD_REGISTRY`, add it
   to `SYNC_TRIGGER_FIELDS` in `sync_manifest.py`.
3. If it's admin-only, add it to `ADMIN_ONLY_FIELDS`.
4. If the body key differs from the column name, add a `BODY_TO_COLUMN`
   entry.

The TS-side `prompt-snapshots` test keeps the Zod registry honest;
this manifest is the corresponding tripwire on the Python side.

## Routes deferred to v2

- `/api/webhook/[slug]/inbound` — needs Ultravox call creation mocking
- `/api/webhook/[slug]/completed` — needs HMAC-signed URL minting
- `/api/webhook/ultravox` — needs Ultravox HMAC + timestamp header
- `/api/webhook/stripe` — needs Stripe SDK signed event mocking
- `/api/webhook/[slug]/sms-inbound`, `/sms-status`, `/transfer-status`,
  `/ivr-gather` — same Twilio sig story, lower blast radius
