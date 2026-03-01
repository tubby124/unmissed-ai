# AI Receptionist Platform — agent-app Documentation
> Created: February 23, 2026 | Next.js 16 + Tailwind + shadcn/ui
> Brand name TBD — handled.ai NOT available. Verify new domain before any marketing work.

---

## What This Is

The `agent-app` folder is the **Next.js web application** for the AI receptionist platform. It contains:

1. **Homepage** (`/`) — landing page with hero, stats, and CTA
2. **Onboarding Wizard** (`/onboard`) — 7-step multi-page form that collects everything needed to set up a client's AI agent
3. **Provisioning Status Page** (`/onboard/status`) — real-time progress screen shown after wizard submission
4. **Provision API** (`/api/provision`) — POST: triggers n8n provisioning webhook; GET: polls job status

This is a **Type-C modular system** — every component (voice engine, AI, telephony, notifications, storage) is swappable without touching the others. See `MODULE_REGISTRY.md` in the parent directory.

---

## Quick Start

```bash
cd "agent-app"
npm install
npm run dev
# App runs at http://localhost:3001 (or :3000 if available)
```

**Test the wizard:** Open `http://localhost:3001/onboard`
- No n8n needed — dev mode simulates provisioning automatically
- Submit the form → watch the progress animation → see success screen with simulated phone number

**Production build:**
```bash
npm run build
npm start
```

---

## Project Structure

```
agent-app/
├── .env.local                          ← Environment variables (never commit)
├── src/
│   ├── app/
│   │   ├── layout.tsx                  ← Root layout (fonts, metadata)
│   │   ├── page.tsx                    ← Homepage — hero, stats, CTA to /onboard
│   │   │
│   │   ├── onboard/
│   │   │   ├── page.tsx                ← WIZARD SHELL — state, step nav, submit handler
│   │   │   ├── steps/
│   │   │   │   ├── step1.tsx           ← Pick your industry (niche selector)
│   │   │   │   ├── step2.tsx           ← Business basics (name, city, state, agent name, phone)
│   │   │   │   ├── step3.tsx           ← Business hours (per-day pickers + after-hours behavior)
│   │   │   │   ├── step4.tsx           ← Niche-dynamic questions (renders by selected niche)
│   │   │   │   ├── step5.tsx           ← Notification setup (Telegram / SMS / both)
│   │   │   │   ├── step6.tsx           ← Agent preferences (FAQ, restrictions, tone)
│   │   │   │   ├── step7.tsx           ← Review + agent preview + Edit buttons
│   │   │   │   └── niches/
│   │   │   │       ├── auto-glass.tsx  ← Insurance, mobile service, services checklist
│   │   │   │       ├── hvac.tsx        ← Emergency service, service area, brands
│   │   │   │       ├── plumbing.tsx    ← Emergency service, service area, residential/commercial
│   │   │   │       ├── dental.tsx      ← New patients, insurance, emergency appointments
│   │   │   │       ├── legal.tsx       ← Practice areas, consultations, urgent routing
│   │   │   │       └── salon.tsx       ← Services, booking type, walk-ins
│   │   │   └── status/
│   │   │       └── page.tsx            ← Provisioning progress page (polls /api/provision)
│   │   │
│   │   └── api/
│   │       └── provision/
│   │           └── route.ts            ← POST: fires n8n webhook; GET: returns job status
│   │
│   ├── components/
│   │   └── ui/                         ← shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── progress.tsx
│   │       ├── badge.tsx
│   │       ├── select.tsx
│   │       └── textarea.tsx
│   │
│   ├── lib/
│   │   └── utils.ts                    ← shadcn utility (cn() class merge)
│   │
│   └── types/
│       └── onboarding.ts               ← All TypeScript types for wizard data
│
├── package.json
└── tsconfig.json
```

---

## Environment Variables (`.env.local`)

```bash
# n8n provisioning webhook — leave blank in dev (simulation runs automatically)
N8N_PROVISION_WEBHOOK_URL=

# Supabase — add when wiring production database
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Stripe — add when building payment flow
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

**Dev mode behavior:** When `N8N_PROVISION_WEBHOOK_URL` is empty, the API simulates provisioning with 4 steps (~8 seconds total) and returns a fake phone number `+15551234567`. This lets you test the full wizard → status flow without any backend.

---

## Onboarding Wizard — How It Works

### Data Flow
```
User fills wizard → OnboardingData state (in-memory, client-side)
  → Step 7 "Activate" → POST /api/provision (sends full OnboardingData as JSON)
    → API generates jobId → fires n8n webhook (or simulation)
    → Redirects to /onboard/status?jobId=xxx
      → Status page polls GET /api/provision?jobId=xxx every 3 seconds
        → Shows progress steps → success screen with AI phone number
