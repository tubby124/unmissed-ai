# Next Chat — D442 Followup (rev 3, 2026-04-30 PM)

## Cold start

D448 is resolved. The mutation contract is correct. **The "universal hangUp gap on all 5 clients" was an audit script extractor bug** — the script scanned only `modelToolName` and missed built-in tools that use the `toolName` key (verified empirically against `windshield-hub` + `hasan-sharif` Supabase rows). D444 already closed this bug class as a false-alarm but the extractor was never actually fixed; D442 Phase 1 re-bit the same way.

Real drift across the 5 clients is much narrower than reported:

- **`windshield-hub`:** zero drift.
- **`hasan-sharif`:** missing `pageOwner` only (added 2026-03-29 commit `dc871e5`, never re-synced).
- **`exp-realty`, `urban-vibe`, `calgary-property-leasing`:** not yet re-verified with corrected scan; likely also `pageOwner`-only drift on the ones with `forwarding_number` set.

## Priority list (revised)

1. **File D451 — fix the audit script extractor.** Same bug class as the closed [[Tracker/D444]]. Without this fix, every future drift audit produces phantom universal-gap findings and burns investigation cycles. Fix is one function: `getName(t) = t.toolName || t.temporaryTool?.modelToolName || t.temporaryTool?.nameOverride`. Apply at every comparand. Verify [[Tracker/D446]] (drift-detector tool-extractor hardening) doesn't already cover this — close as duplicate if yes.
2. **Re-verify the other 3 clients with the corrected extractor** (`exp-realty`, `urban-vibe`, `calgary-property-leasing`). Single empirical Supabase diff dispatch. ~10 min.
3. **Run targeted `syncClientTools()` on `hasan-sharif`** to add `pageOwner`. Pure DB write per [src/lib/sync-client-tools.ts:1-53](../../src/lib/sync-client-tools.ts) — header comment confirms *"Lightweight — no Ultravox API call."* Standing no-redeploy rule does NOT apply. Add the others if step 2 confirms `pageOwner`-only drift.
4. **File D449 (Fix 2 per-field warning chip)** — already specced at [[Tracker/D449]]. Independent of D447 and the sweep. Cheap independent win.
5. **File D450 (Fix 3 `twilio_number` → `needsAgentSync` one-liner)** — already specced at [[Tracker/D450]]. Trivial.
6. **D447 go/no-go: defer indefinitely.** Reasoning at [[Tracker/D447]] header note + below. With the audit's universal symptom now refuted, D447's "5+ documented intentional gaps + 3 silent failure categories" framing weakens substantially. D443 + D449 + D450 close the addressable trust gap; D447's exclusive value (`partial_failure` and novel-drift detection) is latent. Wait for an actual incident.

## What shipped this session (2026-04-30 PM)

Two earlier commits (`210d598` + `d9d0be7`) — already reported in rev 1+2.

This rev: vault-only updates. No code changes. Tree clean.

## Doc / vault changes from this rev

- [[Tracker/D448]] — status updated to `resolved`; H1/H2 false, H3 refuted on stated symptom. Universal hangUp gap = audit extractor bug, not real drift. Sweep recommendation revised to targeted `pageOwner` add for `hasan-sharif` only (others pending re-verification).
- [[Tracker/D449]] — new spec, per-field "Saved, but not live yet" chip. Independent of D447 and D448.
- [[Tracker/D450]] — new spec, one-liner `twilio_number` → `needsAgentSync` plug.
- D451 (audit-script extractor fix) — recommended in [[Tracker/D448]] sweep section + [unmissed-tool-extractor-recurring-bug](file:///Users/owner/.claude/projects/-Users-owner/memory/unmissed-tool-extractor-recurring-bug.md) memory. Not yet filed as a tracker.
- Memory updates: [unmissed-clients-tools-runtime-authority-unverified.md](file:///Users/owner/.claude/projects/-Users-owner/memory/unmissed-clients-tools-runtime-authority-unverified.md) (was UNVERIFIED, now resolved); new [unmissed-tool-extractor-recurring-bug.md](file:///Users/owner/.claude/projects/-Users-owner/memory/unmissed-tool-extractor-recurring-bug.md). Both indexed in MEMORY.md.

## Net-new learnings worth applying next pass

11. **`syncClientTools()` is pure DB write.** No `updateAgent()` call, no Ultravox API call, no prompt rebuild. The D448 spec was wrong about this (acceptance criterion #5 said it rebuilds the prompt). Standing no-redeploy rule does NOT apply to standalone `syncClientTools()` calls. It DOES apply to settings PATCH calls that trigger `needsAgentSync` (those call `updateAgent()`).

12. **Tool extraction must scan two key shapes.** Built-in tools use `toolName: '...'`. HTTP tools use `temporaryTool.modelToolName` || `temporaryTool.nameOverride`. Audits that scan only one will produce phantom universal-gap findings. This is a recurring bug — D444 closed it once, never actually fixed; D442 re-bit. Permanent fix needs the audit script updated.

13. **`buildCalendarTools()` returns ONE tool, not three.** It returns only `transitionToBookingStage`. `bookAppointment` + `checkCalendarAvailability` are in `buildCalendarBookingTools()` ([src/lib/ultravox.ts:337](../../src/lib/ultravox.ts)) — a stage-2 tool set used after the agent transitions into the booking stage. Don't confuse them when auditing. The D442 audit confused them and reported `hasan-sharif` was missing those two; they're correctly absent from the main tool list.

14. **`pageOwner` was added 2026-03-29 (commit `dc871e5`) and the 5 active clients haven't all picked it up.** Reason: `pageOwner` is added by `buildAgentTools()` based on `forwarding_number + plan.transferEnabled + slug` — those don't change frequently, so a `needsAgentSync` settings PATCH hasn't fired since. This is a generalizable risk: any new tool added to `buildAgentTools()` will be stale on existing clients until something else triggers a settings PATCH (or someone runs `syncClientTools()` manually). Worth a follow-up on whether `buildAgentTools()` changes should auto-trigger a sweep on existing clients via a one-shot script.

15. **The "5+ documented intentional gaps + 3 silent failure categories" framing in D447 is partially built on the bad audit data.** With the universal symptom refuted, the case for D447 weakens further. Path A (defer D447) is now the clear recommendation, not a judgment call.

## Suggested first action in next chat

```
read CALLINGAGENTS/00-Inbox/NEXT-CHAT-D442-Followup.md

# Then in priority order:
# 1. File D451 (audit-script extractor fix). Verify D446 isn't a duplicate first.
# 2. Re-verify exp-realty + urban-vibe + calgary-property-leasing tool drift with corrected scan (single dispatch).
# 3. syncClientTools() targeted add on hasan-sharif (and others if step 2 says pageOwner-only).
# 4. Ship D449 + D450 (cheap independent wins).
# 5. Defer D447 indefinitely; revisit only after a real partial_failure or novel-drift incident.
```

Recommend starting with **step 1 (D451)** — without fixing the extractor, every future audit will reproduce this phantom finding. Step 2 + 3 can be one parallel dispatch (re-verify reads the DB; sync writes one client's tools row).
