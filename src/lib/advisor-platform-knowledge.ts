/**
 * Platform Knowledge Base — injected into advisor system prompt
 * so the AI can answer questions about the unmissed.ai dashboard,
 * call forwarding setup, settings, and troubleshooting.
 */

// ── Client Setup Context (dynamic per user) ──────────────────────────────────

export interface ClientSetup {
  status: string              // setup | active | paused | churned
  twilioNumber: string | null
  niche: string | null
  bookingEnabled: boolean
  transferEnabled: boolean
  forwardingNumber: string | null
  agentName: string | null
  userName: string | null
  agentPromptSummary: string | null  // first ~2000 chars of system_prompt
}

export function formatClientSetup(setup: ClientSetup): string {
  const parts: string[] = []

  // Current date/time context
  const now = new Date()
  const timeStr = now.toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
  parts.push(`\n## Current Context`)
  parts.push(`- **Current date/time:** ${timeStr} (Central Time)`)
  if (setup.userName) {
    parts.push(`- **User name:** ${setup.userName} — address them by first name`)
  }

  parts.push(`\n## Your Account Status`)

  const statusLabels: Record<string, string> = {
    setup: 'Setting up — your agent is not live yet',
    active: 'Active — your AI agent is live and receiving calls',
    paused: 'Paused — your agent is temporarily offline',
    churned: 'Inactive — your account has been deactivated',
  }

  parts.push(`- **Status:** ${statusLabels[setup.status] || setup.status}`)

  if (setup.twilioNumber) {
    const formatted = setup.twilioNumber.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3')
    parts.push(`- **Your AI Agent Number:** ${formatted} — this is the number callers reach your AI agent on`)
    parts.push(`- **Call Forwarding:** Forward your business line to this number so calls go to your AI agent`)
  } else {
    parts.push(`- **AI Agent Number:** Not assigned yet — complete setup to get your number`)
  }

  if (setup.agentName) {
    parts.push(`- **Agent Name:** ${setup.agentName}`)
  }
  if (setup.niche) {
    parts.push(`- **Industry/Niche:** ${setup.niche.replace(/_/g, ' ')}`)
  }

  parts.push(`- **Calendar Booking:** ${setup.bookingEnabled ? 'Enabled — callers can book appointments through your agent' : 'Disabled — not set up or turned off'}`)
  parts.push(`- **Live Transfer:** ${setup.transferEnabled ? 'Enabled — your agent can transfer callers to your phone' : 'Disabled — callers cannot be transferred mid-call'}`)

  // Proactive setup guidance if not fully active
  if (setup.status === 'setup') {
    parts.push(`\n### Complete Your Setup`)
    parts.push(`Your account is still being set up. Here's what you need to do:`)
    if (!setup.twilioNumber) {
      parts.push(`1. Complete the onboarding form with your business details`)
      parts.push(`2. Pay the $20 activation fee`)
      parts.push(`3. You'll be assigned a phone number for your AI agent`)
      parts.push(`4. Set up call forwarding from your business line to that number`)
      parts.push(`5. Make a test call to verify everything works`)
    } else {
      parts.push(`1. Set up call forwarding from your business line to ${setup.twilioNumber}`)
      parts.push(`2. Make a test call from another phone to verify your agent answers`)
      parts.push(`3. Once confirmed, your agent goes live automatically`)
    }
  }

  // Agent prompt summary — the "answer key" for coaching
  if (setup.agentPromptSummary) {
    parts.push(`\n## Your Agent's Current Instructions (summary)`)
    parts.push(`Below is the beginning of your AI agent's system prompt — what it's told to do on calls. Use this to identify gaps between what the agent SHOULD do vs what it ACTUALLY did in transcripts.`)
    parts.push(`\n\`\`\`\n${setup.agentPromptSummary}\n\`\`\``)
    parts.push(`When coaching on agent performance, reference specific sections from these instructions. If a caller asked about something the prompt doesn't cover, suggest adding it.`)
  }

  return parts.join('\n')
}

// ── Static Platform Knowledge Base ───────────────────────────────────────────

