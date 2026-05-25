# Reliability Baseline — 2026-05-25

## Production Health
- Railway: Online — project `endearing-adaptation`, service `unmissed-ai`, deployment `7efcc246-f809-4ca5-9591-af348040004d`
- Supabase: ok
- Agents checked: 10
- Agents healthy: 10
- Public health endpoint: `https://endvoicemail.ai/api/health` returned 200

## Current Known Risks
- Notification failures / unbilled notification records
- UNKNOWN classification burying owner alerts
- Manual learning-loop patch process
- Weak adversarial voice-call eval coverage
- Prompt drift across voicemail vs slot pipeline
- Disaster fallback not recently fire-drilled
- Billing/minute reconciliation uncertainty

## Repo State
- HEAD: `36fb77e Normalize preferred calendar times before slot sorting`
- Dirty files at baseline: `docs/plans/2026-05-25-endvoicemail-reliability-execution-a-z.md` only
- Stashes:
  - `stash@{0}`: zara-unrelated-dirty-before-preferred-time-commit
  - `stash@{1}`: zara-unrelated-dirty-before-calendar-booking-commit
  - `stash@{2}`: preserve unrelated pricing component edits before openrouter deploy
  - `stash@{3}`: pre-existing pricing/demo docs changes before auto-glass deploy

## Next Phase
Phase 1 — notification reliability.
