# unmissed.ai — Claude Code Skills & Commands Spec

## For: Claude Code Implementation
## Purpose: Scaffold niche templates, test prompts locally, audit quality — without deploying

---

## Architecture Overview

```
.claude/
├── commands/
│   ├── niche-new.md          # /niche-new <niche_name> — scaffold a new niche
│   ├── niche-test.md         # /niche-test <niche_name> — generate + test a prompt
│   ├── niche-sim.md          # /niche-sim <niche_name> — simulate a call conversation
│   ├── prompt-audit.md       # /prompt-audit <client_slug> — audit a live prompt
│   ├── prompt-compare.md     # /prompt-compare <client_slug> — diff current vs previous version
│   └── call-report.md        # /call-report <client_slug> — pull call analysis summary
├── agents/
│   └── caller-sim.md         # Sub-agent: plays the role of a caller for testing
├── skills/
│   └── niche-scaffolder/
│       ├── SKILL.md           # Main skill definition
│       ├── templates/
│       │   ├── skeleton.md    # Universal skeleton (Tier 1) — all niches get this
│       │   ├── real_estate.md # Niche block reference (Tier 2)
│       │   ├── auto_glass.md
│       │   ├── property_mgmt.md
│       │   └── _new_niche.md  # Blank niche template to fill in
│       ├── test-intakes/
│       │   ├── real_estate.json
│       │   ├── auto_glass.json
│       │   ├── property_mgmt.json
│       │   └── _template.json # Blank intake for new niches
│       └── sim-scenarios/
│           ├── common.json    # Universal test scenarios (spam, wrong number, silence, etc.)
│           ├── real_estate.json
│           ├── auto_glass.json
│           └── property_mgmt.json
```

---

## SKILL: niche-scaffolder

### File: .claude/skills/niche-scaffolder/SKILL.md

```markdown
---
name: niche-scaffolder
description: Scaffold new voice agent niche templates for unmissed.ai. Use when creating a new business niche, testing prompt generation, or simulating calls. Triggers on any mention of "new niche", "scaffold", "niche template", "test prompt", or "simulate call".
---

# Niche Scaffolder Skill

## What This Does
Helps create, test, and validate voice agent prompt templates for new business niches
on the unmissed.ai platform. All prompts target Ultravox (Llama 3.3 70B).

## Key Files
- Universal skeleton: .claude/skills/niche-scaffolder/templates/skeleton.md
- Existing niche references: .claude/skills/niche-scaffolder/templates/*.md
- Test intakes: .claude/skills/niche-scaffolder/test-intakes/*.json
- Sim scenarios: .claude/skills/niche-scaffolder/sim-scenarios/*.json
- Prompt builder: agent-app/src/lib/prompt-builder.ts
- Niche types: agent-app/src/types/onboarding.ts

## Workflow: Creating a New Niche

### Phase 1 — Research & Design
1. Ask the user what business type this niche serves
2. Ask for 1-2 example businesses (real ones the user knows)
3. Search the web for common call patterns in this industry
4. Read the universal skeleton template and 2-3 existing niche templates for reference
5. Use sequential thinking to plan the niche-specific blocks:
   - What is the primary call reason? (booking, quote, message, triage)
   - What info must be collected? (vehicle info, unit number, property address, etc.)
   - What are the 5-10 most common caller questions?
   - What are the edge cases unique to this industry?
   - Are there urgency/emergency patterns? (like property mgmt water leaks)
   - What should the agent NEVER do? (quote prices, give legal advice, etc.)

### Phase 2 — Scaffold
1. Create a new niche template file: templates/<niche_name>.md
2. Create a test intake JSON: test-intakes/<niche_name>.json
3. Create sim scenarios: sim-scenarios/<niche_name>.json
4. Draft the niche-specific sections:
   - FORBIDDEN ACTIONS (niche-specific rules)
   - IDENTITY enhancement (persona + physical context)
   - GOAL (primary/secondary)
   - THE FILTER (niche-specific rapid dispatch cases)
   - TRIAGE (if applicable — e.g., emergency vs routine for property mgmt)
   - INFO COLLECTION (what fields to gather, in what order)
   - INLINE EXAMPLES (4-6 realistic call scenarios)
   - PRODUCT KNOWLEDGE BASE (8-12 common Q&A pairs)
5. Merge with universal skeleton to produce a complete prompt template
6. Write the builder function or NICHE_DEFAULTS entry

### Phase 3 — Test
1. Generate a prompt using the test intake
2. Run validatePrompt() — must pass with zero errors
3. Check: opening line under 15 words?
4. Check: all dialogue lines under 2 sentences?
5. Check: pronouns used correctly (test he/she/they)?
6. Check: no raw phone numbers in dialogue?
7. Check: all required sections present?
8. Run 5 simulated call scenarios (see /niche-sim command)

### Phase 4 — Onboarding Wizard
1. Identify what niche-specific fields need to be collected in the wizard
2. Create the nicheAnswers keys (niche_<field_name> convention)
3. Draft the wizard step component or update NICHE_CONFIG
4. Ensure toIntakePayload() will prefix keys correctly

## Quality Standards (from production analysis)
- Opening line: under 15 words (< 4 seconds spoken)
- Dialogue lines: max 2 sentences per agent turn
- Owner name in dialogue: use pronouns after first mention
- Phone numbers: "this number" not raw digits
- Required sections: FORBIDDEN ACTIONS, FILTER, EDGE CASES, COMPLETION CHECK, RETURNING CALLER
- Total prompt: 5000-7000 chars (passes validatePrompt minimum, not too bloated)
- Every dialogue line must sound natural when read aloud — use contractions always
- Inline examples: minimum 4, covering happy path + escalation + edge case + spam
```

