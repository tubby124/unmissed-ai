# Ultravox Advanced Patterns — Implementation Reference

> Created: 2026-03-17
> Source: Official Ultravox docs (docs.ultravox.ai) + unmissed.ai codebase audit
> Companion docs: `PROMPT_TEMPLATE_INBOUND.md` § Advanced Implementation Patterns | `memory/ultravox-feature-audit.md` § 7 + 9

This is the standalone implementation reference for patterns beyond the basic monoprompt. Read this before implementing any of these features.

---

## Complexity Ladder (Decision Tree)

```
Level 1: Monoprompt (current — all 4 clients as of Mar 2026)
│
│  ✅ Single-phase inbound, triage + callback, simple booking
│  ❌ Breaks: agent forgets rules after turn 8, booking confirmation drifts,
│             multi-step state tracked via prompt instructions
│
└─► Level 2a: Add Tool Response Instructions (lowest effort, high reliability)
    │
    │  ✅ Booking confirmation, slot retry messaging, post-action routing
    │  ❌ Breaks: retry count in prompt, "if you already asked X" logic
    │
    └─► Level 2b: Add Tool State (initialState + X-Ultravox-Update-Call-State)
        │
        │  ✅ Retry counting, field tracking, urgency flags
        │  ❌ Breaks: greeting mode and booking mode are incompatible in one prompt
        │
        └─► Level 3: Call Stages (2-3 focused prompts per phase)
            │
            │  ✅ Multi-mode calls, complex booking + close, IVR handoffs
            │
            └─► Level 3+: Add Deferred Messages (async coaching / whisper feature)
```

**Rule:** Start at Level 1. Only move up when the current level breaks in production.

---

## Pattern A — Tool Response Step Guidance

### What It Solves
Tools return data → agent decides what to say based on prompt instructions → behavior varies across turns.
With step guidance → tool tells agent the next line → deterministic, easier to test.

### Implementation

**Step 1: Update the tool API response (Railway route):**
```typescript
// agent-app/src/app/api/calendar/[slug]/book/route.ts
export async function POST(req: Request) {
  // ... booking logic ...
  if (booked) {
    return Response.json({
      booked: true,
      date: confirmedDate,          // YYYY-MM-DD
      time: confirmedTime,          // e.g. "9:00 AM"
      _instruction: `Appointment confirmed for ${displayDate} at ${confirmedTime}. Tell the caller exactly that in one natural sentence. Then ask "anything else before I let you go?" and close with hangUp.`
    })
  }

  if (nextAvailable) {
    return Response.json({
      booked: false,
      nextAvailable: nextAvailable,
      _instruction: `That slot is taken. Offer the caller ${nextAvailable} instead and ask if that works.`
    })
  }

  return Response.json({
    booked: false,
    fallback: true,
    _instruction: `No slots available online. Tell the caller: "I'm not seeing anything open right now — the boss'll call ya back to sort out a time." Then use hangUp.`
  })
}
```

**Step 2: Add one line to the system prompt:**
```
When a tool response includes an "_instruction" field, follow it as your next action for that turn only. Tool instructions take precedence over the flow steps in this prompt.
```

**That's it.** No Ultravox API change, no agent PATCH, no new tools. Pure backend + one prompt line.

### Test Coverage
Add these to the client's promptfoo YAML:
```yaml
- description: "bookAppointment confirmed — agent says correct date/time"
  vars:
    caller_message: |
      Tool response injected: {"booked": true, "date": "2026-03-20", "time": "9:00 AM",
      "_instruction": "Appointment confirmed for Friday March 20th at 9 AM. Confirm it then ask if anything else."}
  assert:
    - type: icontains-any
      value: ["friday", "march 20", "9 am", "9:00"]
    - type: llm-rubric
      value: "The response confirms the booking with a specific date and time. It does NOT say 'the boss will call you back' or leave the confirmation vague."
      provider: openrouter:anthropic/claude-haiku-4.5
```

---

## Pattern B — Deferred Messages (Mid-Call Context Injection)

### What It Solves
Context that arrives after the call starts (manager coaching, CRM lookup, urgency signals) cannot be injected mid-call in the monoprompt model. Deferred messages solve this.