export const PLATFORM_KNOWLEDGE = `
## unmissed.ai Platform Guide

### Dashboard Pages
- **Calls** (/dashboard/calls): View all inbound calls handled by your AI agent. Filter by status (HOT, WARM, COLD, JUNK, MISSED). Click any call to see the full transcript, AI summary, duration, sentiment, and quality score.
- **Leads** (/dashboard/leads): Quick view of high-priority leads (HOT and WARM). Shows caller phone, intent, next steps, and time since call. Drag leads between columns to update status.
- **Setup** (/dashboard/setup): Step-by-step call forwarding instructions for your carrier. Shows your assigned Twilio number and guides you through enabling forwarding from your business line.
- **Test Lab** (/dashboard/lab): Fire test calls to your AI agent to verify behavior before going live. Great for testing after prompt changes or settings updates.
- **Advisor** (/dashboard/advisor): This chat — ask questions about your calls, leads, trends, agent performance, or how to use the platform.
- **Settings** (/dashboard/settings): Update your business details, agent name, voice, hours, services, and manage your subscription.

### Call Forwarding — How It Works
Your AI agent has a dedicated phone number (Twilio). You forward your existing business line to this number so all calls reach your agent. Your customers still call your regular number — they never see the Twilio number.

#### Mobile Carriers (Standard GSM Codes)
All Canadian mobile carriers use standard 3GPP GSM codes:
- **Enable forwarding (all calls):** *21*[your agent number]#
- **Enable forwarding (no answer):** **61*[your agent number]**11# (rings 3 times, then forwards)
- **Enable forwarding (busy):** **67*[your agent number]#
- **Enable forwarding (unreachable):** **62*[your agent number]#
- **Disable forwarding:** #21# (all) | #61# (no answer) | #67# (busy) | #62# (unreachable)
- **Check status:** *#21# | *#61# | *#67# | *#62#

**Carrier-specific notes:**
- **Rogers:** Disable voicemail first — conditional forwarding won't work with voicemail active.
- **Fido/Chatr:** Use ##61#, ##62#, ##67# (double hash) to disable instead of single hash.
- **Koodo:** Call Forwarding add-on required (~$3-5/month). Add it in the My Koodo app first.
- **Public Mobile:** Call forwarding is free on all plans.

#### Landline Providers
- **Rogers/Shaw Business, Bell Business:** *72[number] to enable, *73 to disable. Pick up receiver, dial code + 10-digit number, wait for confirmation tone.
- **SaskTel (IBC):** *72[number] to enable, *73 to disable. You can also manage via the SaskTel IBC web portal. Set ring count: *92N[number] where N = number of rings.
- **Telus Business (wireline):** *72[number] — destination phone must ring and be answered to confirm. If *72 doesn't work, try #72.

#### VoIP Systems
- **RingCentral / 8x8 / Vonage / Grasshopper:** Go to your admin portal → Call Handling → Add a forwarding rule → Enter your AI agent number.
- **Microsoft Teams Phone / Zoom Phone:** Forwarding configured in admin portal → Routing settings.

### Settings Explained
- **Business Name:** How your AI agent introduces your business on calls.
- **Agent Name:** The name your AI uses (e.g., "Hi, I'm Aisha from..."). You can change this anytime.
- **Hours:** Your business hours. The agent adjusts its behavior outside hours (e.g., takes messages instead of booking).
- **Services Offered:** What your business does. The agent references these when asked by callers.
- **Voice:** The AI agent's speaking voice. Different voice options available.
- **Calendar Booking:** When enabled, your agent can check availability and book appointments directly into Google Calendar.
- **Live Transfer:** When enabled, your agent can transfer callers to your personal phone during the call.

### Common Questions & Troubleshooting
- **"Calls not reaching my agent"** → Verify call forwarding is active: dial *#21# from your phone. Also check your Twilio number is correct on the Setup page.
- **"Agent says wrong business name"** → Go to Settings and update your business name. Changes apply immediately.
- **"Agent doesn't know my services"** → Go to Settings and update the Services field. The agent uses this to answer caller questions.
- **"How do I change the voice?"** → Go to Settings → Voice section. Select a new voice. Changes apply on the next call.
- **"How do I test my agent?"** → Go to Test Lab and click "Make Test Call." You'll receive a call from your agent.
- **"How do I pause my agent?"** → Contact support. Self-serve pause is coming soon.
- **"How do I see call transcripts?"** → Go to Calls → click any call row → the full transcript appears with AI summary and quality score.
- **"What do the lead statuses mean?"** → HOT = high intent, ready to buy/book. WARM = interested but needs follow-up. COLD = low intent or just inquiring. JUNK = spam, wrong number, or irrelevant. MISSED = agent couldn't connect.
- **"How do I get more from this advisor?"** → Ask specific questions about your data: "Which leads need follow-up?", "What's my busiest day?", "How did my agent handle the last HOT lead?", "What can I improve?"
`
