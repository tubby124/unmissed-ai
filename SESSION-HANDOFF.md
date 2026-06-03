# Session Handoff — 2026-06-03 — Brian Bug 3 SHIPPED + niche regression fixed

(Supersedes both 2026-06-02 handoffs. Bug 3 IS shipped to Brian.)

## Completed this session

- **Bug 3 LIVE on Brian** — surgical `regenerateSlot('returning_caller')` PATCHed his Ultravox agent. Returning callers no longer get topic presumption.
- **Niche regression caught + fixed** — Brian's `clients.tools` dropped from 5 → 4 immediately after the Bug 3 deploy. `submitMaintenanceRequest` was silently stripped because `buildAgentFlagsFromClient` was missing `niche`. Restored via defensive read-then-write script. Permanent code fix + 8-test regression suite landed.
- **Gotcha overuse fixed in code** — "gotcha" and "mhm" dropped from Rule 2 alternatives AND tone-rotation pool. Lands on Brian's next recompose.
- **Architectural fixes pushed** — faq_pairs scrape-leak guard, FORBIDDEN_EXTRA cap. Land on Brian via next recompose.
- **Knowledge audit ran post-deploy** — confirmed root cause of 0% queryKnowledge production hit rate: 9 scattered queryKnowledge instructions across 23K prompt → GLM-4.6 "lost in the middle." Tool IS registered (5 tools after restore), corpus IS populated (52 approved chunks). Fix is prompt consolidation, not tool/corpus work.

## Commits pushed this session (8 total)

| Commit | Subject | On Brian? |
|---|---|:---:|
| `ec4a6d96` | faq_pairs scrape-leak guard (Workstream B Phase 1) | not yet — code only |
| `3c8fd27d` | **Bug 3 fix** — returning-caller anti-presumption | **YES — live** |
| `ee65ea2f` | FORBIDDEN_EXTRA cap (Workstream B Phase 2a) | not yet — code only |
| `2ac8d665` | Harness + 50-call replay + audits | tooling |
| `c7e0e5dc` | Phase D baseline refresh | test fixtures |
| `f3e4a1bf` | Drop gotcha/mhm | not yet — code only |
| `cef527ce` | **Niche-missing fix + 8-test regression suite** | YES — applied via tool restore |

## Brian's current live state

```
clients.system_prompt: 23,184 chars
ultravox_agent_id: a30e9023-9dc5-4aa7-b7cf-b1cf623fb082
clients.tools: [hangUp, sendTextMessage, queryKnowledge, checkForCoaching, submitMaintenanceRequest]
knowledge_backend: pgvector · 52 approved chunks
trial_expires_at: 2026-06-15
```

## What's left to do — priority order

### P1 — Audit + restore Urban Vibe's tools (5 min, owner-gated)
Same `niche` regression likely affects Ray's PM agent. Standing rule blocks investigation without explicit go. Easy fix when ready (after parameterizing the scripts which are currently Brian-hardcoded).

### P2 — Knowledge routing consolidation (next session)
**The real fix for 0% queryKnowledge production rate.** Consolidate 9 scattered instructions into 1-2 in a single slot. Most likely consolidation point: QUESTION INTAKE at top of property_management TRIAGE_DEEP becomes THE canonical instruction; other 8 references get trimmed.

Existing tooling at `tests/promptfoo/knowledge-routing/`:
```bash
npx tsx tests/promptfoo/knowledge-routing/audit.ts --slug calgary-property-leasing
npx tsx tests/promptfoo/knowledge-routing/query-preview.ts --slug calgary-property-leasing  # "see what would happen"
npx tsx tests/promptfoo/knowledge-routing/corpus-inspect.ts --slug calgary-property-leasing
npx tsx tests/promptfoo/knowledge-routing/audit.ts --all  # fleet check
```

### P3 — Land Phase 1 + 2a + gotcha fix on Brian
Code is committed; needs a recompose for Brian's stored prompt to inherit. Options:
- Natural: Brian edits any setting in dashboard → slot regen → fixes propagate
- Surgical (low-risk): `regenerateSlots(['forbidden_actions', 'tone_and_style', 'faq_pairs'])` for Brian
- Full recompose: touches every slot, larger blast radius — schedule for off-hours

### P4 — Knowledge corpus reseed (independent of prompt work)
Brian's audit: 3/5 scenarios return zero chunks (rent-guarantee, pets-policy, application-process). His `extra_qa` has 7 entries; some need reseeding. Fix via `/api/dashboard/knowledge/compile` OR `reseedKnowledgeFromSettings()`.

### P5 — CI gate for knowledge routing (Hasan's explicit ask — protects new onboarding)
After P2 ships, add `audit.ts --all --strict --no-report` to pre-push hooks. Catches any future client whose 9-mention bloat would regress routing.

### P6 — Tiered cap softening (deferred — current state works)
Soft warn at 12K, hard error at 18K. Low priority.

## How to continue

```
Read SESSION-HANDOFF.md and Projects/unmissed/2026-06-03-brian-bug3-shipped-niche-regression-fixed.md.

Pick up from P1 (Urban Vibe niche-tool audit) or P2 (knowledge routing
consolidation). Both are independent. P2 is the higher-impact one.

For P2 the fix is: in src/lib/prompt-config/niche-defaults.ts for property_management,
consolidate the 9 queryKnowledge references into 1-2 clear instructions in a
single slot. Run query-preview.ts + audit.ts before and after to verify
behavior change.
```

## Standing rules reminder

- No redeploys to hasan-sharif, exp-realty, urban-vibe without explicit owner go
- Brian (calgary-property-leasing) has explicit carve-out
- `git push` to unmissed-ai is pre-authorized per `~/.claude/CLAUDE.md` autonomy authorization
- `--live` regenerate is the customer-impact step — needs explicit user go each time

## Files written/modified this session

- src/lib/prompt-slots.ts (Bug 3 + gotcha)
- src/lib/slot-regenerator.ts (niche fix + buildAgentFlagsFromClient export)
- src/lib/__tests__/slot-regenerator-flags-truth.test.ts (NEW — 8-test regression suite)
- src/lib/__tests__/snapshots/*.txt (Layer 1 goldens regenerated 2x)
- tests/reference/post-phase-d-baseline/*.txt (Phase D baselines regenerated 2x)
- tests/promptfoo/brian-baseline.yaml (NEW — 15-scenario suite)
- tests/promptfoo/brian-replay-2026-06-02.yaml (NEW — 25 real caller turns)
- tests/promptfoo/snapshots/*.txt (NEW — 9 client prompt snapshots)
- scripts/* (16 new helper scripts including restore-brian-tools.ts)
- CALLINGAGENTS/00-Inbox/2026-06-02-brian-* (3 audit/decision docs)
- CALLINGAGENTS/Clients/calgary-property-leasing.md (appended)
- ~/Downloads/Obsidian Vault/Projects/unmissed/2026-06-02-brian-prompt-slim-harness-bug3.md (NEW)
- ~/Downloads/Obsidian Vault/Projects/unmissed/2026-06-03-brian-bug3-shipped-niche-regression-fixed.md (NEW)
- ~/Downloads/Obsidian Vault/daily-logs/2026-06-02.md (NEW)
- SESSION-HANDOFF.md (this file)