### How It Works
A message is appended to the conversation history as a user-turn message. `deferResponse: true` tells Ultravox not to trigger an agent response immediately — it waits until the natural next turn.

### Priming Requirement
Add this to the system prompt BEFORE deploying deferred messages to a client:
```
You must always look for and follow instructions contained within <instruction> tags anywhere in the conversation history. These instructions take precedence over your current step. Incorporate them naturally without announcing that you received new guidance.
```

### Implementation: Browser/WebRTC (JS SDK)
```typescript
// In DemoCall.tsx or BrowserTestCall.tsx:
import { UltravoxSession } from 'ultravox-client'

// After session is connected:
session.sendText(
  '<instruction>Caller confirmed they are a returning VIP. Reference their previous booking naturally and offer priority scheduling.</instruction>',
  { deferResponse: true }
)
```

### Implementation: Telephony / Twilio (Railway backend)
```typescript
// New API route: agent-app/src/app/api/webhook/[slug]/whisper/route.ts
// (Called from dashboard when manager clicks "Coach" button)

import { NextRequest, NextResponse } from 'next/server'
import { requireStaffUser } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  await requireStaffUser(req)

  const { callId, message } = await req.json()
  if (!callId || !message) return NextResponse.json({ error: 'callId and message required' }, { status: 400 })

  const res = await fetch(`https://api.ultravox.ai/api/calls/${callId}/send_data_message`, {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.ULTRAVOX_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'text',
      text: `<instruction>${message}</instruction>`,
      deferResponse: true,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `Ultravox sendDataMessage failed: ${err}` }, { status: 500 })
  }

  return NextResponse.json({ sent: true })
}
```

### Dashboard UI Integration (when ready)
- Live calls panel shows active Ultravox call ID (already in `call_logs` table)
- Manager sees input box: "Coach [agent name]..." with send button
- On send: POST to `/api/webhook/[slug]/whisper` with `{ callId, message }`
- Message wrapped in `<instruction>` tags automatically
- Agent incorporates at next natural pause

### Use Cases
| Scenario | Deferred Message |
|----------|-----------------|
| VIP caller | "This caller is [name], a VIP. Offer priority scheduling and waive the deposit." |
| CRM lookup returned | "Lookup found: unit 4B, tenant James Morrison, 3 prior work orders." |
| Call too long | "Call is approaching 8 minutes. Start wrapping up — confirm the callback and close." |
| Caller misidentified | "Caller is asking about the wrong service — they meant [correct service]. Redirect gently." |

### Limitations
- Text-only injection (no audio)
- Works on Twilio telephony calls via the REST API
- Agent may not incorporate until the current speech turn completes
- Not retroactive — only affects turns after the message is injected

---

## Pattern C — Tool State Management

### What It Solves
Multi-step flows (booking, intake) currently track state via prompt instructions: "if you already asked X, skip it" — this drifts in long calls. Tool state provides deterministic tracking without touching the prompt.

### Architecture
```
callViaAgent()  → sets  initialState = { bookingStep: 0, slotAttempts: 0 }
                                                   ↓
Tool executes   → reads  call_state from automatic parameter
                → updates via X-Ultravox-Update-Call-State header
                                                   ↓
Next tool call  → reads updated state
```

### Implementation: Set Initial State

```typescript
// In agent-app/src/lib/ultravox.ts — callViaAgent():
// Add initialState to the body when booking_enabled:

