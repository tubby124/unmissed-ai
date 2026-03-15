# Session Handoff — 2026-03-13

## Completed This Session
- Reviewed PROMPT_DEPLOY_REWRITE_PLAN.md (8 items) — found 9 additional issues (17 total)
- **Wave 1 DONE**: Removed hardcoded secrets
  - `scripts/deploy_prompt.py` — replaced hardcoded Supabase service key (line 25) and Ultravox key (line 26) with `_require_env()` calls
  - `~/.claude/skills/prompt-deploy/SKILL.md` — replaced 3x hardcoded Ultravox key with `$ULTRAVOX_API_KEY`, added Prerequisites section
- **Wave 2 PARTIAL**: Client registry
  - Created `clients/exp-realty/` with config.json + SYSTEM_PROMPT.txt (pulled from Supabase)
  - Fixed deploy_prompt.py: added exp-realty + true-color-display-printing-ltd to CLIENT_CONFIG
  - Fixed Urban Vibe voice: Ashley (df0b14d7) → Jacqueline (aa601962) in deploy_prompt.py
  - Added `local_dir` override support for true-color path mismatch
- **NOT YET DONE**: SKILL.md registry table update, SKILL.md PATCH template fix (voice/greeting), prompt_versions INSERT fix, active_prompt_version_id, UX improvements, Manzil cleanup, Supabase cleanup

## Decisions Made
- Omar's slug stays `exp-realty` (already in Supabase) — not `omar-sharif`
- Voice config source of truth: `clients/{slug}/config.json` per client
- True Color path mismatch: `local_dir` override (slug=`true-color-display-printing-ltd`, dir=`clients/true-color/`)
- All 17 items in one plan (not split across sessions)

## Current State
- No uncommitted changes (files modified but not staged)
- Branch: main
- Supabase Urban Vibe `agent_voice_id` still shows Ashley (df0b14d7) — needs UPDATE to Jacqueline (aa601962)
- Supabase junk row `sadfsd` still exists — needs DELETE
- Supabase `hasan-sharif` niche still NULL — needs UPDATE to `real_estate`

## Pending / Next Steps
- [ ] Wave 2: Update SKILL.md client registry table (add Omar, True Color, fix aliases, add Voice ID + Local Dir columns)
- [ ] Wave 3: Fix SKILL.md Ultravox PATCH template — add `voice` (from config.json) + `firstSpeakerSettings` (greeting + uninterruptible)
- [ ] Wave 3: Fix SKILL.md prompt_versions INSERT — add `version` + `content` columns, add deactivate-previous, add `active_prompt_version_id` UPDATE
- [ ] Wave 3: Supabase UPDATE — `agent_voice_id` for urban-vibe to Jacqueline
- [ ] Wave 4: SKILL.md UX — default to local file flow, simplify Manzil, promptfoo gap warning, dynamic_context guard, change description prompt
- [ ] Wave 5: Cleanup — manzil config.json _status, DELETE sadfsd row, SET hasan-sharif niche
- [ ] Verification — grep for remaining hardcoded keys
- [ ] Update PROMPT_DEPLOY_REWRITE_PLAN.md with items #9-#17

## Files Changed
- `scripts/deploy_prompt.py` — env vars, Urban Vibe voice fix, added 2 clients, local_dir support
- `~/.claude/skills/prompt-deploy/SKILL.md` — removed 3x hardcoded key, added Prerequisites
- `clients/exp-realty/SYSTEM_PROMPT.txt` — NEW (pulled from Supabase)
- `clients/exp-realty/config.json` — NEW

## How to Continue
Load this handoff + the plan at `~/.claude/plans/smooth-wishing-pumpkin.md`. Resume from Wave 2 (SKILL.md registry table update). The remaining work is all SKILL.md edits (Waves 2-4) + 3 Supabase SQL statements (Wave 5) + verification grep.
