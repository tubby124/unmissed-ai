# Settings Context Propagation — Truth Audit

> Generated 2026-03-19. Traces every user-editable field from Settings UI → Supabase → call-time injection.

---

## Field Lifecycle Table

| Field | UI Location | DB Column | Saved By | Injection Point | Live at Call Time? | Requires Ultravox Sync? |
|-------|------------|-----------|----------|-----------------|-------------------|------------------------|
| `extra_qa` | Agent tab → Q&A section | `clients.extra_qa` | `PATCH /api/dashboard/settings` (line 69) | `buildAgentContext()` → `assembled.extraQaBlock` → `knowledge.block` (Phase 3 condensed) → inbound webhook `templateContext.businessFacts` | **YES** — read from DB on every inbound call | NO — injected via `templateContext` at call time |
| `context_data` | Agent tab → Reference Data | `clients.context_data` | `PATCH /api/dashboard/settings` (line 72) | `buildAgentContext()` → `assembled.contextDataBlock` → inbound webhook `templateContext.contextData` | **YES** — read from DB on every inbound call | NO — injected via `templateContext` at call time |
| `context_data_label` | Agent tab → Reference Data label | `clients.context_data_label` | `PATCH /api/dashboard/settings` (line 75) | `buildAgentContext()` → `business.contextDataLabel` → `buildContextBlock()` header | **YES** — read from DB on every inbound call | NO — label is part of the context block string |
| `business_facts` | Agent tab → Business Facts | `clients.business_facts` | `PATCH /api/dashboard/settings` (line 66) | `buildAgentContext()` → `assembled.businessFactsBlock` → `knowledge.block` (Phase 3 condensed) → inbound webhook `templateContext.businessFacts` | **YES** — read from DB on every inbound call | NO — injected via `templateContext` at call time |
| `system_prompt` | Agent tab → Prompt Editor | `clients.system_prompt` | `PATCH /api/dashboard/settings` (line 55) | Stored in Ultravox agent's `callTemplate.systemPrompt` (with `{{placeholders}}`) | **NO** — requires Ultravox agent PATCH | **YES** — `needsAgentSync` triggers PATCH |
| `injected_note` | Agent Overview → Quick Inject | `clients.injected_note` | `PATCH /api/dashboard/settings` (line 108) | Settings route rebuilds `system_prompt` by appending/replacing `## RIGHT NOW` section, then triggers Ultravox PATCH | **NO** — baked into `system_prompt`, requires Ultravox sync | **YES** — triggers prompt rebuild + PATCH |
| `voice_style_preset` | Agent tab → Voice Style | `clients.voice_style_preset` | `PATCH /api/dashboard/settings` (line 93) | Only used at prompt generation time (`buildPromptFromIntake()`) — NOT injected at call time | **NO** — only affects prompt generation | NO (but changing style requires prompt regen + sync) |
| `agent_voice_id` | Voice tab → Voice picker | `clients.agent_voice_id` | `PATCH /api/dashboard/settings` | Stored in Ultravox agent's `callTemplate.voice` | **NO** — requires Ultravox agent PATCH | **YES** — `needsAgentSync` triggers PATCH |
| `booking_enabled` | Agent tab → Calendar section toggle | `clients.booking_enabled` | `PATCH /api/dashboard/settings` | Controls whether calendar tools are registered on the Ultravox agent | **NO** — requires Ultravox agent PATCH to add/remove tools | **YES** — `needsAgentSync` triggers PATCH |
| `forwarding_number` | Setup section / Agent tab | `clients.forwarding_number` | `PATCH /api/dashboard/settings` | Controls whether transferCall tool is registered on the Ultravox agent | **NO** — requires Ultravox agent PATCH | **YES** — `needsAgentSync` triggers PATCH |
| `transfer_conditions` | Setup section | `clients.transfer_conditions` | `PATCH /api/dashboard/settings` | Baked into transferCall tool description on Ultravox agent | **NO** — requires Ultravox agent PATCH | **YES** — `needsAgentSync` triggers PATCH |

---

## How It Works: Two Injection Mechanisms

### 1. Template Variables (Live at Call Time)

The Ultravox agent's `callTemplate.systemPrompt` contains `{{placeholders}}`:

```
[base prompt text]

{{callerContext}}

{{businessFacts}}

{{extraQa}}

## INJECTED REFERENCE DATA
...
{{contextData}}
```