---

## TEMPLATES

### File: .claude/skills/niche-scaffolder/templates/skeleton.md

This is the universal Tier 1 skeleton that every niche gets:

```markdown
# UNIVERSAL SKELETON — included in every niche prompt

## Section 1: VOICE HEADER
[THIS IS A LIVE VOICE PHONE CALL — NOT TEXT. You MUST speak in short, natural sentences. Never produce any text formatting. Always respond in English.]

## Section 2: FORBIDDEN ACTIONS
{{NICHE_FORBIDDEN_ACTIONS}}
Plus universal rules:
- NEVER use bullet points, numbered lists, markdown, emojis, or text formatting
- NEVER stack two questions in one turn
- NEVER say "let me check" and pause silently
- NEVER close the call until COMPLETION CHECK passes
- NEVER say anything after your final goodbye — use hangUp immediately

## Section 3: VOICE NATURALNESS
Start every response with a quick backchannel: "mmhmm...", "gotcha...", "right...", "yeah..."
Use "uh" or "um" once or twice per call when transitioning — never more.
If the caller interrupts: "sorry — yeah, go ahead."
Split long responses into micro-turns.
Never use hollow affirmations like "great question!"
If you mishear: "sorry about that — can you say that one more time?"

## Section 4: IDENTITY
{{NICHE_IDENTITY}}

## Section 5: TONE AND STYLE
{{NICHE_TONE}}

## Section 6: GOAL
{{NICHE_GOAL}}

## Section 7: THE FILTER
Universal cases (always included):
- WRONG NUMBER → polite redirect → hangUp
- SPAM / ROBOCALL → "Thanks, we're all set." → hangUp
- AI DISCLOSURE → "I'm [agent], [owner]'s assistant!"
- CALLER ENDS CALL → "Great, take care!" → hangUp immediately
{{NICHE_FILTER_EXTRAS}}

## Section 8: MAIN FLOW
{{NICHE_MAIN_FLOW}}

## Section 9: COMPLETION CHECK
[COMPLETION CHECK — before closing, verify: have you collected {{COMPLETION_FIELDS}}? If anything is missing, ask before closing.]

## Section 10: COMMON QUESTIONS / PRODUCT KNOWLEDGE BASE
{{NICHE_FAQ}}

## Section 11: RETURNING CALLER HANDLING
If the system prompt starts with [RETURNING CALLER: ...], greet them by name.
Reference previous interaction naturally. Don't repeat full history.

## Section 12: INLINE EXAMPLES
{{NICHE_EXAMPLES}}

## Section 13: EDGE CASES
Universal (always included):
- SILENCE → "No worries — take your time, or you can text [owner] at this number anytime."
- ANGRY / RUDE → stay calm, take message, close after 2 abusive exchanges
- LANGUAGE BARRIER → "I can only help in English... I'll let [owner] know you called." Note language.
- PRICING / SPECIFICS → deflect to owner callback
{{NICHE_EDGE_CASES}}

## Section 14: TECHNICAL RULES
- Use hangUp tool IMMEDIATELY after closing line
- NEVER provide legal, financial, or medical advice
- Your ONLY job is {{PRIMARY_JOB}}
```

