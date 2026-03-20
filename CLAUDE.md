@~/.claude/rules/unmissed-domain.md
@.claude/rules/learning-loop.md

# CALLING AGENTs — Project Instructions for Claude

> Loaded at session start. These rules OVERRIDE default behavior. Follow exactly.

---

## SESSION START

1. Read the user's task
2. Scan the **Skill Advisory** below — name matching skills
3. Check `MEMORY.md` for prior patterns
4. Proceed

If ambiguous: ask one clarifying question. Never assume scope on client-affecting work.

---

## BEFORE BUILDING (mandatory gates)

### Editing ANY client system prompt → read this FIRST:
- **`memory/glm46-prompting-rules.md` — MANDATORY before every prompt edit.** Ultravox v0.7 = GLM-4.6. Known bugs: repetition loop, double-speak, thinking leakage. Rules 12–14 must be present in every prompt. Prompt length hard max: 8K chars.

### Touching any of these → read the architecture doc first:
- `lib/ultravox.ts` → read `memory/system-architecture.md` §2 (agent anatomy) + §5 (tools)
- `api/webhook/[slug]/inbound` or `completed` → read `memory/system-architecture.md` §7 + §8
- `lib/prompt-builder.ts` → read `memory/system-architecture.md` §3 (prompt assembly)
- Any corpus/RAG route → read `memory/system-architecture.md` §6
- Any new Ultravox feature → read `memory/advanced-features-plan.md` + `BUILD_PACKAGES/INBOUND_VOICE_AGENT/ULTRAVOX_ADVANCED_PATTERNS.md`

### Advanced features status (check before starting any Ultravox work):
| Pattern | Status | Next step |
|---------|--------|-----------|
| A — Tool Response Instructions | **DONE** (Mar 20) | `_instruction` in book/slots/knowledge routes + prompt line on all 5 clients |
| B — Deferred Messages | **NOT DONE** | Add priming line to all prompts first, then whisper route |
| C — Tool State | **NOT DONE** | Only if booking retry tracking becomes a production problem |
| D — Call Stages | **NOT DONE** | Only if monoprompt fails for a complex client |

Full plan: `memory/advanced-features-plan.md` | Full code: `BUILD_PACKAGES/INBOUND_VOICE_AGENT/ULTRAVOX_ADVANCED_PATTERNS.md`

---

## AUTOMATIC REMINDERS

### After editing any `*_SYSTEM_PROMPT*` or `*_PROMPT*.txt`:
```
Prompt updated. Next step: /prompt-deploy [client] to push to Supabase + sync Ultravox agent.
```

### After any test call fires:
```
Test call fired. When it completes: /review-call [ultravox-call-id]
Find the call ID in Ultravox dashboard or call_logs table.
```

### After Lyra optimization completes:
```
Prompt optimized. Steps:
1. Copy optimized prompt into the relevant *_SYSTEM_PROMPT.txt file
2. Run /prompt-deploy [client] to push live
```

### After scaffolding a new niche (`/niche-new`):
```
Niche scaffolded. Validation steps:
1. /niche-test [niche]    -> build full prompt + quality scorecard
2. /niche-sim [niche]     -> simulate all scenarios, confirm PASS
3. When ready: add niche to prompt-builder.ts NICHE_DEFAULTS
```

### When user asks about niche commands:
Point them to `/niche-help`

### After creating or significantly updating a research/memory doc:
```
New doc created/updated. If this is important system knowledge:
1. Add to scripts/nlm-registry.txt (one line: PATH | DESCRIPTION)
2. Run: bash scripts/nlm-sync.sh
3. Upload new/changed files to NotebookLM
```

---

## Project Context

**What:** unmissed.ai — AI voice agent platform (inbound + outbound ISA).
**Architecture:** Railway-native. All voice agents run through Railway webhooks. See `AGENT_APP_ARCHITECTURE.md`.
**Prompts:** Supabase `clients.system_prompt` — NOT Google Sheets.

**Active clients:**