```

### OnboardingData Schema (see `src/types/onboarding.ts`)
```typescript
{
  niche: "auto_glass" | "hvac" | "plumbing" | "dental" | "legal" | "salon" | "real_estate" | "other"
  businessName: string
  city: string
  state: string           // 2-letter US state code
  agentName: string       // what callers hear ("Mark", "Mike", etc.)
  callbackPhone: string   // owner's real number — goes in SMS follow-up
  hours: {                // per-day open/close/closed
    monday: { open: "09:00", close: "17:00", closed: false }
    ...saturday/sunday: { closed: true }
  }
  afterHoursBehavior: "take_message" | "route_emergency" | "standard"
  nicheAnswers: Record<string, string | string[] | boolean>  // niche-specific answers
  notificationMethod: "telegram" | "sms" | "email" | "both"
  notificationPhone: string
  notificationEmail: string
  callerFAQ: string       // common caller questions for agent to know
  agentRestrictions: string  // what agent should NOT say/do
  agentTone: "casual" | "professional" | "match_industry"
}
```

### Adding a New Niche (Plug-and-Play)
1. Add niche ID to the `Niche` type in `src/types/onboarding.ts`
2. Add label, emoji, and default agent name to the registry objects in the same file
3. Create `src/app/onboard/steps/niches/[niche].tsx` — questions component
4. Import and register it in `src/app/onboard/steps/step4.tsx` (`NICHE_COMPONENTS` object)
5. Done — no changes to wizard shell, API, or n8n

---

## API Routes

### `POST /api/provision`
**Request body:** Full `OnboardingData` JSON
**Response:** `{ jobId: string }` (HTTP 202)

Triggers the n8n provisioning webhook (or simulation in dev). Non-blocking — returns immediately with a job ID.

### `GET /api/provision?jobId=xxx`
**Response:**
```json
{
  "jobId": "uuid",
  "status": "pending | buying_number | cloning_workflow | wiring_creds | active | failed",
  "twilio_number": "+15551234567" | null,
  "error": null | "error message"
}
```

**Production note:** Currently uses in-memory Map for job state — not persistent across restarts. Replace with Supabase `provisioning_jobs` table for production:
```sql
CREATE TABLE provisioning_jobs (
  id uuid PRIMARY KEY,
  client_id uuid,
  status text,
  twilio_number text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
```

---

## n8n Provisioning Webhook (Backend)

When `N8N_PROVISION_WEBHOOK_URL` is set, the API sends the full `OnboardingData` payload to n8n. The n8n workflow must:

1. Buy Twilio number (area code from `city`/`state`)
2. Clone `workflow_change15_cron.json` via n8n REST API
3. Generate system prompt (Claude fills `{{VARIABLES}}` from form data + niche prompt template)
4. Create Google Sheet (copy template, inject prompt)
5. Create n8n credentials (OpenRouter, Ultravox, Twilio, Telegram)
6. Wire credentials into cloned workflow, update webhook URLs, activate
7. Register client in Supabase `clients` table
8. Send welcome email (Brevo/GHL)
9. Call back the status endpoint or update Supabase with `twilio_number`

**Provisioning script:** `provision_client.py` in parent `PROVISIONING/` directory (to be built — Phase 2)

**Manual steps that cannot be automated:**
- Google Sheets OAuth authorization in n8n UI (~2 min)
- Telegram bot creation via BotFather (~3 min)
- Caller ID Lookup enabled on Twilio number (~1 min)
- Client sets up call forwarding on their carrier

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16 (App Router) | Deployed to Vercel |
| Styling | Tailwind CSS v4 + shadcn/ui v3 | |
| Language | TypeScript | Strict mode |
| Database | Supabase (Postgres) | Not yet wired — add for production |
| Payments | Stripe | Not yet wired — add for pricing page |
| Forms | Built-in wizard | Tally.so for external intake if needed |

---

## Routes Summary

| Route | Type | Description |
|-------|------|-------------|
| `/` | Static | Homepage — hero, stats, CTA |
| `/onboard` | Client component | 7-step wizard |
| `/onboard/status` | Client component | Provisioning progress |
| `/api/provision` | Dynamic API | POST + GET for provisioning |

---

## What's Next (Phase 1 Priorities)

1. **Brand/domain** — verify available domain on Porkbun/Namecheap before any marketing assets
2. **n8n provisioning webhook** — build the workflow that responds to `POST /api/provision`
3. **Pricing page** (`/pricing`) — 3-tier Stripe checkout (Starter / Pro / Business)
4. **Stripe integration** — `POST /api/stripe/checkout`, `POST /api/stripe/webhook`
5. **Supabase wiring** — swap in-memory job store for `provisioning_jobs` table
6. **Home page copy** — update with real brand name, demo audio embed, niche selector
7. **Auto glass niche landing page** (`/for-auto-glass`) — first niche page

**Not yet built (Phase 2+):**
- Client portal (`/portal`) — call logs, stats, agent editor
- Operator dashboard (`/admin`)
- Weekly performance report emails
- Error monitoring → Telegram alerts
- Spam/ghost call duration filter

See `CALLING AGENTs/MODULE_REGISTRY.md` for full module swap documentation.
See `CALLING AGENTs/PRD.md` for full product requirements.
See `CALLING AGENTs/COMPANY_RESEARCH_AND_STRATEGY.md` for market research.
