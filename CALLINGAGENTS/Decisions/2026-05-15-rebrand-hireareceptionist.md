---
type: decision
date: 2026-05-15
status: SUPERSEDED-2026-05-16
superseded_by: 2026-05-16-rebrand-endvoicemail.md
tags: [decision, branding, domain, marketing, superseded]
related: [["Project/Index"]]
---

> ⚠️ **SUPERSEDED 2026-05-16** — `hireareceptionist.com` was NOT purchased. After a second round of brainstorming on 2026-05-16, the anti-voicemail brand frame emerged as a structurally stronger position. **`endvoicemail.ai` was purchased on 2026-05-16 (2-year term)** as the actual rebrand destination. See `Decisions/2026-05-16-rebrand-endvoicemail.md` for the new ADR.
>
> This document is preserved for the option-comparison rationale (especially Options B + D — Zara character brand killed by Inditex TM risk, nevermiss.co killed by .com loss) which still applies to future naming decisions.

# Decision: Rebrand `unmissed.ai` → `hireareceptionist.com` [SUPERSEDED]

## Context

`unmissed.ai` (current brand) has real friction for client acquisition:
- Hard to spell — buyers (trades, plumbers, real estate) don't intuit "unmissed"
- Hard to say on a phone call — has to be explained every time
- `.ai` TLD signals "AI tool" to tech buyers, but Hasan's audience is non-technical service-business owners who trust `.com`
- Costs $90+/yr to renew (`.ai` registry pricing) when `.com` is $10/yr

The rebrand happened in the context of figuring out what's blocking client acquisition for unmissed.ai. Hasan acknowledged he hasn't done enough cold outreach to know where the funnel actually breaks (answer "E" — honestly don't know, haven't tried hard enough yet). The name was identified as one removable friction point even at low volume — but explicitly NOT the bottleneck. Real bottleneck = volume of contact attempts.

**Honest framing logged in conversation:** "A new name doesn't fix an empty funnel. But `hireareceptionist.com` removes one explanation step from every cold conversation, which compounds at volume."

## Options Considered

### Option A — Keep `unmissed.ai`, reposition as descriptor in marketing
- Use "AI Receptionist for [niche]" as the descriptor in every cold call/email/GBP listing
- Keep the legal entity as unmissed.ai
- **Pro:** Zero engineering. Domain stays. Pivot is just copy changes.
- **Con:** Buyers still see `unmissed.ai` in URLs/emails/business cards — same friction persists.

### Option B — Zara character brand (`tryzara.com` or `hirezara.ai`)
- Leverage existing demo agent name in `lib/demo-prompts.ts`
- `tryzara.com` available ($10/yr); `tryzara.ai` available ($90/yr)
- **Pro:** Memorable, on-brand with existing code, charming
- **Con:** Inditex (fashion Zara) trademark bullying potential — different class so legal standing is weak, but big retailers can lawyer-bully small startups. Word-of-mouth confusion ("Zara? the fashion brand?") is real friction.

### Option C — `hireareceptionist.com` (descriptor as brand)
- Verb + noun pitch baked into the URL
- $10/yr `.com`
- Long but unambiguous
- **Pro:** Zero trademark risk. Descriptor IS the pitch. SEO-friendly. Buyer immediately understands what the product does.
- **Con:** Long to say on a phone, no brand mystique, harder to trademark as wordmark.

### Option D — `nevermiss.co` (descriptor in `.co`)
- $25/yr
- **Pro:** Strongest standalone pitch ("never miss a call")
- **Fatal con:** `nevermiss.com` is TAKEN. Trades buyers will type `.com` and land on someone else's site. Permanent typo traffic loss.

## Decision

**Buy `hireareceptionist.com` ($10/yr) immediately.**

**Reasoning:**
1. The product solves "I need a receptionist but can't afford a human one." The domain literally says that.
2. Service-biz buyers don't need brand mystique — they need to understand the product in 3 seconds. The URL does that work.
3. Zero trademark risk eliminates the lawyer-bullying tail risk of Zara.
4. `.com` ownership means typo traffic isn't lost.
5. Cheapest of all viable options.

**Standing question (defer):** Whether to add `tryzara.com` ($10) as a campaign-specific second domain for "free trial" landing pages. Not needed today.

## Consequences

### What this enables
- All cold outreach copy can lead with "Hire A Receptionist (the AI version) for [niche]" — descriptor IS the brand
- Email signatures, GBP listing, business cards become self-explanatory
- SEO opportunity: `/hire-a-receptionist-for-[niche]` programmatic pages have built-in keyword match
- Lower annual cost than `unmissed.ai` renewal

### What this rules out
- Brand mystique / aspirational positioning (compare: "Slack" vs "BusinessChat.com")
- One-word brand recall — nobody remembers "hireareceptionist" as a logo, they remember "the AI receptionist site"
- Standing as a defensible wordmark trademark (descriptive marks are weak under Lanham Act)

