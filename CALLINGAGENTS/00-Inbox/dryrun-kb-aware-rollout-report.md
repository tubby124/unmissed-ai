# KB-Aware Rollout Dry-Run

Generated: 2026-05-06T22:09:09.378Z
Method: `recomposePrompt(clientId, userId, dryRun=true, forceRecompose=true)`

READ-ONLY. No DB writes. No Ultravox calls. Per-client previewPrompt + currentPrompt JSON in this folder.

## Summary

| Slug | Niche | Tuned | KB chunks | Chars (cur→new, Δ) | New kb-aware lines | Old blanket lines stripped | Safety guards (cur/new) | Status |
|---|---|---|---|---|---|---|---|---|
| calgary-property-leasing | property_management | false | 16 | 20216→21840 (+1624) | 5 | 0/0 | 2/2 | ✅ kb-aware |
| hasan-sharif | real_estate | true | 29 | 8342→24455 (+16113) | 2 | 0/0 | 1/2 | ✅ kb-aware |
| urban-vibe | property-management | true | 34 | 18878→21712 (+2834) | 5 | 1/1 | 2/2 | ✅ kb-aware |
| velly-remodeling | other | true | 0 | 7775→14231 (+6456) | 0 | 0/0 | 0/1 | 🟡 review |
| windshield-hub | auto-glass | false | 83 | 14526→14852 (+326) | 1 | 0/0 | 1/1 | ✅ kb-aware |

## Per-client detail

### calgary-property-leasing
- business: Calgary Edmonton Property Leasing
- niche: `property_management` | hand_tuned: `false` | kb_backend: `pgvector` | chunks: 16
- prompt size: **20216 → 21840** (+1624 chars)
- new kb-aware fragments added (5):
  - `queryKnowledge first`
  - `For general building policies`
  - `GENERAL questions about how the building works`
  - `QUESTION INTAKE — caller's first move is a GENERAL POLICY question`
  - `ANSWER-FIRST RULE: When queryKnowledge returns content`
- old blanket-route fragments stripped from current → preview (0/0):
- safety-guard pattern count: 2 (current) → 2 (preview), drift: +0

### hasan-sharif
- business: Hasan Sharif
- niche: `real_estate` | hand_tuned: `true` | kb_backend: `pgvector` | chunks: 29
- prompt size: **8342 → 24455** (+16113 chars)
- new kb-aware fragments added (2):
  - `queryKnowledge first`
  - `COMMISSION + FEES: For general published commission`
- old blanket-route fragments stripped from current → preview (0/0):
- safety-guard pattern count: 1 (current) → 2 (preview), drift: +1

### urban-vibe
- business: Urban Vibe Properties
- niche: `property-management` | hand_tuned: `true` | kb_backend: `pgvector` | chunks: 34
- prompt size: **18878 → 21712** (+2834 chars)
- new kb-aware fragments added (5):
  - `queryKnowledge first`
  - `For general building policies`
  - `GENERAL questions about how the building works`
  - `QUESTION INTAKE — caller's first move is a GENERAL POLICY question`
  - `ANSWER-FIRST RULE: When queryKnowledge returns content`
- old blanket-route fragments stripped from current → preview (1/1):
  - ✅ `NEVER answer questions about availability, pricing, pets, parking, or utilities ...`
- safety-guard pattern count: 2 (current) → 2 (preview), drift: +0

### velly-remodeling
- business: Velly Remodeling Ltd.
- niche: `other` | hand_tuned: `true` | kb_backend: `pgvector` | chunks: 0
- prompt size: **7775 → 14231** (+6456 chars)
- new kb-aware fragments added (0):
- old blanket-route fragments stripped from current → preview (0/0):
- safety-guard pattern count: 0 (current) → 1 (preview), drift: +1

### windshield-hub
- business: Windshield Hub Auto Glass
- niche: `auto-glass` | hand_tuned: `false` | kb_backend: `pgvector` | chunks: 83
- prompt size: **14526 → 14852** (+326 chars)
- new kb-aware fragments added (1):
  - `queryKnowledge first`
- old blanket-route fragments stripped from current → preview (0/0):
- safety-guard pattern count: 1 (current) → 1 (preview), drift: +0

## Recommended next steps

1. Review per-client JSON at `dryrun-{slug}-kb-aware.json` — diff `currentPrompt` vs `previewPrompt`.
2. Pick low-risk clients to live-recompose first. Skip any showing `safety guards lost` or `STILL PRESENT` blanket rules.
3. For each chosen client: copy/adapt `scripts/recompose-brian.ts` with the slug, run `--live`.
4. Real test call → check `tool_invocations` table for `queryKnowledge` fires.
5. **Snowflake clients with hand_tuned=true:** force-recompose wipes any hand-tuning. Confirm with owner before deploying.