### File: .claude/skills/niche-scaffolder/templates/_new_niche.md

```markdown
# Niche: {{NICHE_NAME}}
# Industry: {{INDUSTRY}}
# Created: {{DATE}}

## NICHE_FORBIDDEN_ACTIONS
<!-- 3-5 niche-specific rules. Examples: -->
<!-- NEVER quote specific prices/rates -->
<!-- NEVER promise appointment availability -->
<!-- NEVER give [industry-specific] advice -->

## NICHE_IDENTITY
<!-- Agent persona with physical context -->
<!-- "You are [agent], [owner]'s [role] at [business]. You answer [pronoun] calls from the [office/shop/front desk] — warm, real, and ready to help." -->

## NICHE_TONE
<!-- Industry-appropriate tone guidance -->
<!-- Casual shop? Professional office? Warm and empathetic? -->

## NICHE_GOAL
<!-- Primary: what info must be collected? -->
<!-- Secondary: what basic questions can the agent answer? -->
<!-- Urgency: when should calls be flagged? -->

## NICHE_FILTER_EXTRAS
<!-- Industry-specific rapid dispatch cases -->
<!-- Examples: job inquiries, delivery/package, insurance questions -->

## NICHE_MAIN_FLOW
<!-- The core call flow: greeting → triage → info collection → closing -->
<!-- What steps does the agent walk through? -->
<!-- What data fields are collected and in what order? -->

## COMPLETION_FIELDS
<!-- What must be collected before closing? -->
<!-- Examples: "caller name and reason" / "name, vehicle info, and callback number" -->

## NICHE_FAQ
<!-- 8-12 most common caller questions with scripted responses -->
<!-- Format: "Question?" → "Response using pronouns and owner name appropriately" -->

## NICHE_EXAMPLES
<!-- 4-6 realistic inline examples showing full call flows -->
<!-- Must include: happy path, escalation request, edge case, spam/robocall -->

## NICHE_EDGE_CASES
<!-- Industry-specific edge cases beyond the universal ones -->
<!-- Examples: emergency triage (property mgmt), sensor check (auto glass) -->

## WIZARD_FIELDS
<!-- What niche-specific data needs to be collected in onboarding? -->
<!-- Field name | Type | Description -->
<!-- niche_serviceAreas | string[] | Cities/regions covered -->

## PRIMARY_JOB
<!-- One sentence: "take messages and answer basic questions about [owner]'s [service type]" -->
```

---

## TEST INTAKES

### File: .claude/skills/niche-scaffolder/test-intakes/_template.json