### Migration cost (when triggered, NOT NOW)
Per `src/lib/brand.ts` — single source of truth file. Domain migration = 1 file + 1 env var per `S15` in refactor-phase-tracker.
- Update `BRAND_NAME`, `BRAND_DOMAIN` in `src/lib/brand.ts`
- Update Railway env vars (`APP_URL`, `SITE_URL`)
- Update Supabase auth redirect URLs to new domain
- Update Twilio webhook URLs to new domain
- Update Ultravox webhook URL to new domain
- Update Resend domain verification (SPF/DKIM/DMARC)
- Existing 4 paying clients (`hasan-sharif`, `exp-realty`, `windshield-hub`, `urban-vibe`) — phone numbers and Twilio routing unaffected; only the dashboard URL changes
- Standing rule from refactor-phase-tracker P0: **No redeployment to existing 4 clients without explicit approval.**

### Known risks
- "Hire a receptionist" as a wordmark is too descriptive to register cleanly — competitors can use the same words descriptively
- Long URL is awkward to verbally share ("hire-a-receptionist-dot-com" is 9 syllables)
- Mitigation: lead with the product description in cold outreach; the URL is the followup, not the opener

## How We Found It — Domain Mass-Check Technique

Reusable for any future product naming (True Color sub-brands, real estate tools, etc).

### Step 1 — Generate candidates programmatically
Use Python word-list combinatorics across 4 lanes:
- **Descriptors** — what the product does (`frontdesk`, `receptionist`, `answer`)
- **Verbs/actions** — what the customer does (`hire`, `try`, `get`, `meet`)
- **Character names** — agent persona (`zara`, `aria`, `mira`)
- **Abstract/coined** — invented words (`vexa`, `klari`, `kova`)

Combine via prefix/suffix loops. Filter to 4-10 chars, alpha only, no triple-letter typos.

### Step 2 — Check availability via direct registry RDAP (NOT whois)
**Why RDAP not whois:**
- macOS `whois` doesn't chase referrals → returns useless TLD metadata for `.com` queries
- `.ai` whois rate-limits at 1 query / 5+ seconds → script chokes
- Direct registry RDAP endpoints are HTTP, fast, no rate limits at moderate volume

**Endpoints (verified 2026-05-15):**
- `.com` → `https://rdap.verisign.com/com/v1/domain/X.com`
- `.ai` → `https://rdap.identitydigital.services/rdap/domain/X.ai`
- `.co` → `https://rdap.identitydigital.services/rdap/domain/X.co`
- General fallback (with `-L` for redirects): `https://rdap.org/domain/X.tld`

**Signal:** `404 = AVAILABLE`, `200 = TAKEN`, `000 = rate-limited / try lower parallelism`

**Bash pattern (parallel-aware):**
```bash
for d in name1.com name2.com ...; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 \
    "https://rdap.verisign.com/com/v1/domain/$d" 2>/dev/null)
  if [ "$code" = "404" ]; then echo "AVAILABLE  $d"; fi
done
```

For `.com` — parallel-OK (use `xargs -P 12`). For `.ai` — go serial or P=2 (rate limits).

### Step 3 — Honest framing of what's available
**Brutal reality discovered 2026-05-15:**
- All 4-5 letter `.com` (`kova`, `vexa`, `klari`, `tryara`, `meetara`, etc.) → TAKEN
- All single-word descriptor `.com` (`nevermiss`, `alwaysanswer`, `myreceptionist`) → TAKEN
- All single-word descriptor `.ai` ($90/yr) — most TAKEN; only `meetara.ai` and `intakly.ai` survived from 20-name sample
- Long descriptor `.com` (`hireareceptionist`) → AVAILABLE because squatters skip them
- `.co` ($25/yr) — much wider availability for descriptors; trades buyers may default-type `.com` and lose traffic

**Strategy that works:** long descriptor `.com` > Zara character `.com` > short `.ai` > `.co` for service-biz audience.

### Step 4 — Filter for sayability
- Avoid missing vowels (`answrly`, `intakly` — spelling friction)
- Avoid double-meaning words (`pickup` = also slang)
- Test by saying it on a fake voicemail leave: "Hi this is Hasan from [domain].com" — does it parse?

## Related

- [[Project/Index]] — main project MOC
- [[../Product/April-14-Audit-Pivot]] — pivot context (manual concierge $29/mo go-to-market)
- [[../00-Inbox/2026-05-15-domain-mass-check-technique]] — extended candidate sweep results

## Pending

- [ ] Buy `hireareceptionist.com` on Namecheap
- [ ] Update `src/lib/brand.ts` (BRAND_DOMAIN constant) — but DO NOT trigger S15 migration on existing 4 clients without separate approval
- [ ] Add `hireareceptionist.com` to outbound cold-call/email scripts as the new pitch URL
- [ ] Decision pending: also buy `tryzara.com` ($10) as a campaign secondary domain?
