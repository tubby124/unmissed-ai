# Phase 0 Tooling Research — 2026-03-21

## Sources
- Perplexity Sonar Pro (via OpenRouter) — Claude Code patterns, skill/agent architecture
- Repo evidence — existing agents (.claude/agents/), commands (.claude/commands/), deploy_prompt.py
- Existing baseline — docs/refactor-baseline/ (frozen 2026-03-18)

## Key Findings

### Claude Code Custom Agents (verified against repo)
- Defined in `.claude/agents/*.md` with YAML frontmatter
- Required fields: `name`, `description`, `model`, `tools` (array), `maxTurns`
- Optional: `memory: project` (loads project memory)
- Body = system prompt with step-by-step instructions + bash snippets
- Agents are invoked via the Agent tool with `subagent_type` matching the filename
- Pattern confirmed: ultravox-auditor.md, twilio-auditor.md, caller-sim.md, etc.

### Claude Code Custom Commands/Skills (verified against repo)
- Defined in `.claude/commands/*.md` — plain markdown, no frontmatter
- First arg available as `$ARGUMENTS`
- Invoked via `/command-name` (e.g., `/prompt-audit urban-vibe`)
- Body = instructions for Claude to follow when skill is invoked
- Pattern confirmed: prompt-audit.md, prompt-compare.md, call-report.md, etc.

### Existing Baseline State
- `docs/refactor-baseline/` already has partial baseline from 2026-03-18:
  - baseline-client-agent-map.md — client/agent/phone/voice inventory
  - ultravox-agent-*.json — raw Ultravox GET snapshots for 3 clients
  - baseline-architecture.md, baseline-known-risks.md, baseline-test-plan.md
  - niche-capability-map.md, niche-delta-map.md
- MISSING from baseline: Supabase table snapshots, prompt_versions state, env var mapping, test run output

### Existing Versioning Infrastructure
- `prompt_versions` table in Supabase — tracks prompt content per version per client
- `deploy_prompt.py` has `--rollback N` to restore previous version
- Prompt changelogs at `clients/{slug}/CHANGELOG.md`
- MISSING: config_version (non-prompt settings), sync timestamps, deployed_config_version

### Drift Detection Requirements (from Ultravox agent JSON analysis)
Key fields to compare between DB and Ultravox live:
- `systemPrompt` — DB: clients.system_prompt → Ultravox: callTemplate.systemPrompt
- `voice` — DB: clients.agent_voice_id → Ultravox: callTemplate.voice
- `model` — hardcoded ultravox-v0.7 → Ultravox: callTemplate.model
- `selectedTools` — generated from config → Ultravox: callTemplate.selectedTools (count + names)
- `vadSettings` — hardcoded defaults → Ultravox: callTemplate.vadSettings
- `maxDuration` — should be "600s" → Ultravox: callTemplate.maxDuration
- `inactivityMessages` — hardcoded → Ultravox: callTemplate.inactivityMessages
- `contextSchema` — hardcoded → Ultravox: callTemplate.contextSchema

### Architecture Pattern for Drift Detector
Per Sonar Pro research:
- Use a canonical field mapping layer: DB column → Ultravox API field → display name
- Normalize before compare (strip whitespace, sort tool arrays by name)
- Mark fields as: match / mismatch / orphan (exists in one source only) / missing
- Severity: CRITICAL (prompt, voice, tools) / WARNING (VAD, duration) / INFO (schema, recording)
- Output as structured markdown table for human review

### Architecture Pattern for Truth Tracer
- Not AST-based (too complex for ad-hoc investigation)
- Instead: Grep-driven path tracing with structured output
- For each concern: search for the DB field → find the server action that writes it → find what reads it → find what deploys it → find what consumes it at runtime
- Output as a chain: UI → Server Action → DB → Generator → Deploy → Runtime

## Adopted / Deferred / Rejected

| Finding | Status | Reason |
|---------|--------|--------|
| Agent .md format with YAML frontmatter | **ADOPTED** | Matches existing pattern |
| Command .md format (no frontmatter) | **ADOPTED** | Matches existing pattern |
| Event-sourced snapshot with content hash | **DEFERRED** | Overkill for current scale |
| AST-based truth tracer | **REJECTED** | Too complex; Grep-driven tracing sufficient |
| Streaming diff architecture | **REJECTED** | Only 4-5 clients; batch is fine |
| Config version DB migration | **ADOPTED for S1** | Needed but not for Phase 0 tools |
