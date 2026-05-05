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
- ✅ Dry-run + investigation complete (2026-04-30 PM) — see [[../00-Inbox/urban-vibe-migration-decision.md]] (TWEAK FIRST → GO)
- 🟡 5 open questions for Ray before deploy:
  1. Billing reality: paying / free / concierge? (`subscription_status=none` ambiguity)
  2. SMS auto-follow-up: keep `sms_enabled=true` (new prompt sends SMS after every call) or disable?
  3. Transfer for true P1 emergencies: strict callback-only or P1-only transfer?
  4. Greeting capability list ("log maintenance requests / get Ray to call you back / rental inquiries"): worth re-adding?
  5. VIP_PROTOCOL slot: dormant for now (no VIP contacts), accept as-is?
- 🔴 Slot-pipeline hours-rendering bug surfaced by this dryrun (`8:30am` → `8:30 AMam`) — affects ANY client with no-space am/pm. File as separate D-item before any migration ships.

## Pre-deploy Phase A (gated on Ray's GO)
1. `voice_style_preset` → `professional_warm`
2. `niche_custom_variables` → `{CLOSE_PERSON: "Ray", FORBIDDEN_EXTRA: <gotcha+AI-assistant+Atco rules>}`
3. `business_facts` → Calgary/Atco/Ray identity context
4. `business_hours_*` → reformat with proper spaces (sidesteps hours bug until fixed)
5. Resolve `subscription_status` ambiguity (Hasan/Ray decision)

## Connections
- → [[Tracker/D445]] (snowflake migration master)
- → [[Architecture/Snowflake-Migration-Deep-Plan]] (per-client risk)
- → [[Projects/unmissed/2026-04-30-d445-hasan-dryrun-no-go-pivot-to-urban-vibe]] (decision)