```json
{
  "_description": "Test intake for {{NICHE_NAME}} niche. Fill in all fields, then use /niche-test to generate and validate a prompt.",
  "owner_name": "",
  "business_name": "",
  "agent_name": "",
  "niche": "",
  "niche_pronouns": "he",
  "callback_phone": "",
  "niche_serviceAreas": [],
  "niche_callMode": "message_and_questions",
  "niche_messageRecipient": "owner",
  "niche_customRecipient": "",
  "niche_customNotes": "",
  "_niche_specific_fields": {
    "_comment": "Add niche-specific intake fields here"
  }
}
```

### File: .claude/skills/niche-scaffolder/test-intakes/real_estate.json

```json
{
  "owner_name": "Test Realtor",
  "business_name": "eXp Realty",
  "agent_name": "Aisha",
  "niche": "real_estate",
  "niche_pronouns": "she",
  "callback_phone": "4035551234",
  "niche_serviceAreas": ["Calgary, AB", "Saskatoon, SK"],
  "niche_specialties": ["Residential", "Commercial", "Investment Properties"],
  "niche_callMode": "message_and_questions",
  "niche_messageRecipient": "owner",
  "niche_customRecipient": "",
  "niche_customNotes": ""
}
```

### File: .claude/skills/niche-scaffolder/test-intakes/auto_glass.json

```json
{
  "owner_name": "Sabbir Rahman",
  "business_name": "Windshield Hub Auto Glass",
  "agent_name": "Mark",
  "niche": "auto_glass",
  "niche_pronouns": "he",
  "callback_phone": "3065551234",
  "niche_serviceAreas": ["Saskatoon, SK"],
  "niche_callMode": "message_and_questions",
  "niche_messageRecipient": "owner",
  "niche_customRecipient": "",
  "niche_customNotes": ""
}
```

### File: .claude/skills/niche-scaffolder/test-intakes/property_mgmt.json

```json
{
  "owner_name": "Ray Kassam",
  "business_name": "Urban Vibe Properties",
  "agent_name": "Alisha",
  "niche": "property_management",
  "niche_pronouns": "he",
  "callback_phone": "4036057142",
  "niche_serviceAreas": ["Calgary, AB"],
  "niche_callMode": "message_and_questions",
  "niche_messageRecipient": "owner",
  "niche_customRecipient": "",
  "niche_customNotes": "",
  "niche_managers": ["Ray Kassam", "Ayana Kassam", "Sayfaan Kassam", "Nisha Kassam"],
  "niche_emergencyRules": "No heat October-March is always URGENT in Calgary"
}
```

---

## SIM SCENARIOS

### File: .claude/skills/niche-scaffolder/sim-scenarios/common.json

```json
{
  "_description": "Universal test scenarios that apply to every niche. Run all of these plus niche-specific ones.",
  "scenarios": [
    {
      "id": "spam_robocall",
      "name": "Spam Robocall",
      "caller_opens_with": "[pre-recorded voice] Congratulations! You've been selected for a special offer...",
      "expected_behavior": "Agent says thanks/not interested and immediately hangs up",
      "expected_classification": "JUNK",
      "max_agent_turns": 1
    },
    {
      "id": "wrong_number",
      "name": "Wrong Number",
      "caller_opens_with": "Hi, is this Tony's Pizza?",
      "expected_behavior": "Agent politely redirects and hangs up",
      "expected_classification": "JUNK",
      "max_agent_turns": 2
    },
    {
      "id": "silence",
      "name": "Silent Caller",
      "caller_opens_with": "[silence for 10 seconds]",
      "expected_behavior": "Agent prompts gently, offers text option",
      "expected_classification": "COLD",
      "max_agent_turns": 2
    },
    {
      "id": "ai_disclosure",
      "name": "AI Disclosure Request",
      "caller_opens_with": "Wait, am I talking to a robot?",
      "expected_behavior": "Agent identifies as assistant, redirects to helping",
      "expected_classification": "N/A",
      "max_agent_turns": 2
    },
    {
      "id": "angry_caller",
      "name": "Angry Caller",
      "caller_opens_with": "This is bullshit, I've been trying to reach someone for three days!",
      "expected_behavior": "Agent stays calm, acknowledges frustration, takes message",
      "expected_classification": "WARM",
      "max_agent_turns": 4
    },
    {
      "id": "language_barrier",
      "name": "Non-English Speaker",
      "caller_opens_with": "[speaking in another language]",
      "expected_behavior": "Agent apologizes, notes language preference, promises callback",
      "expected_classification": "COLD",
      "max_agent_turns": 2
    },
    {
      "id": "quick_goodbye",
      "name": "Caller Says Bye Immediately",
      "caller_opens_with": "Oh never mind, I'll call back later. Bye!",
      "expected_behavior": "Agent says take care and hangs up immediately",
      "expected_classification": "COLD",
      "max_agent_turns": 1
    }
  ]
}
```

