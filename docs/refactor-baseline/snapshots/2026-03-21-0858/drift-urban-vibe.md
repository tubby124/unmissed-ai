# Drift Report — urban-vibe

I now have all the information needed. Let me also verify the exact `tools` parameter passed in `sync-agent` — it passes `tools: [{ toolName: 'hangUp' }]` as `baseTools`, which means `hangUp` goes in as a built-in tool reference (not a temporaryTool). But in `updateAgent`, the code checks `updates.tools !== undefined ? updates.tools : [HANGUP_TOOL]` — so it uses the passed `{ toolName: 'hangUp' }` as baseTools. This is a critical nuance.

Let me check what `{ toolName: 'hangUp' }` resolves to in the Ultravox context vs the temporaryTool hangUp seen in the live snapshot.

I now have everything I need. Let me also quickly verify the live `firstSpeakerSettings` difference — the code in `updateAgent` sets `{ agent: { uninterruptible: true, delay: '1s' } }` (no text), while the live agent has `{ agent: { uninterruptible: true, text: "Thanks for calling..." } }`.

Also note the critical VAD difference: code has `minimumInterruptionDuration: '0.2s'` but live has `minimumInterruptionDuration: '0.400s'`.

Also: `sync-agent/route.ts` passes `tools: [{ toolName: 'hangUp' }]` as baseTools (a built-in tool reference), while `settings/route.ts` does NOT pass `tools` at all, so `updateAgent` falls back to `[HANGUP_TOOL]` (the built-in reference). But the live agent has hangUp as a temporaryTool. This means the live agent was last deployed via a different path (likely `deploy_prompt.py`).

Let me check the `deploy_prompt.py` to understand how it builds hangUp.

No `greeting` or `vad_min_interruption` in urban-vibe's config.json. That means `deploy_prompt.py` would use `firstSpeakerSettings: { agent: { uninterruptible: True, delay: "1s" } }` with no text, and `minimumInterruptionDuration: "0.200s"`.

But the live agent has:
- `firstSpeakerSettings: { agent: { uninterruptible: true, text: "Thanks for calling Urban Vibe Properties — I'm Alisha, Ray's virtual assistant. How can I help?" } }`
- `minimumInterruptionDuration: "0.400s"`

This tells me the agent was deployed with a different config version that had a greeting text and different VAD settings. Now I have everything. Let me also check whether `deploy_prompt.py` adds `contextSchema` with `additionalProperties: false` or not — the live version has it but the code in deploy_prompt.py doesn't set `additionalProperties`.

Looking at the live contextSchema:
```json
{
  "additionalProperties": false,
  "type": "object",
  "properties": { ... },
  "required": []
}
```

The `deploy_prompt.py` code only sets `type` + `properties` — no `additionalProperties: false` and no `required: []`. The `updateAgent()` in ultravox.ts also doesn't set `additionalProperties`. So those extra fields in the live contextSchema came from a different deployment path.

Now I have enough to produce the complete report. Let me also check the `hangUp` tool format discrepancy more carefully. The live agent has hangUp as a `temporaryTool` with `nameOverride: "hangUp"`, `precomputable: true`, `defaultReaction: "AGENT_REACTION_LISTENS"`. Both `deploy_prompt.py` and `updateAgent()` send `{ toolName: "hangUp", parameterOverrides: { strict: true } }` — a built-in tool reference. This is a significant structural difference: live uses temporaryTool, expected uses built-in reference. However the last deploy was `2026-03-20` with description "tool resync: hangUp as temporaryTool with AGENT_REACTION_LISTENS" — so this was deliberately deployed via a PATCH that used the temporaryTool form. The current code does NOT produce this — it uses `{ toolName: "hangUp" }` built-in form. This is a divergence between live and what the current code would generate.

I now have everything needed. Let me produce the report and also save relevant findings to memory.