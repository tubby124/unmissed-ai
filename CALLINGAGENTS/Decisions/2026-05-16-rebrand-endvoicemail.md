---
type: decision
date: 2026-05-16
status: LOCKED-PURCHASED
supersedes: 2026-05-15-rebrand-hireareceptionist.md
tags: [decision, branding, domain, marketing, purchased]
related: [["Project/Index"]]
---

# Decision: Rebrand `unmissed.ai` → `endvoicemail.ai` (PURCHASED 2026-05-16)

## Status

**PURCHASED 2026-05-16, 2-year term, expires ~2028-05-16.**
Renewal reminders set in Hasan's Google Calendar: 2028-04-16 (30 days pre) + 2028-05-09 (7 days pre).

This supersedes `2026-05-15-rebrand-hireareceptionist.md`. That prior ADR locked `hireareceptionist.com` but it was never registered. Within 24 hours, a second brainstorming round produced the anti-voicemail brand frame, which is structurally stronger.

## Context

After locking `hireareceptionist.com` on 2026-05-15, the URL felt "missing something" on review the next day. The diagnostic: pure role-descriptor URLs ("hire a receptionist") have low brand energy — they describe the solution without naming the buyer's pain. Anti-voicemail frames ("end voicemail") name the enemy directly.

A 95+ candidate sweep on 2026-05-16 across 5 patterns confirmed:
- All short `.com` outcome-words are squatted (handled, covered, answered, picked, sorted — all taken)
- All short `.ai` 3-4 letter brand candidates are squatted or premium-registry (vox, nex, biz, fix — all gone)
- All ring-prefix domains create direct-competitor confusion (RingFlow, RingFlowHQ, RingCentral)
- The anti-voicemail category is **untapped** — `byevoicemail.com`, `novoicemails.com`, `endvoicemail.ai`, `killvoicemail.ai` all available

Among anti-voicemail variants, `endvoicemail.ai` was selected over `byevoicemail.com` for:
- Verb strength: "End" is more decisive than "Bye"
- `.ai` signals AI product category (matches buyer expectation)
- TLD positioning aligns with existing voice-AI brand patterns (Ultravox, Vapi, ElevenLabs)

## Decision

**Rebrand `unmissed.ai` → `endvoicemail.ai`. Domain purchased 2026-05-16.**

### Why this beats the prior pick

| Dimension | `hireareceptionist.com` (prior) | `endvoicemail.ai` (purchased) |
|---|---|---|
| Brand frame | Role descriptor | **Pain elimination** |
| Tagline | "Hire a receptionist — the AI version" | **"End Voicemail."** (self-contained) |
| Length | 17 chars / 9 syllables | 13 chars / 4 syllables |
| Buyer hook | Neutral pull ("I want a receptionist") | **Active push from pain** ("I hate voicemail tag") |
| Competitor space | Crowded receptionist-AI category | **Empty anti-voicemail category** |
| Phone-spell test | passes | passes |
| TM risk | zero | zero |

### Why `.ai` over `.com`

- `endvoicemail.com` was already TAKEN by a third party (no active competitor, just parked)
- `.ai` signals AI product to the technical audience that drives word-of-mouth in this category
- The audience-readiness penalty of `.ai` for non-technical buyers is offset by the strength of the tagline ("End Voicemail.") which is what they actually remember

## Consequences

### What this enables

- **Stronger cold-outreach hook:** "Tired of voicemail tag? End it." beats "Hire a receptionist for $29/mo."
- **Tagline = brand:** "End Voicemail." carries the entire pitch in 2 words
- **Differentiated positioning:** the anti-voicemail frame is unclaimed in the AI-receptionist category
- **Email/domain consolidation:** `hello@endvoicemail.ai`, `support@endvoicemail.ai` etc.

### What this rules out

- The SEO defensive value of `hireareceptionist.com` (could still be acquired separately as $10 redirect — pending decision)
- Direct keyword match for "hire a receptionist" Google search query
- `.com` typo-defense (`endvoicemail.com` belongs to someone else)

### Migration cost (S15 in refactor-phase-tracker)

Per `src/lib/brand.ts` — single source of truth file.

- [ ] Update `BRAND_NAME` constant in `src/lib/brand.ts`
- [ ] Update `BRAND_DOMAIN = "endvoicemail.ai"` in `src/lib/brand.ts`
- [ ] Update Railway env vars (`APP_URL`, `SITE_URL`)
- [ ] Update Supabase auth redirect URLs to `endvoicemail.ai`
- [ ] Update Twilio webhook URLs to `endvoicemail.ai` per-client (coordinate with no-redeployment rule)
- [ ] Update Ultravox webhook URL to `endvoicemail.ai`
- [ ] Configure DNS at registrar: A/ALIAS for root → Railway; CNAME for www → root; MX + TXT for Resend
- [ ] Resend domain verification: new SPF / DKIM / DMARC on `endvoicemail.ai`
- [ ] **Standing rule from refactor-phase-tracker P0:** No redeployment to existing 4 paying clients (hasan-sharif, exp-realty, windshield-hub, urban-vibe) without explicit approval. Phone numbers + Twilio routing are unaffected — only their dashboard URL changes.

### Known risks

- **`.com` typo loss:** Anyone hearing "end voicemail dot com" lands on the parked third-party domain. Mitigation: lead with `.ai` in ALL copy; do not verbally pronounce the TLD as "dot com" by accident.
- **Audience-readiness for `.ai`:** Plumber audience may not know what `.ai` means. Mitigation: tagline carries the pitch; URL is the follow-up not the opener.
- **Renewal lapse:** Anti-voicemail brand frame is unclaimed today but valuable. If `endvoicemail.ai` lapses, a competitor will register it. Mitigation: calendar reminders set at 30d + 7d pre-expiry; recommend enabling registrar auto-renew.

## Pending decisions

- [ ] Buy `hireareceptionist.com` ($10) as cheap SEO defensive redirect to `endvoicemail.ai`? Verdict TBD.
- [ ] Buy `fullbars.ai` ($55) as dual-brand short URL for cold-call hook? Originally locked but now pending given the anti-voicemail single-brand option is cleaner.
- [ ] Marketing copy refresh: rewrite all cold-outreach drafts, SMS scripts, GBP listing to "End Voicemail" frame.

## Related

- [[Project/Index]]
- Superseded ADR: `Decisions/2026-05-15-rebrand-hireareceptionist.md`
- Vault entry: `~/Downloads/Obsidian Vault/Projects/unmissed/2026-05-16-domain-purchased-endvoicemail-ai.md`
- Shortlist history: `~/Downloads/Obsidian Vault/Projects/unmissed/2026-05-15-domain-name-shortlist-and-recheck-process.md`
- Calendar event IDs:
  - Renewal 30-day: `2nbk9rjv3leikg93nlm3jlfkm8`
  - Renewal 7-day: `hrohg0tqn2ulh36rnadvb8l084`
