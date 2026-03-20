# Tool Pack Matrix — unmissed.ai

Which tools are available per niche. Updated whenever a niche is added or a tool is enabled.

## Matrix

| Niche | hangUp | queryKnowledge | sendSMS | calendar (slots+book) | coldTransfer | leaveVoicemail | Notes |
|-------|--------|---------------|---------|----------------------|--------------|----------------|-------|
| `auto_glass` | Y | Y | Y | N | N | N | SMS = Telegram relay to Sabbir |
| `real_estate` | Y | Y | Y | Y | Y | N | Full tool suite |
| `property_mgmt` | Y | Y | Y | N | Y | N | Transfer for emergencies |
| `voicemail` | Y | N | N | N | N | N | Minimal — greeting + hang up |
| `demo` | Y | Y | Y (browser) | Y (browser) | Y (browser) | N | DemoCapabilities gate |
| `dental` | Y | Y | Y | Y | N | N | Calendar for appointments |
| `hvac` | Y | Y | Y | Y | N | N | Calendar for service calls |
| `plumbing` | Y | Y | Y | Y | N | N | Calendar for service calls |
| `legal` | Y | Y | Y | Y | N | N | Calendar for consultations |

## Tool Definitions

| Tool | modelToolName | Source | Auth |
|------|--------------|--------|------|
| hangUp | `hangUp` | Ultravox built-in | None |
| queryKnowledge | `queryKnowledge` | `api/knowledge/[slug]/query` | X-Tool-Secret |
| sendSMS | `sendTextMessage` | `api/webhook/[slug]/sms` | X-Tool-Secret |
| checkCalendarAvailability | `checkCalendarAvailability` | `api/calendar/[slug]/slots` | None (slug-scoped) |
| bookAppointment | `bookAppointment` | `api/calendar/[slug]/book` | None (slug-scoped) |
| coldTransfer | `transferCall` | `api/webhook/[slug]/transfer` | X-Tool-Secret |
| leaveVoicemail | `leaveVoicemail` | Ultravox built-in | None |
| queryCorpus | `queryCorpus` | Ultravox built-in (legacy) | None |

## Tool Registration

Tools are registered dynamically in `src/lib/ultravox.ts`:
- `buildCalendarTools(slug)` — injected when `booking_enabled=true`
- `buildTransferTools(slug)` — injected when `forwarding_number` is set
- `buildSmsTools(slug)` — injected when `sms_enabled=true`
- `buildKnowledgeTools(slug)` — injected when `knowledge_backend='pgvector'`
- `buildCorpusTools(corpus_id)` — injected when corpus available (legacy)

## Adding a New Tool

1. Update this matrix FIRST
2. Add builder function to `ultravox.ts`
3. Add tool injection logic to `updateAgent()` in `ultravox.ts`
4. Add promptfoo test for tool behavior
5. Test with one client before rolling out

## Security Notes

- `X-Tool-Secret` uses `WEBHOOK_SIGNING_SECRET` env var
- Calendar tools are slug-scoped (no secret needed — slug in URL path)
- SMS and transfer tools MUST have X-Tool-Secret (they send messages / redirect calls)
- Known gap: hasan-sharif and exp-realty SMS/transfer tools lack X-Tool-Secret (to be fixed)
