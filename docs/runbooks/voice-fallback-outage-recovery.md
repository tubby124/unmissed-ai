# Outage Recovery — Twilio Voice Fallback Worker

When the primary voice route (Railway-hosted Next.js app) goes down, Twilio
fires the per-number `VoiceFallbackUrl` → Cloudflare Worker at
`fallback.endvoicemail.ai/voice`. The Worker serves a generic voicemail TwiML
so callers don't hear a dead line.

Recordings captured during the outage are stored in **Twilio's hosted
storage** — they are NOT written to Supabase by the Worker (the Worker has no
DB credentials by design). After the primary route recovers, you must
manually backfill them into `call_logs`.

## What you'll see during an outage

Telegram operator chat receives:

1. **`🚨 FALLBACK FIRED`** — one alert per inbound call that the Worker handles
2. **`🎙 FALLBACK VOICEMAIL (Xs)`** — one alert per recording that completes

Each VOICEMAIL alert carries `CallSid`, `RecordingSid`, `From`, `To`, and the
authenticated recording URL. The operator chat is the outage log.

## After Railway recovers

Identify the outage window from the Telegram operator chat (timestamp of
first FALLBACK FIRED → timestamp of last). Then:

```bash
cd /path/to/CALLING\ AGENTs

# 1. DRY-RUN — see what would be ingested
railway run -- npx tsx scripts/ingest-fallback-recordings.ts \
  --since=2026-05-19T22:00:00Z

# 2. APPLY — write to call_logs (no client Telegram alerts yet)
railway run -- npx tsx scripts/ingest-fallback-recordings.ts \
  --since=2026-05-19T22:00:00Z --apply

# 3. APPLY + NOTIFY — also fire client Telegram alerts so the missed calls
# appear in their normal alert stream
railway run -- npx tsx scripts/ingest-fallback-recordings.ts \
  --since=2026-05-19T22:00:00Z --apply --notify
```

The script is idempotent. Recordings already in `call_logs` (matched by
`twilio_call_sid`) are skipped. Safe to re-run.

## Verify

```bash
# Count of VOICEMAIL rows ingested in the outage window
psql "$DATABASE_URL" -c "
  select client_id, count(*)
  from call_logs
  where ai_summary like '%captured by fallback worker%'
  and started_at > '2026-05-19T22:00:00Z'
  group by client_id;
"
```

Spot-check one recording in the dashboard. Listen to it via the signed-URL
path that the recordings card uses.

## Twilio recording retention

Twilio retains recordings indefinitely by default. There is no urgency to
backfill within hours — but the longer it sits, the harder it is to associate
with a real customer follow-up.

## Common failure modes

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| Script finds 0 recordings | `--since` is wrong or Twilio account has no recordings in window | Widen the window. Check Twilio console → Recordings to confirm count |
| `no active client maps to this number` | Twilio number not in Supabase `clients` (e.g. demo numbers, archived clients) | Expected — skips silently |
| Storage upload fails | Supabase bucket `recordings` permissions or quota | Check Supabase dashboard. The script logs the upload error per row |
| Telegram alert duplicates | Re-running with `--notify` after a previous run already notified | Use `--apply` without `--notify` on re-runs |

## When the Worker itself is misconfigured

If a call comes in and Twilio's fallback also fails (Worker returns 5xx or
times out), Twilio will reject the call. The caller hears the carrier's
generic "the call cannot be completed" message. This is the worst-case
behavior we accept — far better than the call hanging silently for 30s before
disconnecting.

To diagnose:

```bash
cd cloudflare-workers/voice-fallback
npx wrangler tail
```

Common Worker failures:
- `TELEGRAM_BOT_TOKEN` secret missing → alerts skipped but voicemail still served
- `TWILIO_AUTH_TOKEN` secret missing → signature validation rejects every call (403)
- DNS for `fallback.endvoicemail.ai` not propagated → Twilio gets connection refused

## Setting up after first-time install

See `cloudflare-workers/voice-fallback/README.md` for first-deploy steps.
After the Worker is live, run `scripts/set-twilio-voice-fallback.ts --apply`
to wire every active client's Twilio number to it.
