# live-tests/

Output reports from `scripts/test-prompt-live.ts` — real Ultravox WebRTC calls
against a client's LIVE config, without firing the post-call notification
pipeline.

Naming: `<slug>-<ISO-timestamp>.json`

Each report contains:
- `slug`, `callId`, `startedAt`, `durationSeconds`
- `systemPromptChars` — chars after templateContext placeholder resolution
- `metrics.bridgePhraseHits` — count of "let me check / one sec / grabbing that" patterns
- `metrics.toolInvocations` — total tool calls made
- `metrics.queryKnowledgeFires` — queryKnowledge calls specifically
- `metrics.markersHit` — hallucination substrings that appeared in agent output
- `transcript[]` — full annotated transcript
- `rawMessages[]` — Ultravox `/calls/{id}/messages` raw response

Use: `npx tsx scripts/test-prompt-live.ts --slug <slug>` then talk to the agent
in the browser tab that opens. Hang up → CLI auto-reports.

Markers per slug are in `DEFAULT_MARKERS` at the top of the script. Override
with `--markers "foo,bar,baz"`.
