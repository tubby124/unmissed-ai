---
type: client
status: active
slug: urban-vibe
ultravox_agent_id: 5f88f03b-5aaf-40fc-a608-2f7ed765d6a6
voice_id: df0b14d7-945f-41b2-989a-7c8c57688ddf
plan: pro
tags:
  - client
  - property-management
  - calgary
  - snowflake-migration-target
related:
  - "[[Tracker/D445]]"
updated: 2026-04-30
---

# Urban Vibe — Ray Kassam / Alisha (Calgary Property Management)

> **2026-04-30:** Niche corrected from `beauty` (was wrong) to `property-management`. Plan corrected from Core to Pro. Next migration target after Hasan dryrun NO-GO. See [[Projects/unmissed/2026-04-30-d445-hasan-dryrun-no-go-pivot-to-urban-vibe]].

## Identity
| Field | Value |
|-------|-------|
| Slug | `urban-vibe` |
| Client ID | `42a66c19-e4c0-4cd7-a86e-7e7df711043b` |
| Ultravox Agent | `5f88f03b-5aaf-40fc-a608-2f7ed765d6a6` |
| Voice | Ashley `df0b14d7-945f-41b2-989a-7c8c57688ddf` — **Ray's personal pick, locked, sensitive to tone drift** |
| Plan | Pro (DB), `subscription_status: none` ⚠️ inconsistency to investigate |
| Niche | `property-management` |
| Twilio | `+15873296845` |
| Forwarding | `+14036057142` |

## CRITICAL Rules (must survive any migration)
- Say "virtual assistant" NOT "AI assistant"
- Word **"gotcha" is BANNED** — forever, all agents. Use "got it" instead. **CONFLICT with slot pipeline `tone_and_style` which uses "gotcha" in backchannels.**
- "Atco Emergency" scripted response for gas smell (Calgary-specific utility)
- **Callback-only** — "Never pretend to transfer or put someone on hold." Despite `forwarding_number` being set.
- Property-management never-list: never confirm rent, availability, pet policy, parking, utilities — route to Ray
- RTA / eviction / landlord-rights questions → deflect to Ray (Alberta legal)

## Snowflake-migration state
- `system_prompt`: 9,623 chars, **legacy monolithic** (no `<!-- unmissed:* -->` markers)
- `niche_custom_variables`: `null`
- `business_facts`: `null`
- `extra_qa`: 1 entry (Ray callback policy — clean, not junk)
- 34 approved `knowledge_chunks` ✅
- Last sync: success (2026-03-30)
- Tools drift: D442 audit found DB(5) vs Ultravox(5) — DB has `pageOwner`, UV has `hangUp` — universal `clients.tools` divergence pattern, not urban-vibe-specific

## Active Features
- [ ] Booking — `booking_enabled=false`
- [x] SMS — `sms_enabled=true`
- [ ] Transfer — `forwarding_number` set but prompt says callback-only (decision needed)
- [ ] IVR — `ivr_enabled=false`
- [x] Knowledge RAG — pgvector, 34 chunks

## Open Issues
- ⚠️ Snowflake migration target — see [[Tracker/D445]]
- ⚠️ Pre-migration blockers documented in [[Projects/unmissed/2026-04-30-d445-hasan-dryrun-no-go-pivot-to-urban-vibe]] — investigate before dryrun:
  1. "gotcha" word ban vs slot pipeline conflict
  2. Stale "PENDING DEPLOY for buildVoicemailPrompt()" item — still relevant?
  3. `selected_plan=pro` + `subscription_status=none` billing inconsistency
  4. forwarding_number + callback-only stance — keep transfer disabled or activate it?

## Connections
- → [[Tracker/D445]] (snowflake migration master)
- → [[Architecture/Snowflake-Migration-Deep-Plan]] (per-client risk)
- → [[Projects/unmissed/2026-04-30-d445-hasan-dryrun-no-go-pivot-to-urban-vibe]] (decision)
