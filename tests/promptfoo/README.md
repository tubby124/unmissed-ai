# tests/promptfoo

Prompt regression harness for unmissed.ai voice agents.

Two layers:
- **Offline (default):** OpenRouter Haiku approximations of each niche prompt —
  fast, cheap, runs in CI. See `voicemail-generic-golden.yaml`, `auto-glass-golden.yaml`.
- **Live Ultravox (on-demand):** real Ultravox calls via the custom HTTP provider
  in `providers/ultravox-provider.ts`. Catches regressions that only show up in
  production model + voice + tool runtime conditions.

## Ultravox provider

Custom HTTP provider that wraps Ultravox's REST API for live-call prompt
regressions.

- Provider source: [tests/promptfoo/providers/ultravox-provider.ts](providers/ultravox-provider.ts)
- Example eval: [tests/promptfoo/ultravox-hasan-greeting-eval.yaml](ultravox-hasan-greeting-eval.yaml)
- Run: `npm run test:prompts:ultravox`
- Required env: `ULTRAVOX_API_KEY` (export it or source `.env.local`)
- To add a new niche eval: copy `ultravox-hasan-greeting-eval.yaml`, swap the
  `prompts:` file path to that niche's SYSTEM_PROMPT.txt, and tune the asserts.
