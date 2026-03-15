# Cartesia TTS Exploration — Fresh Session Handoff

## What You're Doing

Exploring Cartesia voices via the Ultravox BYOK integration. Cartesia API key is already added to the Ultravox dashboard. Goal: find better voices for your voice agents, test them, and potentially replace the current default Ultravox voices.

## Architecture (Don't Break This)

```
Caller -> Twilio -> Railway webhook -> Ultravox (STT + LLM + Cartesia TTS + tools) -> voice back to caller
```

- Cartesia = TTS only (text-to-speech). It does NOT replace Ultravox.
- Ultravox = full stack (STT + LLM + TTS + VAD + tool calling + call orchestration)
- Cartesia is one component inside Ultravox, accessed via BYOK
- Railway webhook architecture stays untouched (callerContext injection, HMAC, call logging, SMS, Telegram)

## Current Voice Assignments

| Client | Slug | Ultravox Agent ID | Current Voice ID | Voice Name |
|--------|------|-------------------|-----------------|------------|
| Hasan Sharif (Aisha) | `hasan-sharif` | `f19b4ad7-233e-4125-a547-94e007238cf8` | `f90da51d-8133-4d19-aa0f-4ec99e14cb85` | Unknown (recently changed) |
| Windshield Hub (Mark) | `windshield-hub` | `00652ba8-5580-4632-97be-0fd2090bbb71` | `b0e6b5c1-3100-44d5-8578-9015aa3023ae` | Unknown |
| Urban Vibe (Alisha) | `urban-vibe` | `5f88f03b-5aaf-40fc-a608-2f7ed765d6a6` | `aa601962-1cbd-4bbd-9d96-3c7a93c3414a` | Jacqueline — confident, young adult, empathic CS |

### Voice Behavior Notes
- **Ashley** (`df0b14d7-...`): Warm, slow. Avoid for professional/energetic contexts.
- **Jacqueline** (`aa601962-...`): Faster, crisper, alert. Good for property mgmt / inbound service.
- **Nour** (`d766b9e3-...`): Used by manzil-isa (Fatima). Arabic-name voice.
- `ttsPlaybackRate` does NOT exist in Ultravox — speed is controlled by voice selection + prompt only.

## How to Use Cartesia Voices in Ultravox

### Option 1: Cartesia voice ID via BYOK format
In the Ultravox agent PATCH or createCall, set:
```
"voice": "cartesia://sonic-2/CARTESIA_VOICE_ID"
```

### Option 2: Browse the Cartesia dashboard
- Log into Cartesia dashboard (cartesia.ai)
- Browse voice library
- Note the voice ID of voices you like
- Test via Ultravox dashboard test call or /try page

### Option 3: Voice Cloning (premium feature)
- Need 10-30 seconds of clean audio from the person
- Upload to Cartesia dashboard -> Create Voice Clone
- Get the cloned voice ID
- Use in Ultravox the same way: `"cartesia://sonic-2/CLONED_VOICE_ID"`

## Cartesia Voice Selection Criteria (for Aisha)

The current voice is warm and friendly. Any replacement must match:
- Gender: Female
- Warmth: High — office assistant, not call center
- Pace: Moderate — not rushed, not drawn out
- Age: Mid-20s to early 30s
- Accent: Neutral North American

## Cartesia Emotion Control

Cartesia sonic-2 supports per-utterance emotion: calm, content, angry, sad, scared, neutral.
How to use in prompts (test this — format may vary via Ultravox BYOK):
- Empathetic: `[calm]` "i hear you, that's frustrating..."
- Upbeat greeting: `[content]` "hey! this is Aisha..."
- Neutral info: `[neutral]` "Hasan covers Saskatoon and Prince Albert..."

## Testing Workflow

1. Pick a Cartesia voice from the library
2. Update the Ultravox agent PATCH with the new voice ID
3. Test via /try page "Hasan Sharif — Live Test" card (browser WebRTC — best audio quality)
4. Test via phone call (587) 742-1507
5. Run `/review-call [ultravox-call-id]` to grade
6. If it sounds good: update `clients/hasan-sharif/config.json` with the new voice ID
7. If not: try another voice

## Key Files

| File | Purpose |
|------|---------|
| `clients/hasan-sharif/SYSTEM_PROMPT.txt` | Live prompt (v7, deployed to Supabase + Ultravox) |
| `clients/hasan-sharif/config.json` | Client config including voice ID |
| `agent-app/src/lib/ultravox.ts` | Ultravox API client (createCall, callViaAgent, updateAgent) |
| `agent-app/src/lib/demo-prompts.ts` | /try page demo configs (voice IDs per demo) |
| `scripts/deploy_prompt.py` | Deploy script (has CLIENT_CONFIG with voice IDs) |
| `BUILD_PACKAGES/INBOUND_VOICE_AGENT/VOICE_AGENT_RESEARCH.md` | Full research doc — Section 3 (BYOK TTS) and Section 7 (Cartesia pilot) |
| `memory/voice-notes.md` | Per-voice behavior observations |
| `memory/cartesia-tts-integration.md` | Cartesia integration context |

## Ultravox API Quick Reference

```bash
# Get current agent config
curl -s -H "X-API-Key: $ULTRAVOX_API_KEY" \
  "https://api.ultravox.ai/api/agents/f19b4ad7-233e-4125-a547-94e007238cf8" | python3 -m json.tool

# PATCH agent with new voice (use Python for proper JSON escaping)
python3 << 'EOF'
import json, urllib.request
agent_id = "f19b4ad7-233e-4125-a547-94e007238cf8"
api_key = "from .env.local"  # Read from agent-app/.env.local
new_voice = "cartesia://sonic-2/CARTESIA_VOICE_ID_HERE"
# CRITICAL: Always send FULL callTemplate — PATCH replaces entire callTemplate
# Must include: voice, systemPrompt, selectedTools, contextSchema, firstSpeakerSettings, vadSettings, inactivityMessages
EOF
```

## What NOT to Do

- Do NOT add Twilio to Ultravox — that bypasses Railway (callerContext, HMAC, logging, SMS, Telegram)
- Do NOT change the voice without testing — some voices sound great in isolation but terrible on phone audio
- Do NOT remove `firstSpeakerSettings.agent.uninterruptible: true` from PATCH — causes greeting loop
- Do NOT forget to include voice in PATCH — omitting it resets to default Ultravox voice
- After changing any voice: run `/prompt-deploy [client]` to persist the change across all systems

## Current Prompt Status

hasan-sharif is on v7 (deployed Mar 14 2026):
- Grammar-breaking rules
- 7 inline examples (A-G)
- "Where is Hasan" handler
- 2-sentence limit enforced (rule 9)
- Casual speech enforcement (rule 10)
- Promptfoo: 7/7 PASS

## Business Context

Voice cloning is the differentiator for unmissed.ai. Clients can send a 30-sec voice clip and get their own receptionist's voice. Cartesia BYOK makes this possible without changing the Ultravox architecture. This is a premium upsell feature for onboarding.
