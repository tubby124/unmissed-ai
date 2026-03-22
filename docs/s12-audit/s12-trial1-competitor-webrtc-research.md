# S12-TRIAL1: Competitor WebRTC Agent Testing Research

**Date:** 2026-03-22
**Purpose:** Competitive landscape for in-dashboard agent testing (WebRTC)
**Context:** unmissed.ai differentiator analysis for S12-TRIAL1

---

## Competitor Tiers

### Tier 1: Enterprise/Developer Platforms (NOT our competitors)

| Platform | In-Browser Test | How | Target |
|----------|:--------------:|-----|--------|
| **Vapi** | Yes | "Talk to Assistant" button in dashboard. WebRTC in-browser. | Developers |
| **Retell AI** | Yes | LLM Playground (chat) + Web Call test. Separate from main dashboard. | Developers |
| **Bland AI** | Yes | Interactive builder + test call. Managed onboarding support. | Enterprise |
| **LiveKit Agents** | Yes | Playground UI with real-time transcript, voice visualization. Open-source components. | Developers |
| **Synthflow** | Yes | "Test your agent" WebRTC widget in visual builder. | Developers/Agencies |

**Key insight:** Developer platforms ALL offer in-browser testing — it's table stakes at that tier. But their UX assumes technical users who understand API concepts.

### Tier 2: SMB AI Receptionist (OUR competitors)

| Platform | In-Browser Test | How | Monthly Price |
|----------|:--------------:|-----|:------------:|
| **My AI Front Desk** | **NO** | Phone-only testing. Must call the provisioned number. | $65-165 |
| **Dialzara** | **NO** | No self-service testing. Onboarding call with team. | $29-199 |
| **Trillet** | **NO** | No testing. "Your AI is ready" and hope for the best. | $25-99 |
| **Goodcall** | Partial | Text-based chat preview only. No voice. | $59-199 |
| **Smith.ai** | **NO** | Human + AI hybrid. No self-service. | $292+ |

**CRITICAL FINDING:** Zero SMB-tier competitors offer in-browser WebRTC voice testing. This is unmissed.ai's first-mover opportunity.

### Tier 3: Adjacent (IVR/contact center, not direct competitors)

| Platform | In-Browser Test | Notes |
|----------|:--------------:|-------|
| **Twilio** | Yes | Via console, developer-only |
| **Amazon Connect** | Yes | Contact center scale |
| **Google CCAI** | Yes | Enterprise ML pipeline |

---

## Competitive Gap Analysis

| Feature | My AI Front Desk | Dialzara | unmissed.ai (current) | unmissed.ai (post-TRIAL1) |
|---------|:---------------:|:--------:|:---------------------:|:------------------------:|
| In-browser voice test | No | No | No (demo only) | **YES** |
| Test with OWN agent | No | No | No | **YES** |
| Real-time transcript | No | No | Demo only | **YES** |
| Post-call summary | No | No | Demo only | **YES** |
| Tool demonstration | No | No | No | **YES** |
| Shareable test link | No | No | No | Planned |

## Visual Inspiration

### LiveKit Agents Playground
- Open-source React components for voice agent testing
- Real-time audio visualization (waveform bars)
- Live transcript panel with speaker labels
- Agent status indicator (connecting → listening → speaking)
- Minimal, clean UI — similar aesthetic to our DemoCall component
- **Reusable pattern:** Our `DemoCallVisuals.tsx` already has VoiceOrb, WaveformBars, TranscriptBubble — same visual language

### Vapi Dashboard
- "Talk to Assistant" button embedded directly in agent config page
- WebRTC connects in ~3 seconds
- Transcript appears in real-time alongside config panel
- **Pattern to copy:** One-click test from the dashboard, no navigation required

## Strategic Implications

1. **First-mover in SMB tier:** No SMB AI receptionist lets you talk to your agent before paying or going live. unmissed.ai would be the first.
2. **Conversion lever:** Trial users who hear their agent perform well are far more likely to upgrade. The "wow moment" is hearing their own business name and context.
3. **Competitive moat:** Once users have tested and trained their agent via WebRTC, switching costs increase — they've invested time in making it good.
4. **Marketing asset:** "Talk to your AI before you buy" is a differentiator worth featuring on the pricing page and in ads.

---

## Sources

- [Vapi Web Calls docs](https://docs.vapi.ai/quickstart/web)
- [Retell AI LLM Playground](https://docs.retellai.com/test/llm-playground)
- [LiveKit Agents Playground](https://github.com/livekit/agents-playground)
- [Synthflow documentation](https://docs.synthflow.ai/)
- [My AI Front Desk](https://www.myaifrontdesk.com/)
- [Dialzara](https://www.dialzara.com/)
- [Trillet](https://www.trillet.ai/)
- [Goodcall](https://www.goodcall.com/)
- Direct product testing of competitor dashboards (2026-03-21)
