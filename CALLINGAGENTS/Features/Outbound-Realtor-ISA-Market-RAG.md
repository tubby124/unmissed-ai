---
type: feature
status: future-roadmap
tags: [outbound, real-estate, isa, rag, market-data, multi-month]
related: [[Features/Recording-Consent]], [[Architecture/call-path-capability-matrix]]
---

# Outbound Realtor ISA + Market RAG

## Vision (in user's words)

> "We're going to be able to dial outbound, and this would be so beneficial for realtors that want to basically get their leads qualified… for like a lead browsing homes on my website. What are you actually looking for? Do you want to actually sit down with a realtor? Do you have any questions about the market? You could train it on like some rag database that we make about a specific market."

The end state: a realtor's website visitor browses listings → drops phone number into a widget → unmissed.ai dials them within minutes with a qualifying ISA agent that knows the local market and books to the realtor's calendar (or transfers).

This applies beyond real estate too — any niche where lead-source data + outbound qualification adds value (HVAC quote follow-ups, dental new-patient outreach, etc.). Real estate is the flagship niche because the pattern fits perfectly and market data is rich.

## Status

**Document only.** Multi-month build. Do not start implementation yet. Recording consent (the universal prerequisite) is shipped — see [[Features/Recording-Consent]]. The realtor prompt rebuild + intent branching (Buy/Sell/Eval/Rent) is the immediate next piece — that's a self-contained PR after Wave 1-3 ship.

## Component breakdown

### A — Web widget on the realtor's site

- Captures lead intent: which listings they viewed, time on each listing, search filters used, location preferences
- Renders a "Talk to me about this listing in 2 min" CTA after N seconds or N listings viewed
- Form: name + phone + (optional) what they're looking for
- POSTs to a new `outbound_intent_capture` API → enqueues an outbound call

### B — Outbound dialer infrastructure (does NOT exist yet)

Per [[Architecture/call-path-capability-matrix]] §1, Path F = no production outbound system. Demo `/api/demo/call-me/route.ts` is the only outbound path and it's marketing-demo only.

To productize:
- `outbound_campaigns` and `campaign_leads` tables (partial scaffolding exists in migrations: `20260330200000_create_outbound_connect_tokens.sql`, `20260412000000_add_outbound_scheduling_columns.sql`)
- A dialer worker (cron or queue-based) that:
  - Pulls unworked leads from `campaign_leads` ordered by recency × intent score
  - Honors per-client rate limits + per-lead 24h cooldown
  - Calls Twilio outbound + bridges to Ultravox per call
  - Writes outcomes back to `campaign_leads.status`
- Integration with the existing `outbound-prompt-builder.ts` and `dial-out` handler (already built — see `src/app/api/dashboard/leads/dial-out/route.ts`)

### C — Market RAG per realtor

Per-client knowledge corpus stuffed with:
- MLS data feed (active listings + sold comps) — paid feed, region-specific (CREA in Canada, Bright/MRED in US)
- Neighborhood briefs — school ratings, walkability, commute, average price per bed
- Recent sale history any address mentioned on a call
- Local market commentary — interest rate context, inventory levels, days-on-market trends

Piggybacks on existing pgvector pipeline ([src/lib/embeddings.ts](../../src/lib/embeddings.ts)). Each realtor gets:
- A nightly refresh job pulling new MLS data
- A higher trust-tier weight in retrieval for market-data chunks (vs operator-entered facts)
- A new `market_data` source tag in `knowledge_chunks.source`

### D — Outbound prompt template

`outbound_isa_realtor` niche already exists ([src/app/onboard/steps/niches/outbound-isa-realtor.tsx](../../src/app/onboard/steps/niches/outbound-isa-realtor.tsx)). Prompt structure is partially built. Needs:
- Lead-context injection at call time: which listing(s) they viewed, search filters
- Qualifying flow per intent (Buy timeline / area / price / pre-approval; Eval address / motivation / timeline)
- Book-or-transfer close depending on intent strength
- Market-data lookup tool wired to the per-realtor RAG

## Compliance gates (HARD requirements before any outbound goes live)

| Gate | Status |
|------|--------|
| Recording consent acknowledged | ✅ Shipped (Wave 1.5) |
| DNCL (Do Not Call List, Canada) scrubbed per call | TODO — paid feed integration |
| TCPA written consent for US numbers (form on widget) | TODO — captured at lead-form submit |
| Time-of-day restrictions per province/state | TODO — block calls outside 9 AM–9 PM local |
| Caller ID = realtor's verified business number | TODO — Twilio CNAM/verified caller ID |
| 24h cooldown if lead asks not to be called | TODO — write `do_not_contact_until` to `campaign_leads` |

## Next steps (when this gets prioritized)

1. Spec the lead-capture widget (embed format: iframe vs JS snippet vs WordPress plugin)
2. Validate outbound caller-ID legality per province (some require business reg)
3. Pick MLS feed provider for Canada (CREA DDF) + US (Bright)
4. Build the dialer worker with rate limiting + cooldown
5. Generalize beyond real estate — add per-niche outbound playbooks

## Why this is in the vault now

To stop losing the vision between sessions. The pieces (consent gate, outbound prompt builder, dial-out endpoint, scheduling columns) are already partially in place from earlier work. When Hasan revisits this, the assembly path should be obvious.
