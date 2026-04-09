---
type: tracker-archive
updated: 2026-04-01
---
# Tracker Archive — Completed & Removed Items

All D-items below are DONE, REMOVED, or SUPERSEDED as of 2026-04-01.
Individual tracker files kept for reference but excluded from active planning.

---

## Completed (53 items)

### Phase 1-3 (Prompt Architecture Foundation)
| # | Title | Completed |
|---|-------|-----------|
| D235 | Knowledge reseed gate removal | 2026-03-31 |
| D285 | Prompt sandwich framework spec | 2026-03-31 |
| D274 | Named slots system | 2026-03-31 |
| D265 | Remove PRODUCT KNOWLEDGE BASE from prompt | 2026-03-31 |
| D268 | Minimal base prompt + dynamic sections | 2026-03-31 |
| D269 | Knowledge base as primary info source (pgvector) | 2026-03-31 |
| D272 | Remove business-logic constraints from prompts | 2026-03-31 |
| D296 | FORBIDDEN_EXTRA dead code fix | 2026-03-31 |

### Phase 4 (Gap Wiring)
| # | Title | Completed |
|---|-------|-----------|
| D260 | Service catalog → agent runtime sync | 2026-03-31 |
| D281 | CLOSE_PERSON (owner_name) editable post-onboarding | 2026-03-31 |
| D282 | Business name change patches prompt + Ultravox | 2026-03-31 |

### Phase 5 (Agent Knowledge UX)
| # | Title | Completed |
|---|-------|-----------|
| D283a | Prompt variable registry (39 vars) | 2026-03-31 |
| D283c | Section-level regeneration | 2026-03-31 |
| D300 | Service catalog knowledge reseed | 2026-03-31 |

### Phase 6 Wave 1 (North Star Backend)
| # | Title | Completed |
|---|-------|-----------|
| D302 | Preserve niche intake fields during onboarding | 2026-03-31 |
| D280 | recomposePrompt (UI-driven prompt composition) | 2026-03-31 |
| D303 | Variable edit API | 2026-03-31 |
| D305 | Dry-run prompt preview (backend) | 2026-03-31 |
| D276 | Booking toggle auto-updates call flow | 2026-03-31 |

### Phase 6 Wave 2 (Dashboard UI)
| # | Title | Completed |
|---|-------|-----------|
| D278 | Overview page 5-tier redesign | 2026-03-31 |
| D309 | Knowledge page 5-tier redesign | 2026-03-31 |
| D310 | Knowledge health score | 2026-03-31 |
| D311 | GBP provenance save fix + Overview KB tile | 2026-04-01 |
| D312 | Settings page bento grid layout | 2026-04-01 |
| D313 | Telegram bot link click-through | 2026-04-01 |
| D314 | Unified dashboard (kill first-visit branch) | 2026-04-01 |

### Phase 7 (Onboarding + Intelligence)
| # | Title | Completed |
|---|-------|-----------|
| D241 | Unknown niche AI inference | 2026-03-31 |
| D247 | Owner intent→outcome mapping in onboarding | 2026-03-31 |
| D318 | Step 3 bloat — deleted entirely | 2026-04-01 |
| D319 | Voice picker simplified to Male/Female | 2026-04-01 |
| D321 | Step 3+5 duplicate FAQ — both removed | 2026-04-01 |
| D316 | Hardcoded caller reason examples fixed | 2026-04-01 |
| D324 | Plan = Mode (derive mode from plan) | 2026-04-01 |
| D326 | Paste-and-parse preserves structured service data | 2026-04-01 |
| D339 | CLOSE_PERSON + greeting override + intelligence seed | 2026-04-01 |
| D343 | Order read-back in restaurant TRIAGE_DEEP | 2026-04-01 |
| D347 | CLOSE_PERSON fallback skip business name | 2026-04-01 |
| D348 | Accept .md and .txt in document uploader | 2026-04-01 |

### Phase 7 CRM + Contacts
| # | Title | Completed |
|---|-------|-----------|
| D334 | Phone normalization shared utility | 2026-04-01 |
| D335 | client_contacts table + backfill + VIP migration | 2026-04-01 |
| D336 | Auto-populate contacts on call completion | 2026-04-01 |
| D337 | Enrich buildAgentContext from client_contacts | 2026-04-01 |
| D338 | VIP read migration (3 runtime paths) | 2026-04-01 |

### Dashboard Polish + Fixes
| # | Title | Completed |
|---|-------|-----------|
| D275 | Voice preset personality fake-control fix | 2026-03-31 |
| D251 | Per-section prompt editor (triage for non-admin) | 2026-03-31 |
| D252 | Knowledge gap → one-click fix CTA | 2026-03-31 |
| D254 | CallRoutingCard (post-onboarding reasons edit) | 2026-03-31 |
| D257 | Self-improving agent flywheel (suggest-improvements) | 2026-03-31 |
| D249 | Agent readiness gate | 2026-03-31 |
| D351 | Overview knowledge card real counts | 2026-04-01 |
| D352 | Knowledge query defaultReaction fix | 2026-04-01 |
| D354 | Unanswered questions moved under orb | 2026-04-01 |

### Ops + Tracker Housekeeping
| # | Title | Completed |
|---|-------|-----------|
| D233 | Verify CRON_SECRET in Railway | 2026-03-31 |
| D245 | Intent routing test on active clients | 2026-03-31 |
| D342 | Tracker status cleanup for Phase 7 items | 2026-04-01 |

---

## Removed / Superseded (5 items)

| # | Title | Reason |
|---|-------|--------|
| D228 | (Empty / never written) | Removed — no content |
| D240 | Niche intent audit | Removed — absorbed into D241+D247 |
| D277 | Lag investigation (plumber-calgary-nw) | Removed — fixed by architecture refactor (D268) |
| D315 | Niche badge on GBP card | Superseded — step3 deleted, absorbed into step1-gbp |
| D320 | urgencyWords not stored | Superseded — replaced by intelligence seed URGENCY_KEYWORDS |

---

## Duplicate Merges (2026-04-01 cleanup)

| Kept | Absorbed | Reason |
|------|----------|--------|
| D341 | D283b, D358 | All = PromptVariablesCard. D341 is canonical. D358 scope merged in. |
| D346 | D264 | Both = upload CTAs on Overview. D346 more specific. |
| D359 | D270 | Both = frequent KB query auto-suggest. D359 extends D270. |
| D345 | D322 | D345 subsumes D322 (loading indicators). |
| D297 | D284 | D284 is meta-vision. Components tracked as D252/D257/D297 individually. |
