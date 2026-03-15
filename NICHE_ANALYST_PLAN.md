# Niche Analyst Deep Dive — Execution Plan

> **Purpose:** Study all live prompts, score them, identify reusable patterns, fix gaps, build the "dynamic context" feature, and create a niche analyst agent that prevents re-analyzing unchanged prompts.
> **Start in a fresh chat.** Load this file first.

---

## Current State (as of Mar 13, 2026)

### Live Clients in Supabase (status = active)

| Slug | Business | Niche | Prompt Chars | Twilio | Notes |
|------|----------|-------|-------------|--------|-------|
| hasan-sharif | Hasan Sharif | (null — voicemail) | 5,412 (Supabase) / 6,866 (file) | +15877421507 | Aisha voicemail. File diverges from Supabase — needs sync check. |
| windshield-hub | Windshield Hub Auto Glass | auto-glass | 10,095 (SB) / 10,788 (file) | +15873551834 | Mark. Production veteran. Client happy. Low call volume currently. |
| urban-vibe | Urban Vibe Properties | property-management | 15,434 (SB) / 15,649 (file) | +15873296845 | Alisha. Client loves it. Most complex prompt. Voice ID = Ashley (df0b14d7) — noted as warm/slow in voice-notes.md. |
| exp-realty | Omar Sharif | real_estate | 5,418 (SB) | +16393850876 | "Fatima" voicemail clone. Self-serve wizard, then manually copied from Hasan's. No local SYSTEM_PROMPT.txt file. |
| true-color-display-printing-ltd | True Color | voicemail | 15,591 (SB) / 16,239 (file) | +15753325085 | Sam. Print shop. Has product knowledge base. |
| e2e-test-plumbing-co | E2E Test | plumbing | 12,240 (SB) | (none) | Test only — skip in analysis. |
| e2e-test-business | E2E Test Business | voicemail | 5,960 (SB) | +16393077540 | Test only — skip. |

### Key Observations Before We Start
1. **Omar (exp-realty) has no local prompt file** — prompt lives only in Supabase. Need to pull it down.
2. **Hasan and Windshield Hub prompt sizes differ between Supabase and file** — Supabase may be out of sync with local files.
3. **5 real clients, 3 archetypes:** voicemail (hasan, omar), service booking (windshield-hub, true-color), property management (urban-vibe).
4. **AI disclosure is inconsistent** across prompts (see Phase 1).

---

## Phase 1: Prompt Audit & Scoring (Read-Only Analysis)

**Goal:** Deep-read every live prompt, score on a rubric, identify gaps.

### Step 1.1 — Pull all prompts to local files

```bash
# Pull Omar's prompt from Supabase (no local file exists)
# Use mcp__supabase__execute_sql:
SELECT system_prompt FROM clients WHERE slug = 'exp-realty'
# Write to clients/exp-realty/SYSTEM_PROMPT.txt + create config.json

# For each client, compare Supabase prompt vs local file:
SELECT slug, length(system_prompt) as sb_chars FROM clients WHERE status = 'active'
# Compare with: wc -c clients/*/SYSTEM_PROMPT.txt
# If they diverge: Supabase is authoritative (that's what Ultravox uses)
```

### Step 1.2 — Score each prompt on the Niche Analyst Rubric

Score 1-10 on each dimension. Flag anything under 7.

| Dimension | What to Check | Weight |
|-----------|---------------|--------|
| **Voice Naturalness** | VOICE NATURALNESS section in first 50 lines? "..." breath marks? Backchannels? Interrupt recovery? Filler word permission? First-turn brevity? (Cross-ref memory/voice-naturalness.md checklist) | 20% |
| **AI Disclosure** | Does the agent disclose it's AI when asked? Does it proactively disclose? (See compliance section below) | 15% |
| **Forbidden Actions** | Are FORBIDDEN ACTIONS in first 50 lines? Are they comprehensive? Do they cover: formatting, robotic words, price quoting, question stacking, dead air, premature close? | 15% |
| **Conversation Flow** | Clear state machine or flow? Greeting → Filter → Triage → Info Collection → Closing? Completion check before hangUp? | 15% |
| **Edge Case Coverage** | Wrong number, spam, silent caller, non-English, angry caller, caller ends call, escalation? | 10% |
| **Product Knowledge** | Does it have a knowledge base section? Are answers accurate? Is pricing correct? | 10% |
| **Reusability** | How much is niche-specific vs. boilerplate? Could this prompt be templatized for a similar business? | 10% |
| **Prompt Size** | Under 49,500 chars? Under 15K for fast first-response? Optimal range: 5K-12K. | 5% |