At call time, the inbound webhook reads fresh values from Supabase and passes them via `templateContext`:

```typescript
// inbound/route.ts → callViaAgent()
templateContext: {
  callerContext:  callerContextRaw,    // date, time, phone, returning caller
  businessFacts:  knowledgeBlockStr,   // business_facts + extra_qa (condensed)
  contextData:    contextDataStr,      // context_data with label header
}
```

**Fields using this mechanism are live immediately after saving** — no Ultravox sync needed.

### 2. Agent PATCH (Requires Sync)

These fields are stored in the Ultravox agent's persistent `callTemplate` and only change when `updateAgent()` PATCHes the agent:

- `system_prompt` → `callTemplate.systemPrompt`
- `agent_voice_id` → `callTemplate.voice`
- `forwarding_number` → presence/absence of `transferCall` tool in `callTemplate.selectedTools`
- `transfer_conditions` → `transferCall` tool description text
- `booking_enabled` → presence/absence of calendar tools in `callTemplate.selectedTools`
- `injected_note` → rebuilt into `system_prompt` text → requires PATCH

The settings API automatically triggers `updateAgent()` when any of these fields change (see `needsAgentSync` check at settings/route.ts line 271).

---

## Key Findings

### No Discrepancies Found

The UI behavior matches the code for all fields:

1. **`extra_qa`, `context_data`, `business_facts`** — Save button updates Supabase immediately. Next call reads fresh data. No Ultravox sync needed. UI does not imply otherwise. **Correct.**

2. **`system_prompt`** — Save button updates Supabase AND triggers Ultravox PATCH. A "Syncing to agent..." indicator appears in the UI. **Correct.**

3. **`injected_note`** — Quick Inject saves to Supabase, rebuilds the system_prompt by regex-replacing the `## RIGHT NOW` section, then PATCHes Ultravox. This is correctly gated behind `needsAgentSync`. **Correct.**

4. **`voice_style_preset`** — Save only updates the DB column. It does NOT regenerate the prompt or sync to Ultravox. This is by design — the preset only affects future prompt generation (via `buildPromptFromIntake()`). Existing live prompts are unchanged until explicit regen. **Correct but could be confusing** — the user might expect switching a preset to immediately change the agent's tone. Consider adding a note in the UI: "Changes apply when prompt is next regenerated."

### Minor UX Gap

**`voice_style_preset` save doesn't trigger regen.** When a client switches from "Casual & Friendly" to "Direct & Efficient" in settings, nothing happens to their live agent until the prompt is regenerated. Options:
- (a) Add a "Regenerate prompt with new style" button next to the preset selector
- (b) Auto-regen on preset change (higher risk, could overwrite hand-tuned prompts)
- (c) Just add a help note explaining this (lowest effort, lowest risk)

**Recommendation:** Option (c) for now — add a `text-[11px] t3` note: "Style changes take effect when your prompt is next regenerated." This matches the existing behavior for all template-level settings.

---

## Fallback Path

When the Agents API (`callViaAgent()`) fails, the inbound webhook falls back to `createCall()` with the full prompt string assembled inline:

```typescript
let promptFull = client.system_prompt + `\n\n${callerContextBlock}`
if (knowledgeBlockStr) promptFull += `\n\n${knowledgeBlockStr}`
if (contextDataStr)    promptFull += `\n\n${contextDataStr}`
```

This fallback also reads fresh data from Supabase, so the live-at-call-time guarantee holds for both code paths.

---

## Files Traced

| File | Role |
|------|------|
| `src/app/api/dashboard/settings/route.ts` | Settings save API — accepts all fields, triggers Ultravox sync |
| `src/app/api/dashboard/settings/sync-agent/route.ts` | Manual force-sync — pushes prompt + voice + tools to Ultravox |
| `src/app/api/webhook/[slug]/inbound/route.ts` | Call-time — reads fresh DB data, builds context, creates call |
| `src/lib/agent-context.ts` | Pure function — assembles context blocks from client row |
| `src/lib/ultravox.ts` | Ultravox API — `createAgent()`, `updateAgent()`, `callViaAgent()` |
| `src/lib/prompt-builder.ts` | Prompt generation — `buildPromptFromIntake()` (only at provision/regen time) |
| `src/components/dashboard/settings/AgentTab.tsx` | UI — Agent tab with all editable fields |
| `src/components/dashboard/settings/QuickInject.tsx` | UI — injected_note quick-inject widget |