### File: .claude/skills/niche-scaffolder/sim-scenarios/real_estate.json

```json
{
  "_description": "Real estate niche test scenarios",
  "scenarios": [
    {
      "id": "re_showing_request",
      "name": "Showing Request",
      "caller_opens_with": "Hi, I saw a listing on Realtor.ca at 123 Maple Drive and I'd love to book a showing",
      "expected_behavior": "Agent collects property address, preferred date/time, number of people, caller name",
      "expected_classification": "WARM",
      "max_agent_turns": 6
    },
    {
      "id": "re_home_value",
      "name": "Home Valuation Request",
      "caller_opens_with": "I'm thinking about selling my house. What do you think it's worth?",
      "expected_behavior": "Agent NEVER gives a number. Routes to owner for assessment. Collects name + address.",
      "expected_classification": "HOT",
      "max_agent_turns": 4
    },
    {
      "id": "re_commission",
      "name": "Commission Question",
      "caller_opens_with": "What's your commission rate?",
      "expected_behavior": "Agent deflects to owner. Does NOT quote any percentage.",
      "expected_classification": "WARM",
      "max_agent_turns": 3
    },
    {
      "id": "re_urgent_offer",
      "name": "Urgent Offer Deadline",
      "caller_opens_with": "I need to talk to the agent RIGHT NOW, I have an offer deadline at 5pm today",
      "expected_behavior": "Agent marks urgent, collects name fast, suggests texting for fastest response",
      "expected_classification": "HOT",
      "max_agent_turns": 3
    },
    {
      "id": "re_is_agent_active",
      "name": "Is Agent Still Active",
      "caller_opens_with": "Hey, is this person still doing real estate? I haven't heard from them in a while",
      "expected_behavior": "Agent confirms owner is active, offers to take message",
      "expected_classification": "WARM",
      "max_agent_turns": 3
    },
    {
      "id": "re_recruiting",
      "name": "Agent Recruiting Call",
      "caller_opens_with": "Hi, I'm with Royal LePage and I'd love to chat about an opportunity for your agent",
      "expected_behavior": "Agent politely declines or takes message. Does not engage with pitch.",
      "expected_classification": "JUNK",
      "max_agent_turns": 2
    }
  ]
}
```

---

## COMMANDS

### File: .claude/commands/niche-new.md

```markdown
You are scaffolding a new voice agent niche for unmissed.ai.

Read the niche-scaffolder skill at .claude/skills/niche-scaffolder/SKILL.md first.

The niche to create is: $ARGUMENTS

Follow Phase 1 (Research & Design) and Phase 2 (Scaffold) from the skill.
Use sequential thinking MCP to plan the niche-specific blocks before writing anything.

Reference these existing niche templates for structure and tone:
- .claude/skills/niche-scaffolder/templates/real_estate.md
- .claude/skills/niche-scaffolder/templates/auto_glass.md
- .claude/skills/niche-scaffolder/templates/property_mgmt.md
- .claude/skills/niche-scaffolder/templates/skeleton.md

Create these files:
1. templates/<niche_name>.md — the niche-specific blocks
2. test-intakes/<niche_name>.json — test intake data
3. sim-scenarios/<niche_name>.json — 5-8 niche-specific test scenarios

Do NOT modify prompt-builder.ts yet. Just create the design files.
Ask me questions about the business type before designing if you need clarity.
```