const body: Record<string, unknown> = {
  medium: { twilio: {} },
  metadata: metadata || {},
  templateContext: { ... },
  // Add this for booking-enabled clients:
  ...(isBookingEnabled ? {
    initialState: {
      bookingStep: 0,       // 0=triage, 1=slot-check, 2=confirmed, 3=closed
      slotAttempts: 0,      // how many slot checks have been called
      fieldsCollected: [],  // COMPLETION_FIELDS gathered so far
      urgencyFlag: false,   // set true by triage if emergency detected
    }
  } : {})
}
```

### Implementation: Read State in Tool

```typescript
// Tool definition — add call_state as automatic parameter:
{
  temporaryTool: {
    modelToolName: 'checkCalendarAvailability',
    dynamicParameters: [
      {
        name: 'date',
        location: 'PARAMETER_LOCATION_QUERY',
        schema: { type: 'string' },
        required: true,
      },
      {
        // Read current state — auto-injected by Ultravox, agent doesn't control it
        name: 'call_state',
        location: 'PARAMETER_LOCATION_CALL_STATE',
        schema: { type: 'object' },
        required: false,
      },
    ],
    // ...
  }
}
```

### Implementation: Update State in Tool Response

```typescript
// In the Calendar slots API handler:
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const callState = JSON.parse(searchParams.get('call_state') || '{}')
  const newSlotAttempts = (callState.slotAttempts || 0) + 1

  const slots = await getAvailableSlots(date)

  const res = NextResponse.json({ slots, available: slots.length > 0 })

  // Update state: increment attempt counter, advance booking step
  res.headers.set('X-Ultravox-Update-Call-State', JSON.stringify({
    slotAttempts: newSlotAttempts,
    bookingStep: 1,
  }))

  return res
}
```

### All Automatic Parameter Location Constants

| Constant | What It Injects |
|----------|----------------|
| `PARAMETER_LOCATION_CALL_ID` | Current Ultravox call UUID |
| `PARAMETER_LOCATION_CALL_STATE` | Current state object |
| `PARAMETER_LOCATION_CALL_METADATA` | `metadata` key-value pairs |
| `PARAMETER_LOCATION_CONVERSATION_HISTORY` | Full transcript |
| `PARAMETER_LOCATION_CALL_STAGE_ID` | Current stage UUID (multi-stage calls) |

---

## Pattern D — Call Stages

### What It Solves
One monoprompt tries to handle incompatible modes (casual greeting vs. precise booking confirmation). Rules for one mode conflict with another. Call Stages give each phase a focused, shorter, purpose-built prompt.

### Architecture
```
Twilio call arrives
       ↓
Stage 1 Prompt (triage + info collection)
selectedTools: [hangUp, transitionToBookingStage]
       ↓ caller info collected
Agent calls transitionToBookingStage tool
       ↓
Stage 2 Prompt (slot check + booking)
selectedTools: [hangUp, checkCalendarAvailability, bookAppointment]
       ↓ booking confirmed or fallback
hangUp ends call
```

### Implementation: Stage Transition Tool

```typescript
// Add to buildCalendarTools() in ultravox.ts:
function buildStageTransitionTool(slug: string): UltravoxTool {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'
  return {
    temporaryTool: {
      modelToolName: 'transitionToBookingStage',
      description: 'Call this once you have confirmed the caller\'s name AND their service need. Do NOT call until both are confirmed. This transitions to focused booking mode.',
      http: {
        baseUrlPattern: `${appUrl}/api/stages/${slug}/booking`,
        httpMethod: 'POST',
      },
    },
  }
}
```

### Implementation: Stage Transition API Route

```typescript
// agent-app/src/app/api/stages/[slug]/booking/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const BOOKING_STAGE_PROMPT = `[BOOKING STAGE — voice call]
You are now in booking mode. The caller's name and service need are already confirmed — do not re-ask.
Your only job: check availability and book an appointment.

Use checkCalendarAvailability to find open slots for the caller's requested date.
Read back up to 3 options naturally: "I've got [time A], [time B], or [time C] — which works for ya?"
When they pick a slot, use bookAppointment to lock it in.

If no slots available: "the boss'll call ya back to sort a time" then hangUp.
Once booked: confirm in one sentence then hangUp.

