# Prompt Deploy Skill Rewrite — Execution Plan

> **Purpose:** Fix the broken/stale parts of `/prompt-deploy`, add missing clients, remove hardcoded secrets, fix the DB insert, and make the flow smoother.
> **File to edit:** `~/.claude/skills/prompt-deploy/SKILL.md`
> **Do in a fresh chat.** Load this file + the current SKILL.md.

---

## Current Problems (ranked by severity)

### CRITICAL
1. **prompt_versions INSERT is broken** — omits `version` (integer, NOT NULL) and `content` (text, NOT NULL). The INSERT will throw a DB error. Every existing row in the table was bulk-inserted manually, never by this skill.
2. **Ultravox API key hardcoded** on lines 79, 124, 144 — should be `$ULTRAVOX_API_KEY` env var. Skill file lives in `~/.claude/` which could be synced or backed up.

### HIGH
3. **Client registry incomplete** — missing Omar (`exp-realty`), True Color slug mismatch (`true-color-display-printing-ltd` in Supabase vs `clients/true-color/` locally), missing test clients.
4. **No promptfoo tests for 4 of 7 clients** — Omar, True Color, manzil-isa, and any new wizard-generated client deploy without safety checks.

### MEDIUM
5. **Step 2 asks the user every time** which source to use — 95% of deploys are local file → Supabase → Ultravox. Should default to that.
6. **Manzil special case section is stale** — still frames it as different from other clients. It's Railway native now.
7. **No awareness of upcoming dynamic_context feature** — needs a note so future deploys don't accidentally overwrite it.

### LOW
8. **Stale aliases** — "jade" for urban-vibe is old. Urban Vibe voice is Alisha not Jade/Ayana.

---

## Fix Plan (8 steps, do in order)

### Step 1 — Remove hardcoded API key

Find all 3 occurrences of the literal Ultravox key and replace with env var reference:

```
BEFORE: -H "X-API-Key: 4FowyUSm.ZEkda8oOwMgWl8HUGMBnSegpOGjU3acw"
AFTER:  -H "X-API-Key: $ULTRAVOX_API_KEY"
```

Add a prerequisites section at the top:
```
## Prerequisites
These env vars must be set (already exported in ~/.zshrc on this machine):
- ULTRAVOX_API_KEY
- OPENROUTER_API_KEY (for promptfoo tests)
```

### Step 2 — Fix the prompt_versions INSERT

Replace the broken INSERT with one that actually works:

```sql
INSERT INTO prompt_versions (client_id, version, content, change_description, is_active, version_hash, supabase_synced, ultravox_synced, deployed_at)
SELECT
  id,
  COALESCE((SELECT MAX(version) FROM prompt_versions WHERE client_id = clients.id), 0) + 1,
  '[FULL_PROMPT_TEXT]',
  '[CHANGE_DESCRIPTION — ask user or default to "Deployed via /prompt-deploy"]',
  true,
  '[PROMPT_HASH]',
  true,
  [UV_SYNCED],
  NOW()
FROM clients WHERE slug = '[SLUG]';

-- Also deactivate previous active version:
UPDATE prompt_versions SET is_active = false
WHERE client_id = (SELECT id FROM clients WHERE slug = '[SLUG]')
  AND is_active = true
  AND version < (SELECT MAX(version) FROM prompt_versions WHERE client_id = (SELECT id FROM clients WHERE slug = '[SLUG]'));
```

Note: `content` stores the full prompt text. This makes prompt_versions a complete audit trail — you can rollback by reading any version's content.

### Step 3 — Update client registry

Replace the current registry table with:

```markdown
| Client | Slug | Local Prompt File | Ultravox Agent ID | Promptfoo Test |
|--------|------|-------------------|-------------------|----------------|
| Aisha (Hasan voicemail) | `hasan-sharif` | `clients/hasan-sharif/SYSTEM_PROMPT.txt` | `f19b4ad7-233e-4125-a547-94e007238cf8` | hasan-sharif.yaml |
| Mark (Windshield Hub) | `windshield-hub` | `clients/windshield-hub/SYSTEM_PROMPT.txt` | `00652ba8-5580-4632-97be-0fd2090bbb71` | windshield-hub.yaml |
| Alisha (Urban Vibe) | `urban-vibe` | `clients/urban-vibe/SYSTEM_PROMPT.txt` | `5f88f03b-5aaf-40fc-a608-2f7ed765d6a6` | urban-vibe.yaml |
| Fatima (Omar voicemail) | `exp-realty` | `clients/exp-realty/SYSTEM_PROMPT.txt` | `c9019927-49a7-4676-b97b-5c6395e58a37` | NONE — create |
| Sam (True Color) | `true-color-display-printing-ltd` | `clients/true-color/SYSTEM_PROMPT.txt` | `ce4bbe2b-6f7d-4f32-b3ce-e9b044aeef3e` | NONE — create |
| Fatima (Manzil ISA) | `manzil-isa` | `clients/manzil-isa/SYSTEM_PROMPT.txt` | *(check Supabase)* | NONE |

Aliases: `hasan` → hasan-sharif | `wh` → windshield-hub | `uv` → urban-vibe | `omar` → exp-realty | `tc` → true-color-display-printing-ltd | `manzil` → manzil-isa
```