### Step 1.3 — AI Disclosure Compliance Audit

**Research finding:** CRTC does NOT currently require AI disclosure for **inbound** calls. ADAD rules (Automatic Dialing-Announcing Device) only apply to **outbound** telemarketing. There is no federal Canadian law requiring a business to disclose that their inbound receptionist is AI.

**However — best practice recommendation:**

| Level | What | When to Use |
|-------|------|-------------|
| **Transparent (recommended)** | Proactively says "AI assistant" in greeting | Best for trust. Windshield Hub does this. |
| **Honest on ask** | Discloses when asked "are you a robot?" | Minimum acceptable. Urban Vibe and Hasan do variants of this. |
| **Deceptive (AVOID)** | Denies being AI or deflects | Legal risk if FCC/CRTC rules change. Hasan's "I'm Aisha, Hasan's assistant!" is borderline. |

**Action items per client:**

| Client | Current Disclosure | Recommendation |
|--------|-------------------|----------------|
| windshield-hub | "this is mark, an AI assistant" (greeting) | GOOD — keep as-is. Template pattern. |
| urban-vibe | "yes, I am Urban Vibe Properties virtual assistant" (on ask) | OK but upgrade: add "AI" to the response. "yeah, I'm an AI assistant for Urban Vibe Properties" |
| hasan-sharif | "I'm Aisha, Hasan's assistant!" (deflects) | UPGRADE: "I'm Aisha, Hasan's AI assistant!" — one word change. |
| exp-realty (Omar) | Unknown — pull and check | Likely same as Hasan. Fix to match. |
| true-color | "nah, i'm Sam at the front desk!" (denies) | UPGRADE: "yeah, i'm an AI assistant here at True Color — how can i help ya?" (match windshield-hub pattern) |

**Template rule for all new niches:** Greeting must include "AI assistant" naturally. On-ask response must confirm AI. Never deny.

### Step 1.4 — Cross-Prompt Pattern Extraction

Read all 5 prompts and extract:
1. **Universal boilerplate** (same across all) → candidate for template
2. **Niche-specific sections** (only in one archetype) → candidate for niche config
3. **Missing patterns** (present in one prompt but should be in all)
4. **Contradictions** (different approaches to the same scenario)

Expected output: a matrix showing which sections each prompt has.

---

## Phase 2: Gap Analysis & Fix List

**Goal:** Prioritized list of prompt improvements per client.

### Step 2.1 — Generate fix list from Phase 1 scores

For each prompt dimension scoring under 7:
- Quote the weak section
- Write the exact fix
- Estimate impact (high/medium/low)

### Step 2.2 — Sync check

For each client, verify:
- Local file matches Supabase `system_prompt`
- Supabase matches what Ultravox agent actually has (fetch via Ultravox API)
- If any diverge: document which is authoritative and what needs syncing

### Step 2.3 — Omar-specific audit

Omar's prompt was "manually copied from Hasan's and edited." Check:
- Does it actually match the voicemail archetype?
- Does it reference the right business name, service areas, etc.?
- Does it have AI disclosure?
- Was the wizard-generated prompt overwritten, or does the manual copy live alongside it?

---

## Phase 3: Dynamic Context Feature (Dashboard)

**Goal:** Let any client add a temporary one-liner to their agent's context without touching the full prompt.

### Architecture