### File: .claude/commands/niche-test.md

```markdown
Test prompt generation for a niche.

1. Read the test intake from .claude/skills/niche-scaffolder/test-intakes/$ARGUMENTS.json
2. Call the appropriate build function in src/lib/prompt-builder.ts with this intake
3. Print the FULL generated prompt
4. Run validatePrompt() on the output — report all errors and warnings
5. Check these quality standards:
   - Opening line under 15 words?
   - All dialogue lines under 2 sentences?
   - Owner name appears fewer than 10 times in dialogue?
   - No raw 10-digit phone numbers in dialogue?
   - All required sections present? (FORBIDDEN ACTIONS, FILTER, COMPLETION CHECK, RETURNING CALLER, EDGE CASES)
   - Total char count between 5000-7500?
6. Test again with niche_pronouns set to "they" — does it still read naturally?
7. Report a scorecard: PASS/WARN/FAIL for each check
```

### File: .claude/commands/niche-sim.md

```markdown
Simulate call scenarios against a prompt to test how the agent would respond.

1. Read the test intake from .claude/skills/niche-scaffolder/test-intakes/$ARGUMENTS.json
2. Generate the prompt using the appropriate builder
3. Load sim scenarios from:
   - .claude/skills/niche-scaffolder/sim-scenarios/common.json (universal)
   - .claude/skills/niche-scaffolder/sim-scenarios/$ARGUMENTS.json (niche-specific)
4. For EACH scenario:
   a. Set up a simulated conversation with the generated system prompt
   b. Send the caller's opening line
   c. Generate the agent's response (following the system prompt exactly)
   d. Continue for up to max_agent_turns or until hangUp would be called
   e. Evaluate:
      - Did the agent follow the expected behavior?
      - Did the agent stay under 2 sentences per turn?
      - Did the agent use hangUp at the right time?
      - Would this be classified correctly?
   f. Score: PASS / PARTIAL / FAIL with explanation
5. Print a summary scorecard of all scenarios
6. Flag any scenarios that scored PARTIAL or FAIL — these indicate prompt gaps

NOTE: This is a LOCAL simulation only. No Ultravox, no Twilio, no real calls.
The simulation tests prompt LOGIC, not voice quality or latency.
```

### File: .claude/commands/prompt-audit.md

```markdown
Audit the live system prompt for a client.

1. Fetch the system_prompt from the clients table where slug = '$ARGUMENTS'
2. Run validatePrompt() on it
3. Check for these issues:
   - Owner name used more than 10 times in dialogue lines
   - Raw phone digits (10+ consecutive) in dialogue
   - Missing sections: FORBIDDEN ACTIONS, FILTER, COMPLETION CHECK, RETURNING CALLER, SILENCE, ANGRY/RUDE, LANGUAGE BARRIER
   - Opening line over 15 words
   - Any dialogue line over 2 sentences (roughly >30 words between quotes)
   - "certainly" / "absolutely" / "of course" in dialogue (should use contractions)
   - Hardcoded phone numbers that should be "this number"
4. Compare against the universal skeleton structure — what sections are missing?
5. Report findings with severity: ERROR (must fix) / WARNING (should fix) / INFO (nice to have)
```

### File: .claude/commands/prompt-compare.md

```markdown
Compare a client's current prompt against their previous version.

1. Fetch the current system_prompt from clients where slug = '$ARGUMENTS'
2. Fetch the two most recent prompt_versions for this client (is_active=true and the one before it)
3. Show a clear diff: what was added, removed, or changed
4. For each change, assess: was this an improvement based on the optimizer's change types?
   - new_faq: does it address a real caller pattern?
   - edge_case: does it handle a previously unhandled scenario?
   - tone_tweak: does the new wording sound more natural?
   - flow_fix: does the new order match how callers actually provide info?
5. Flag any changes that look like regressions (removed sections, broken pronoun usage, etc.)
```

