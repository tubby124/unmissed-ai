---
type: architecture
tags: [architecture, call-paths, ultravox, twilio]
source: docs/architecture/call-path-capability-matrix.md
updated: 2026-03-31
---

# Call Path Capability Matrix

> Full matrix: `docs/architecture/call-path-capability-matrix.md`

## Call Paths
| Path | Medium | Tools | Context Injected | Logged |
|------|--------|-------|-----------------|--------|
| A — Live Inbound PSTN | Twilio | Full (clients.tools) | Full buildAgentContext() | call_logs |
| B — Browser Demo WebRTC | WebRTC | buildDemoTools() | Name/phone inline | demo_calls |
| C — Trial Success | WebRTC | None | Raw prompt (no injection) | No |
| D — Dashboard Test Outbound | Twilio | clients.tools (FIXED) | Full buildAgentContext() | No |
| E — Admin Raw Test | WebRTC | None | None | No |

## Active Drift Risks
- DR-3: Demo injects SMS tool but demo clients may lack twilio_number
- DR-5: Demo useLivePrompt uses fake phone +15555550100
- DR-6: Plan gating not re-evaluated at call time for Path D

## Medium Constraints
- WebRTC: no DTMF, no live transfer (no Twilio SID), no voicemail fallback
- PSTN: full capabilities — transfer, DTMF, voicemail, SMS during call

## Connections
- → [[Architecture/Per-Call Context]] (what gets injected)
- → [[Features/Transfer]] (PSTN only)
- → [[Features/IVR]] (PSTN only — DTMF required)