| Client | Slug | Status |
|--------|------|--------|
| Hasan Sharif (Aisha) | `hasan-sharif` | Railway native |
| Windshield Hub (Mark) | `windshield-hub` | Railway native |
| Urban Vibe (Alisha) | `urban-vibe` | Railway native |
| Manzil ISA (Fatima) | `manzil-isa` | TEST MODE (n8n legacy — only remaining n8n client) |

**Canonical templates:** `BUILD_PACKAGES/`

---

## Skill Advisory

| Task | Skill | Trigger |
|------|-------|---------|
| Onboard new client | `/onboard-client [slug]` | "new client", "set up", "provision" |
| Debug failed call | `/debug-call [slug] [call-id]` | "call failed", "wrong response" |
| System-wide failure | `/system-audit` | Unknown failure, no clear system |
| Push prompt live | `/prompt-deploy [client]` | After editing any prompt file |
| Review test call | `/review-call [call-id]` | After test call completes |
| Monthly sweep | `/intelligence-update` | 1st of month |
| Optimize prompt | `/optimizeprompt` or `/op` | "improve", "optimize" |
| Scaffold niche | `/niche-new [name]` | "new niche", "add niche" |
| Test niche prompt | `/niche-test [niche]` | "test prompt", "validate" |
| Simulate calls | `/niche-sim [niche]` | "simulate", "test scenarios" |
| Audit live prompt | `/prompt-audit [client]` | "audit prompt", "quality check" |
| Test draft/test prompt | `/test-prompt [client]` | "test prompt", "test SYSTEM_PROMPT_TEST", "draft prompt" |
| Compare prompts | `/prompt-compare [client]` | "prompt diff", "what changed" |
| Call analytics | `/call-report [client]` | "call stats", "analytics" |
| Send client email | `/notify-client [slug] [template]` | "email client", "notify" |
| Run prompt tests | `bash tests/promptfoo/run-all.sh` | "run tests", "safety check" |
| Sync NLM files | `bash scripts/nlm-sync.sh` | "sync notebooklm", "update nlm", "nlm sync" |

### Self-Healing Diagnostic Agents

| Agent | When | What |
|-------|------|------|
| `ultravox-manager` | Agent misbehaving, wrong VAD | Fetches config, pushes fixes |
| `supabase-manager` | Missing data, RLS issues | Queries DB, diagnoses inconsistencies |
| `twilio-manager` | Calls not arriving, webhook failures | Audits routing, statusCallback |

Full parallel audit = `/system-audit` (spawns all three + synthesizes RCA).

---

## File Map

| Asset | Path |
|-------|------|
| Prompt template (inbound) | `BUILD_PACKAGES/INBOUND_VOICE_AGENT/PROMPT_TEMPLATE_INBOUND.md` |
| Intake form | `BUILD_PACKAGES/INBOUND_VOICE_AGENT/INTAKE_FORM_INBOUND.md` |
| Prompt generator (TS — Railway runtime) | `agent-app/src/lib/prompt-builder.ts` |
| Prompt generator (Py — CLI) | `PROVISIONING/app/prompt_builder.py` |
| Client configs | `clients/{slug}/config.json` + `domain-knowledge.md` |
| Onboarding lessons | `ONBOARDING_LESSONS.md` |

---

## Monthly Reminder (1st of the Month)

```
Monthly intelligence sweep due: /intelligence-update
Checks: Ultravox API changes, ISA benchmarks, CRTC/DNCL compliance
```

---

## Learning Loop

Document new patterns to `MEMORY.md` immediately — not at session end.
See `.claude/rules/learning-loop.md` for full protocol.

---

## What NOT to Do

- Never paste a prompt and say "paste this into [system]" — use `/prompt-deploy`
- Never manually write test call analysis — use `/review-call`
- Never let a session end after a prompt edit without reminding about `/prompt-deploy`
- Never let a session end after a test call without reminding about `/review-call`
- Never start onboarding without checking `/onboard-client`
- Never debug a call without checking `/debug-call` or `/system-audit`
- Never let a new pattern go undocumented — write it to MEMORY.md