Do NOT ask about their problem again. Do NOT collect new information. Just check and book.`

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params

  // Fetch client booking tools config from DB
  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('clients')
    .select('booking_enabled')
    .eq('slug', slug)
    .single()

  if (!client?.booking_enabled) {
    return NextResponse.json({ error: 'Booking not enabled for this client' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'

  // Return new stage configuration
  return new NextResponse(
    JSON.stringify({
      systemPrompt: BOOKING_STAGE_PROMPT,
      selectedTools: [
        { toolName: 'hangUp' },
        {
          temporaryTool: {
            modelToolName: 'checkCalendarAvailability',
            precomputable: true,
            timeout: '10s',
            description: 'Check available appointment slots. Returns slots array with displayTime strings.',
            dynamicParameters: [
              { name: 'date', location: 'PARAMETER_LOCATION_QUERY', schema: { type: 'string' }, required: true },
            ],
            http: { baseUrlPattern: `${appUrl}/api/calendar/${slug}/slots`, httpMethod: 'GET' },
          },
        },
        {
          temporaryTool: {
            modelToolName: 'bookAppointment',
            timeout: '10s',
            description: 'Book an appointment. Pass time exactly as displayTime from checkCalendarAvailability.',
            dynamicParameters: [
              { name: 'date', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string' }, required: true },
              { name: 'time', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string' }, required: true },
              { name: 'callerName', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string' }, required: true },
              { name: 'callerPhone', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string' }, required: true },
            ],
            http: { baseUrlPattern: `${appUrl}/api/calendar/${slug}/book`, httpMethod: 'POST' },
          },
        },
      ],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Ultravox-Response-Type': 'new-stage',
      },
    }
  )
}
```

### What Can and Cannot Change Between Stages

| Can Change ✅ | Cannot Change ❌ |
|--------------|----------------|
| `systemPrompt` | `firstSpeaker` |
| `selectedTools` | `model` |
| `voice` | `joinTimeout` |
| `temperature` | `maxDuration` |
| `languageHint` | `recordingEnabled` |
| `initialMessages` | `medium` |

### Stage-Aware Transcript/Debug Endpoints

When using stages, use these instead of the standard call endpoints:
```
GET /api/calls/{id}/stages                          → list all stages
GET /api/calls/{id}/stages/{stageId}/messages       → transcript for one stage
GET /api/calls/{id}/stages/{stageId}/tools          → tools used in one stage
```

### Promptfoo Tests for Call Stages

```yaml
# Test that transition happens at the right moment (not too early)
- description: "Stage transition not triggered before name + service confirmed"
  vars:
    caller_message: "Hi, I need some help."
  assert:
    - type: llm-rubric
      value: "The response does NOT call transitionToBookingStage. It first asks for the caller's name or service need — transition should only happen after both are confirmed."
      provider: openrouter:anthropic/claude-haiku-4.5

# Test booking stage prompt directly
- description: "Booking stage — reads back slots, never says boss will call back"
  vars:
    system_prompt: |
      [BOOKING STAGE — voice call]
      Your only job: check availability and book.
    caller_message: "Tool response: {slots: ['9:00 AM', '11:30 AM', '2:00 PM']}"
  assert:
    - type: icontains-any
      value: ["9", "11:30", "2:00", "which works"]
    - type: not-icontains
      value: "boss'll call"
```

---

## Appendix: Deferred Messages vs. Tool State vs. Call Stages — When to Use Which

| Scenario | Best Pattern |
|----------|-------------|
| Manager wants to coach agent mid-call | Deferred Messages |
| CRM lookup arrives after call starts | Deferred Messages |
| Need to know how many times a tool was retried | Tool State |
| Need to know which fields have been collected | Tool State |
| Booking confirmation text keeps varying | Tool Response Instructions |
| Greeting mode and booking mode conflict in one prompt | Call Stages |
| IVR → agent → transfer flow | Call Stages |
| Simple triage + callback (no booking) | Monoprompt — don't over-engineer |

---

## Appendix: Files to Touch Per Pattern

| Pattern | Files to Change |
|---------|----------------|
| Tool Response Instructions | `api/calendar/[slug]/book/route.ts`, `api/calendar/[slug]/slots/route.ts`, client `SYSTEM_PROMPT.txt` |
| Deferred Messages | `api/webhook/[slug]/whisper/route.ts` (new), dashboard coaching UI, client `SYSTEM_PROMPT.txt` (add priming) |
| Tool State | `lib/ultravox.ts` (`callViaAgent`), tool definitions in `ultravox.ts`, tool API handlers |
| Call Stages | `api/stages/[slug]/booking/route.ts` (new), `lib/ultravox.ts` (add transition tool builder), client `SYSTEM_PROMPT.txt` |