```
Supabase clients table:
  + dynamic_context TEXT DEFAULT NULL
  + dynamic_context_updated_at TIMESTAMPTZ

Prompt injection point (in inbound webhook):
  If dynamic_context is not null:
    Append to systemPrompt before {{callerContext}}:
    "\n\n[TEMPORARY CONTEXT — set by owner]\n{dynamic_context}\n"
```

**Why NOT patch the full Ultravox agent prompt:**
- Patching Ultravox replaces the entire callTemplate (Gotcha #34)
- Dynamic context changes frequently — patching on every toggle is risky
- Instead: inject at call-creation time in the Railway inbound webhook
- The webhook already reads `clients.system_prompt` — just also read `dynamic_context` and append

### Dashboard UI

**Location:** Settings page (existing) or new "Agent Status" card on dashboard home.

**UI Pattern:** Status card + text field + toggle (based on Sonar research)

```
+--------------------------------------------------+
|  Agent Status                          [Active]   |
|                                                   |
|  Temporary Note for Your Agent                    |
|  +-----------------------------------------+      |
|  | e.g. "I'm in the mountains until Friday |      |
|  |  — no signal, just take messages"       |      |
|  +-----------------------------------------+      |
|                                                   |
|  [Save & Activate]     [Clear Note]               |
|                                                   |
|  Last updated: Mar 13, 2:30 PM                    |
|  Active since: Mar 13                             |
+--------------------------------------------------+
```

**UX Details:**
- Max 500 chars (voice prompts need to be concise)
- Placeholder examples rotate: "I'm out of office until Monday" / "We're closed for the long weekend — back Tuesday" / "We're now SGI approved!" / "Holiday hours: closed Dec 25-26, open Dec 27"
- "Save & Activate" immediately writes to Supabase — takes effect on next call (no redeploy)
- "Clear Note" sets `dynamic_context = NULL` — agent reverts to normal behavior
- Show "Active" badge when a note is set, "Normal" when cleared
- Timestamp shows when it was last changed (accountability)

### Prompt Injection Format

In the system prompt, the dynamic context appears as a natural instruction:

```
[OWNER UPDATE — {{dynamic_context_updated_at}}]
{{dynamic_context}}
[END OWNER UPDATE]
```

The voice naturalness section should include a rule for handling this:
```
If an [OWNER UPDATE] section is present, naturally incorporate that information
when relevant. For example, if the owner says they're unavailable, mention it
when the caller asks to speak to them directly. Don't read the update verbatim
— paraphrase naturally.
```

### API Endpoint

```
PATCH /api/dashboard/settings
Body: { dynamic_context: "string or null" }
Auth: session token (existing)
```

This endpoint already exists for prompt updates. Add `dynamic_context` as an optional field. No Ultravox PATCH needed — the context is injected at call-creation time.

### Migration

```sql
ALTER TABLE clients ADD COLUMN dynamic_context TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN dynamic_context_updated_at TIMESTAMPTZ;
```

---

## Phase 4: Prompt Versioning & A/B Testing Framework

**Goal:** Track what changed, what worked, and avoid re-analyzing unchanged prompts.

### Step 4.1 — Prompt Hash Tracking

```sql
-- Add to clients table or prompt_versions
ALTER TABLE prompt_versions ADD COLUMN content_hash TEXT;
-- SHA-256 of prompt content — if hash unchanged, skip re-analysis
```

**Niche analyst agent rule:** Before analyzing a prompt, check:
1. `prompt_versions` — get latest version's `content_hash`
2. Compare to last analysis hash (stored in `memory/niche-analysis-log.md`)
3. If unchanged: skip and report "No changes since last analysis on [date]"
4. If changed: run full scoring, update the log

### Step 4.2 — Prompt Changelog per Client

Each client should have a `PROMPT_CHANGELOG.md` (Urban Vibe already has one). Format:

```markdown
## v[N] — [date]
**Change:** [what changed]
**Why:** [what call data or feedback drove this]
**Scores before:** [rubric scores]
**Scores after:** [rubric scores]
**Call data:** [N calls observed, quality trends]
```

### Step 4.3 — A/B Testing (Future — Phase 5+)

**How it would work (design only, don't build yet):**
1. Create two prompt versions in `prompt_versions` table
2. Inbound webhook randomly selects version A or B (50/50 split)
3. Tag each `call_logs` entry with `prompt_version_id`
4. After N calls (minimum 20 per variant): compare metrics
5. Dashboard shows: completion rate, avg quality score, avg duration, caller sentiment

**Key metrics to compare:**
| Metric | Source | Target |
|--------|--------|--------|
| Call completion rate | call_logs.call_status != MISSED | >90% |
| Info collection accuracy | call_logs.key_topics not empty | >85% |
| Avg quality score | call_logs.quality_score | >7 |
| Avg duration | call_logs.duration_seconds | 60-180s (niche-dependent) |
| First response latency | Ultravox call metadata | <400ms TTFW |
| Caller sentiment | call_logs.sentiment | positive or neutral |

---

## Phase 5: Build the Niche Analyst Agent

**Goal:** Create `~/.claude/agents/unmissed-niche-analyst.md` that can do all of the above.

### Agent Spec

```yaml
name: unmissed-niche-analyst
description: Deep-dive analyst for unmissed.ai voice agent prompts. Scores prompts on 8 dimensions, identifies reusable patterns across niches, checks AI disclosure compliance, tracks prompt changes, and skips re-analysis of unchanged prompts. Use for niche audits, prompt comparison, and resellability scoring.
tools: [Read, Grep, Glob, Bash, WebFetch]
model: opus
```

### What it does:
1. Reads all `clients/*/SYSTEM_PROMPT.txt` files
2. Pulls Supabase prompts for comparison (sync check)
3. Scores each on the 8-dimension rubric
4. Checks AI disclosure compliance
5. Extracts universal vs niche-specific patterns
6. Checks `memory/niche-analysis-log.md` — skips unchanged prompts
7. Outputs: scored report + fix list + reusability score + template extraction

### What it produces:
```
NICHE ANALYSIS — [date]
========================
Prompts analyzed: [N] (skipped [M] unchanged)

PER-CLIENT SCORES:
| Client | Natural | Disclosure | Forbidden | Flow | Edge | Knowledge | Reuse | Size | TOTAL |
|--------|---------|-----------|-----------|------|------|-----------|-------|------|-------|
| ...    | 8       | 4         | 9         | 8    | 7    | 9         | 7     | 9    | 7.6   |

TOP ISSUES (score < 7):
1. [client] — [dimension]: [specific problem + fix]

REUSABLE PATTERNS EXTRACTED:
- [pattern name]: present in [N/5] prompts — candidate for template

TEMPLATE READINESS:
| Archetype | Ready? | Gaps |
|-----------|--------|------|
| voicemail | 80% | AI disclosure, dynamic context support |
| service booking | 90% | transfer logic varies |
| property mgmt | 70% | most complex, needs modular sections |
```

---

## Phase 6: Template Standardization

**Goal:** Make each archetype a clean, resellable template.

### Step 6.1 — Extract universal sections

These should be identical across ALL prompts (just variable-substituted):
- Voice preamble (`[THIS IS A LIVE VOICE PHONE CALL...]`)
- FORBIDDEN ACTIONS (core set — niches can ADD but not remove)
- VOICE NATURALNESS section
- AI disclosure pattern (greeting + on-ask response)
- Returning caller handling
- Spam/robocall detection
- Silent caller handling
- Non-English caller handling
- Caller ends call handling
- Technical rules (hangUp tool usage)

### Step 6.2 — Extract niche-specific sections

These vary per archetype:
- **Voicemail:** Simple message-taking flow, no triage complexity
- **Service booking:** Triage → vehicle/product details → scheduling → closing
- **Property management:** Triage by caller type (tenant/prospect/billing/personal) → different info collection per type → urgency flagging (Calgary heat rule)

### Step 6.3 — Update BUILD_PACKAGES template

The `PROMPT_TEMPLATE_INBOUND.md` needs updating based on findings:
- Add AI disclosure as a required variable
- Add dynamic context instruction block
- Add the universal sections as locked boilerplate
- Mark niche-specific sections clearly

### Step 6.4 — Update prompt-builder.ts

Ensure `buildPrompt()` in `agent-app/src/lib/prompt-builder.ts`:
- Injects AI disclosure into greeting for all niches
- Injects dynamic context instruction block
- Has the NICHE_DEFAULTS for all 3 archetypes validated against the rubric

---

## Execution Order (for fresh chat)

| Step | What | Depends On | Est. Effort |
|------|------|------------|-------------|
| 1 | Pull Omar's prompt, create local files, sync check all clients | Nothing | 15 min |
| 2 | Score all 5 prompts on rubric | Step 1 | 30 min |
| 3 | AI disclosure audit + fix recommendations | Step 2 | 10 min |
| 4 | Cross-prompt pattern extraction | Step 2 | 20 min |
| 5 | Generate per-client fix list | Steps 2-4 | 15 min |
| 6 | Build `unmissed-niche-analyst.md` agent | Steps 2-5 (uses rubric + patterns) | 20 min |
| 7 | Design dynamic context migration + API changes | Nothing (independent) | 10 min |
| 8 | Build dynamic context UI component | Step 7 | 30 min |
| 9 | Update BUILD_PACKAGES template with findings | Steps 4-5 | 20 min |
| 10 | Update prompt-builder.ts NICHE_DEFAULTS | Step 9 | 20 min |
| 11 | Apply fixes to live prompts + /prompt-deploy each | Steps 5, 9 | 30 min |
| 12 | Create `memory/niche-analysis-log.md` baseline | Step 2 | 5 min |

**Parallelizable:** Steps 7-8 can run alongside Steps 2-6 (independent tracks).

---

## Files to Load in Fresh Chat

```
# This plan
NICHE_ANALYST_PLAN.md

# All live prompts
clients/hasan-sharif/SYSTEM_PROMPT.txt
clients/urban-vibe/SYSTEM_PROMPT.txt
clients/windshield-hub/SYSTEM_PROMPT.txt
clients/true-color/SYSTEM_PROMPT.txt
# (Omar's will be pulled in Step 1)

# Reference
BUILD_PACKAGES/INBOUND_VOICE_AGENT/PROMPT_TEMPLATE_INBOUND.md
memory/voice-naturalness.md (in ~/.claude/projects/.../memory/)
memory/voice-notes.md
memory/onboarding-architecture.md

# Agent templates (for building the niche analyst)
~/.claude/agents/unmissed-prompt-engineer.md
~/.claude/agents/unmissed-code-reviewer.md
```

---

## CRTC Compliance Summary

**Bottom line:** No current Canadian federal law requires AI disclosure for inbound calls. But:
- FCC (US) is moving toward mandatory disclosure for telemarketing — Canada often follows
- Best practice = disclose proactively in greeting (one word: "AI assistant")
- All unmissed.ai templates should include disclosure as default
- Clients can opt for "transparent" (in greeting) or "honest on ask" (when asked) — never "deny"

---

## Dynamic Context — Technical Summary

| Component | Change | Risk |
|-----------|--------|------|
| Supabase migration | Add `dynamic_context` + `dynamic_context_updated_at` to `clients` | Very low — additive column |
| Inbound webhook | Read `dynamic_context`, append before `{{callerContext}}` if not null | Low — one conditional append |
| Dashboard API | Add `dynamic_context` to existing PATCH /api/dashboard/settings | Low — optional field |
| Dashboard UI | New "Agent Status" card with text field + toggle | Medium — new component |
| Prompt template | Add [OWNER UPDATE] handling instruction to VOICE NATURALNESS section | Low — 3 lines added |

**No Ultravox agent PATCH needed.** Context injected at call-creation time in Railway webhook. Takes effect on next inbound call with zero downtime.