### File: .claude/commands/call-report.md

```markdown
Pull a call analysis summary for a client.

1. Fetch the most recent call_analysis_report for client with slug '$ARGUMENTS'
2. Also fetch the last 20 call_logs for this client (excluding internal calls)
3. Summarize:
   - Total calls, breakdown by status (HOT/WARM/COLD/JUNK/UNKNOWN)
   - Average quality score
   - Top 5 caller topics by frequency
   - Number of friction calls (quality < 6)
   - Any patterns: repeat callers, time-of-day clustering, missing transcripts
4. List the report's issues and recommendations
5. Suggest whether the prompt should be optimized or is performing well
```

---

## CALLER SIMULATION AGENT

### File: .claude/agents/caller-sim.md

```markdown
---
name: caller-sim
description: Simulates realistic callers for testing voice agent prompts. Use with /niche-sim.
model: sonnet
color: green
---

You are a caller simulation agent. Given a scenario description, you play the role of a realistic phone caller interacting with a voice AI agent.

Rules:
- Stay in character as the caller described in the scenario
- Respond naturally — short sentences, realistic speech patterns
- If the scenario says you're angry, BE angry (but still a real person, not cartoonish)
- If the scenario says you're confused, ask for clarification, repeat yourself
- If the scenario says you speak another language, respond in that language
- If you're a spam robocall, deliver a pre-recorded sales pitch and don't respond to the agent
- If the agent asks you something, give a realistic answer (make up names, addresses, etc.)
- If the agent handles you well, cooperate. If they fumble, push back naturally.
- End the call when a real caller would end it (after getting what they need or giving up)

You output ONLY the caller's spoken words. No stage directions, no inner thoughts.
After each of your responses, indicate if you would hang up: [CONTINUES] or [WOULD_HANGUP]
```

---

## HOW TO USE THIS SYSTEM

### Scaffolding a brand new niche (e.g., dental):
```
/niche-new dental
```
Claude Code will research dental office call patterns, ask you questions about the business, then create the template, test intake, and sim scenarios. Review and refine.

### Testing a prompt without deploying:
```
/niche-test real_estate
```
Generates a prompt from test data, validates it, checks quality standards, tests pronoun variants. All local.

### Simulating calls against a prompt:
```
/niche-sim real_estate
```
Runs every scenario (universal + niche-specific) against the generated prompt. Scores each one. Shows you exactly where the prompt would fail before you ever deploy it.

### Auditing a live client:
```
/prompt-audit windshield-hub
```
Pulls the live prompt from Supabase and checks it against all quality standards.

### Checking if optimization helped:
```
/prompt-compare urban-vibe
```
Diffs the current prompt against the previous version and assesses each change.

### Getting a client health check:
```
/call-report windshield-hub
```
Pulls call data and analysis reports, gives you the status at a glance.

---

## ADDING THE BUILDER FUNCTION (after scaffolding is approved)

Once you've reviewed the scaffold output and sim results, tell Claude Code:

```
The dental niche scaffold is approved. Now implement it:
1. Add 'dental' to the Niche type in src/types/onboarding.ts
2. Either create buildDentalPrompt() in prompt-builder.ts OR add dental to NICHE_DEFAULTS
3. Add NICHE_CONFIG for dental in the onboarding config
4. Create the wizard step component at src/app/onboard/steps/niches/dental.tsx
5. Update toIntakePayload() if needed for new niche-specific fields
6. Run /niche-test dental to verify
7. Run /niche-sim dental to validate all scenarios pass
8. Commit to branch feat/niche-dental and push
```

This keeps the design phase (scaffold + test + sim) completely separate from the implementation phase (code changes). You never write code until you're confident the prompt design works.
