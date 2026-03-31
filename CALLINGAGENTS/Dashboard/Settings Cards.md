---
type: dashboard
tags: [dashboard, settings, frontend]
related: [Architecture/Control Plane Mutation, Dashboard/Dashboard Architecture]
source: memory/settings-card-architecture.md, docs/settings-extraction-tracker.md
updated: 2026-03-31
---

# Settings Cards (19 cards, 6 sections)

> Full component map: `docs/settings-extraction-tracker.md`
> All saves go through: `PATCH /api/dashboard/settings` via `usePatchSettings` hook

## Section Layout (AgentTab.tsx)
| Section | Title | Cards Inside | Default |
|---------|-------|--------------|---------|
| – | Setup | SetupCard | expanded (trial only) |
| `talk` | Talk to Your Agent | TestCallCard, LearningLoopCard | open |
| `identity` | Identity & Voice | AgentOverviewCard, VoiceStyleCard, VoicemailGreetingCard, SectionEditorCard | open |
| `knowledge` | What It Knows | AdvancedContextCard, KnowledgeEngineCard, SectionEditorCard | closed |
| `capabilities` | What It Can Do | CapabilitiesCard, HoursCard, BookingCard | closed |
| `script` | Agent Script | PromptEditorCard, ImprovePromptCard, PromptVersionsCard (admin) | closed |
| `config` | Configuration | AgentConfigCard, WebhooksCard, GodModeCard, RuntimeCard (admin) | closed |

## What Each Card Saves → Ultravox Sync?
| Card | DB Field(s) | Syncs to Ultravox? |
|------|------------|---------------------|
| VoiceStyleCard | agent_voice_id, voice_style_preset | YES — updateAgent() |
| BookingCard | booking_enabled | YES — patchCalendarBlock + tools |
| HoursCard | business_hours_weekday/weekend, after_hours_behavior | NO — per-call injection |
| AdvancedContextCard | context_data, injected_note | NO — per-call injection |
| KnowledgeEngineCard | knowledge_backend | YES — updateAgent() |
| AgentConfigCard | agent_name, sms_enabled, forwarding_number | YES — updateAgent() |
| PromptEditorCard | system_prompt (section or full) | YES — updateAgent() |
| GodModeCard | twilio_number (admin only) | NO — known gap |

## Open Issues
- D213 — Per-section prompt editor UI (backend done, UI missing)
- GodModeCard: twilio_number NOT in needsAgentSync (see [[Architecture/Control Plane Mutation]])

## Shared Save Pattern
```
Card component
  → usePatchSettings({ field: value })
  → PATCH /api/dashboard/settings
  → DB write
  → needsAgentSync check
  → updateAgent() if needed
  → { ok, ultravox_synced } response
  → Card shows success/error state
```

## Connections
- → [[Architecture/Control Plane Mutation]] (what gets synced vs not)
- → [[Features/Booking]] (BookingCard)
- → [[Features/IVR]] (IvrMenuCard in capabilities section)
- → [[Tracker/D213]] (per-section editor UI missing)
