---
type: next-chat-prompt
status: ready
date: 2026-06-07
project: unmissed-ai / endvoicemail.ai
tags: [next-chat, wave-3, layer-b, follow-up]
related:
  - "[[2026-06-06-wave-3-shipped-and-learnings]]"
  - "[[2026-06-06-universal-personal-message-architecture]]"
---

# Next chat — Wave 3 follow-up batch

Wave 3 Layer A + B (real_estate) + C are LIVE on `main` and on Aman's live agent. The system can now distinguish personal-forwarding clients from business-only clients, and family/delivery/service-provider callers get warm messages instead of accusatory hangups fleet-wide.

This batch closes the deferred items from the [[2026-06-06-wave-3-shipped-and-learnings]] memo. Five concrete pieces, ranked by ROI.

---

## Paste this into the new chat verbatim

```
Resume Wave 3 follow-up batch per Projects/unmissed/NEXT-CHAT-wave-3-followup-2026-06-07.md.

State: Wave 3 Layer A + B (real_estate only) + C are LIVE on main. Aman (walia-family) is deployed with is_forwarding_personal_cell=true, hand_tuned=false, prompt 24,949 chars, Tier-1.5 16/19 = 84.21% wrong-number PASSING. Vault memo with full pattern list at Projects/unmissed/2026-06-06-wave-3-shipped-and-learnings.md.

Five tasks for this batch (do in order, commit after each, no surprises):

1. Layer B for remaining niches — apply the same diff pattern we used on real_estate (commit 92c2aedb in CALLING AGENTs repo) to auto_glass, plumbing, hvac, dental, restaurant in src/lib/prompt-config/niche-defaults.ts. For each niche:
   a. Soften VENDOR / CONTRACTOR opener (replace any "outside what I can help with" or hostile dead-ends with "thanks for reaching out — what's your name and what are you offering?")
   b. Add UNCLEAR / DOESN'T FIT branch at the end of TRIAGE_DEEP routing back to PERSONAL / OFF-TOPIC MESSAGE FLOW (section 3 of the conversation flow)
   c. Audit the niche's NICHE_EXAMPLES block for openers that paraphrase TRIAGE_DEEP first-turn shapes — align them or remove the conflict
   d. Regenerate Layer-1 golden snapshots (npx tsx scripts/regenerate-prompt-snapshots.ts) and run npx tsx --test src/lib/__tests__/prompt-builder-golden.test.ts — must stay 111/111

2. Curly-quote transform propagation — apply the same defaultTest.options.transform we added to walia-family-wave3-baseline.yaml (replaces U+2019/U+2018 -> ' and U+201C/U+201D -> ") to every other promptfoo yaml: hasan-sharif-test.yaml, brian-baseline.yaml, urban-vibe-test.yaml, windshield-hub-baseline-extended.yaml, velly-LIVE-baseline.yaml, and any others under tests/promptfoo/*.yaml. Run each yaml afterward to confirm no test count regression. Reason: gpt-oss-120b emits curly quotes by default and our straight-quote icontains assertions silently mismatch otherwise — see landmine #6 in the learnings memo.

3. Launch-screen forwarding-instructions card — wire clients.carrier_id into a dashboard or launch-screen card that pulls the right conditional-CF codes from CARRIER_PROFILES (src/types/carrier-compat.ts). The card already exists at src/components/dashboard/setup/CarrierCompatibilityCheck.tsx — extend it (or build a thin wrapper) to read carrier_id from the client config instead of asking the user to re-pick. Then surface it on src/app/onboard/steps/step4-activate.tsx so right after activation the owner sees: "Dial *61 [number] on your Rogers line for unanswered calls, *67 for busy, *62 for unreachable."

4. Single-turn name+intent rubric mismatch — diagnose and decide. The Tier-1.5 test "Closing references caller's existing number without asking for it" gives "my name is Sarah and I'm interested in selling my house" in ONE turn and expects Riley to close. The current SELL flow asks "ready to list or market read?" before closing. Either (a) add a FAST-CONFIRM branch at the top of TRIAGE_DEEP — when caller gives name AND intent in their first sentence, jump straight to closing with a read-back; or (b) change the rubric to accept "ready to list" as a valid mid-flow response. Pick one, ship it, update the relevant tests.

5. Layer B regression coverage — for each niche cleaned up in step 1, run its existing promptfoo baseline (e.g. windshield-hub-baseline-extended.yaml for auto_glass) and confirm no regression. If any baseline didn't exist, create a minimal one following walia-family-wave3-baseline.yaml as the template (4-6 niche-specific tests + the standard fleet assertions).

Working agreement:
- Repo: /Users/owner/Downloads/CALLING AGENTs (main branch, push directly per Hasan's standing autonomy)
- Commit after each task — narrow scoped commits, never bundle steps 1-5 into one
- Pre-commit hook may fail on 22 pre-existing unrelated failures (PM niche-completeness, KB-extra_qa, char-ceilings); --no-verify is acceptable if YOUR changes don't make the count worse — diff /tmp/baseline-fails.txt to verify
- After every slot-affecting edit, also run npx tsx tests/promptfoo/scripts/check-phase-d-drift.ts — if it trips, re-export via npx tsx tests/promptfoo/scripts/export-phase-d-baseline.ts in the same commit
- DO NOT redeploy Aman or any other live client this batch — Layer B niche cleanup affects future provisions only; live clients with niche_custom_variables overrides won't be touched
- DO read Projects/unmissed/2026-06-06-wave-3-shipped-and-learnings.md before starting — the landmines section will save you a full debug loop on at least 3 of the 5 tasks

Do all 5 tasks. Report back with a per-task scoreboard + commits.
```

---

## Why this batch order

- **Step 1 first** because Layer B is the biggest behavior gain and unblocks step 5.
- **Step 2 right after** because curly-quote false-fails are why step 1's verification runs would lie to you.
- **Step 3** is independent UI work — can ship anytime, but post-Layer-B means new clients get the full Wave 3 experience end-to-end.
- **Step 4** is the genuine open question of the session — could go either way (prompt fix vs test fix). Doing it after steps 1-3 means we have more datapoints for the decision.
- **Step 5** is the safety net that proves steps 1-4 didn't break anything else.

## Done criteria

- 5 commits on `main`, one per step
- All Layer-1 golden snapshots still 111/111
- Each niche has a passing promptfoo baseline (existing or new) on its post-Layer-B prompt
- Aman is unchanged — `is_forwarding_personal_cell=true`, `hand_tuned=false`, prompt unchanged
- Phase D drift check passes
- Vault entry [[Projects/unmissed/2026-06-07-wave-3-followup-shipped]] written with per-task results