Also: create `clients/exp-realty/` directory with config.json and pull Omar's prompt from Supabase into `SYSTEM_PROMPT.txt` (this is a prerequisite — do before rewriting the skill).

### Step 4 — Default to "local file → full deploy" flow

Replace the current Step 2 (which asks every time) with:

```markdown
### Step 2 — Read Prompt Source

Default flow (no user input needed):
1. Read `clients/[SLUG]/SYSTEM_PROMPT.txt`
2. If file exists: use it as source → deploy to Supabase → Ultravox
3. If file doesn't exist: pull from Supabase, show char count, ask user to confirm

Override: If user says "just push Supabase to Ultravox" or "sync only", skip the file read and Supabase UPDATE — go straight to Ultravox PATCH.
```

### Step 5 — Simplify Manzil section

Replace the entire "Fatima / Manzil Special Case" section with:

```markdown
## Notes
- **Manzil ISA** is in test mode. Same deploy flow as all other clients.
  Check if `ultravox_agent_id` is set before attempting PATCH.
- **Test clients** (e2e-test-plumbing-co, e2e-test-business): skip promptfoo
  and changelog steps. Deploy flow is the same.
```

### Step 6 — Add promptfoo gap warning

In Step 0, after the test run instructions, add:

```markdown
**If no promptfoo config exists for this client:**
- Warn: "No promptfoo test suite for [SLUG]. Deploy will proceed without safety tests."
- Suggest: "Run /niche-analyst to generate a test suite for this client."
- Do NOT block deployment — just warn.

**Clients without tests (as of Mar 2026):** exp-realty, true-color-display-printing-ltd, manzil-isa
```

### Step 7 — Add dynamic_context guard

Add to ABSOLUTE RULES section:

```markdown
8. NEVER overwrite `dynamic_context` or `dynamic_context_updated_at` columns.
   /prompt-deploy only touches `system_prompt`. Dynamic context is a separate
   feature managed via the dashboard Settings API.
```

This is forward-looking — the columns don't exist yet but will after the niche analyst plan ships.

### Step 8 — Add change description prompt

Currently the changelog step (Step 6) says `[ask user or "No description provided"]`. Make this explicit:

```markdown
### Step 5b — Get Change Description
Ask: "What changed in this prompt? (one line, or press enter to skip)"
Use the answer for:
- prompt_versions.change_description
- Changelog entry
- Default: "Deployed via /prompt-deploy [date]"
```

---

## Verification After Rewrite

After editing SKILL.md, verify by dry-running mentally:

1. `/prompt-deploy hasan-sharif` — should read local file, update Supabase, PATCH Ultravox (with env var key), insert prompt_versions row (with version + content), sync local file, log to changelog
2. `/prompt-deploy omar` — should resolve alias to `exp-realty`, warn about missing promptfoo test, otherwise same flow
3. `/prompt-deploy tc` — should resolve to `true-color-display-printing-ltd`, use `clients/true-color/SYSTEM_PROMPT.txt` (note the path mismatch between slug and folder)

---

## Files to Load in Fresh Chat

```
# Current skill (to edit)
~/.claude/skills/prompt-deploy/SKILL.md

# This plan
PROMPT_DEPLOY_REWRITE_PLAN.md

# For creating Omar's local files
# (pull from Supabase: SELECT system_prompt FROM clients WHERE slug = 'exp-realty')

# Reference for prompt_versions schema
# (already documented in this plan — or query Supabase information_schema)
```

---

## What This Does NOT Cover (separate work)

- Creating promptfoo test configs for Omar/True Color/Manzil → do during niche analyst work
- Building the dynamic_context feature → Phase 3 of NICHE_ANALYST_PLAN.md
- Prompt A/B testing → Phase 4 of NICHE_ANALYST_PLAN.md
- Rewriting the prompt-builder.ts to generate better prompts → Phase 6 of NICHE_ANALYST_PLAN.md
