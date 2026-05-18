/**
 * MARKETING CONTENT — End Voicemail
 *
 * Single source of truth for all homepage and marketing copy.
 * Edit this file to change text across the site without hunting through components.
 *
 * After editing: rebuild + push to Railway.
 *
 * Related config files:
 *   - lib/pricing.ts   → plans, prices, competitors, features
 *   - lib/brand.ts     → brand name, domain, emails
 *   - lib/niche-pages.ts → per-industry landing page content
 */

import { Phone, Zap, Clock } from 'lucide-react'
import { PhoneIncoming, Bot, BellRing, CircleCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PLANS, SETUP, MINUTE_RELOAD, POLICIES } from './pricing'

// ─── Hero ────────────────────────────────────────────────────────────
export const HERO = {
  eyebrow: 'Missed-call AI for service businesses',
  headline: ['End voicemail', 'with an AI that', 'answers missed calls.'],
  /** Highlighted portion of the last headline line (rendered in primary color) */
  headlineAccent: 'answers missed calls.',
  subtitle:
    "Forward unanswered calls to your AI number. It answers in your business name, qualifies the lead, and sends you the summary so you can call back ready.",
  ctaLabel: "Hear the demo before you activate.",
  proofLine: "Want to hear it first? Get a demo call from Zara below.",
}

// ─── Call Me Now Widget Copy ──────────────────────────────────────────
export const CALL_ME_WIDGET_COPY = {
  /** Hero/compact mode helper text under the input row */
  helperTextCompact:  "Demo call only. No app. No sign-up.",
  /** Standard (non-compact) label above the input */
  standardLabel:      "Get a live call from Zara in seconds.",
  /** Expanded helper text in non-compact mode */
  helperTextFull:     "We'll call your phone and connect you live. No app needed.",
  /** Proof line — shows under input in hero compact mode */
  proofLine:          "Hear exactly how End Voicemail answers, qualifies, and follows up with callers.",
  /** Success heading — urgency, not celebration */
  successHeading:     "Pick up now — Zara is calling from an unknown number.",
  /** Success body — sets expectation + reinforces value */
  successBody:        "That's Zara, our AI receptionist. This is exactly what your callers will hear.",
  /** Button states */
  buttonIdle:         "Call Me Now",
  buttonLoading:      "Calling...",
}

// ─── Talk to Zara Widget Copy ─────────────────────────────────────────
export const TALK_TO_ZARA_COPY = {
  /** Floating button label (desktop) */
  floatingLabel:      "Talk to Zara",
  /** Small subline shown under floating label on desktop */
  floatingSubline:    "browser · no phone",
  /** Form intro */
  formIntro:          "Tell Zara a bit about yourself — she'll tailor the conversation:",
  /** Phone placeholder */
  phonePlaceholder:   "Mobile # (optional) — Zara will text you a recap",
  /** Submit button */
  submitLabel:        "Talk to Zara",
  /** Skip link */
  skipLabel:          "Skip — just start the call",
}

// ─── Hero Call Mockup ────────────────────────────────────────────────
// The animated call card in the hero right column
export const HERO_MOCKUP = {
  /** Business name shown in the call card header */
  businessName: 'Crystal Clear Auto Glass',
  /** Agent name shown in the "Agent" row */
  agentName: 'Tyler · Auto Glass',
  /** AI sentence shown in the summary stage */
  summaryText:
    'Chip repair booked for Tuesday. Caller confirmed availability and SMS confirmation sent.',
  /** Rows shown in the summary stage */
  summaryRows: [
    { label: 'Duration', value: '2m 14s' },
    { label: 'Intent', value: 'Windshield chip repair' },
    { label: 'Outcome', value: 'Appointment booked' },
    { label: 'SMS sent', value: 'Confirmation sent' },
  ],
  /** Caller intent shown in the classifying/hot stages */
  callerIntent: 'Windshield chip repair',
  /** Telegram toast text */
  toastTitle: 'New job — Tyler has the details',
  toastSubtitle: 'Windshield chip · ready to book',
}

// ─── Trust Bar ───────────────────────────────────────────────────────
export const TRUST_BAR = {
  label: 'The real activation path',
  stats: [
    { icon: Phone as LucideIcon, value: 'AI number', label: 'Assigned after checkout', delay: 0 },
    { icon: Bot as LucideIcon, value: 'Business-trained', label: 'GBP + website', delay: 0.1 },
    { icon: Zap as LucideIcon, value: 'Email alerts', label: 'Telegram optional', delay: 0.2 },
    { icon: Clock as LucideIcon, value: '24/7', label: 'Missed-call coverage', delay: 0.3 },
  ],
}

// ─── Demo Section (DemoAudioPlayer) ─────────────────────────────────
export const DEMO_SECTION = {
  eyebrow: 'Live Demo',
  headline: 'Hear it answer.',
  subheadline: 'Real calls your AI agent handles — every caller greeted, every job captured.',
  ctaLabel: 'Talk to an AI Agent Live',
  ctaHref: '/try',
  ctaSubtext: 'No sign-up · Browser demo',
}

// ─── How It Works ────────────────────────────────────────────────────
export const HOW_IT_WORKS = {
  eyebrow: 'How It Works',
  headline: 'Four steps from checkout to replacing voicemail.',
  subheadline: 'Your agent is built during signup. Then you forward missed calls and run a real test.',
  /** Shown below the steps grid */
  proofLine: '50 activation minutes included · Real forwarded-call test · Email alerts first, Telegram optional',
  steps: [
    {
      number: '01',
      icon: PhoneIncoming as LucideIcon,
      title: 'Forward missed calls to your AI number',
      description:
        'After checkout, you get a real AI number. Forward unanswered calls from your existing business line so callers reach your agent instead of voicemail.',
    },
    {
      number: '02',
      icon: Bot as LucideIcon,
      title: 'Agent answers — every time',
      description:
        'Your agent learns from your Google Business Profile, website, and setup answers. It speaks naturally, captures caller info, and understands what they need.',
    },
    {
      number: '03',
      icon: BellRing as LucideIcon,
      title: 'You get the lead summary instantly',
      description:
        'A full call summary goes to your email by default, with Telegram available for faster alerts: caller name, number, what they need, and who to call back first.',
    },
    {
      number: '04',
      icon: CircleCheck as LucideIcon,
      title: 'Call back informed — skip the jobs not worth your time',
      description:
        'You know exactly what the job is before you dial. No chasing dead ends. Just close the work that\'s worth your time.',
    },
  ],
}

// ─── Pricing Section (homepage inline) ───────────────────────────────
export const PRICING_SECTION = {
  eyebrow: 'Pricing',
  headline: 'Activate a real AI number, then test it with 50 included minutes.',
  subheadline: 'Solo starts at $29/mo. AI Receptionist is $119/mo with 250 included minutes for businesses that want booking, business knowledge, and lead ranking.',
  fullPricingLinkText: 'See full pricing details and feature comparison →',
}

// ─── Final CTA (homepage) ────────────────────────────────────────────
export const FINAL_CTA = {
  headline: 'The next missed call is a job you won\'t get back.',
  subheadline: 'Every unanswered call goes to whoever picked up. Make sure that\'s you.',
  signupLinkText: 'Get your AI number →',
}

// ─── FAQ ─────────────────────────────────────────────────────────────
// Uses PLANS, SETUP, MINUTE_RELOAD, POLICIES from pricing.ts — edit prices there,
// answers here update automatically.
export const FAQ_ITEMS = [
  {
    question: "Will customers know they're talking to AI?",
    answer:
      "Your agent sounds natural and professional — not robotic. We disclose it's an AI assistant when asked directly (our policy and best practice), and most callers are impressed, not put off. Your agent says 'I'm an AI assistant for [Your Business]' if asked. In practice, callers care more about getting their question answered than who's answering.",
  },
  {
    question: `What do I actually get?`,
    answer:
      `Every plan includes generous minutes, an agent trained on your trade and services, instant call notifications, and a weekly review that improves your agent from real calls. No per-minute billing — you pay a flat base rate starting at $${PLANS[0].monthly}/mo. Need more minutes? Reload packs are $${MINUTE_RELOAD.price} for ${MINUTE_RELOAD.minutes} extra minutes.`,
  },
  {
    question: 'How are you different from Dialzara, Rosie, or My AI Front Desk?',
    answer:
      `Three differences. First, pricing: they all charge per minute or per caller — your bill spikes when you're busy. We charge a flat rate starting at $${PLANS[0].monthly}/mo. Second, setup: they're self-serve platforms where you configure everything. We build your agent from your Google Business Profile and website during signup — you answer a few questions, we handle the rest. Third, specificity: your agent is trained on your trade, not a generic script. Booking and live call transfer are available on the ${PLANS[2].name} plan ($${PLANS[2].monthly}/mo).`,
  },
  {
    question: 'What does the $25 setup fee cover?',
    answer:
      `The ${SETUP.label} covers building your custom AI agent — trained on your specific trade, services, hours, and common questions. ${SETUP.description} You don't configure anything yourself.`,
  },
  {
    question: 'What if the agent says something wrong?',
    answer:
      "Your agent only answers questions using what we build into its knowledge base — your services, pricing, hours, policies. If a caller asks something outside that scope, it politely says it'll have you follow up directly. It never makes up information. Any gaps are flagged in your weekly review so you can fill them in.",
  },
  {
    question: 'Does it work after hours and on weekends?',
    answer:
      "That's the whole point. Your agent answers every call, 24/7/365 — including 2am emergencies, Christmas Day, and while you're elbow-deep in a job. You'll get an email summary by default, with Telegram available for faster alerts, so you can decide whether to call back immediately or in the morning.",
  },
  {
    question: 'How do I update what my agent knows?',
    answer:
      "Log into your dashboard and update your agent's knowledge base directly — add new pricing, new services, new FAQs, or change your hours. Your agent picks up the changes on the next call. You can also message us and we'll handle it within 24 hours.",
  },
  {
    question: 'What if I want to cancel?',
    answer:
      `${POLICIES.cancellation} No contracts, no cancellation fees. Your call logs stay in your dashboard — you keep your data either way. ${POLICIES.moneyBack}`,
  },
  {
    question: 'Will my customers see your phone number when they call?',
    answer:
      `No. Your customers still dial YOUR business number. Conditional call forwarding routes the call to us only when you don't pick up — they never see our number, and they never know the call was forwarded. The agent introduces itself with your business name, not ours.`,
  },
  {
    question: 'Will it work with my Rogers / Bell / Telus / Fido plan?',
    answer:
      `Yes — Canadian conditional call forwarding (star-61, star-67, star-62 codes) works on all major carriers and most sub-brands. One catch: your carrier voicemail must be fully removed first (not just toggled off). We walk you through this during setup — for most carriers it's a 5-minute call to support. iPhone users with Visual Voicemail need it removed too.`,
  },
  {
    question: 'What if I have a voicemail box on my plan right now?',
    answer:
      `Carrier voicemail and conditional call forwarding share the same network slot — whichever was activated last wins. You'll need to call your carrier (Rogers, Bell, Telus, Fido) and ask them to fully remove voicemail from your line profile. Not reset — removed. Then the forwarding codes work immediately. We give you the script and the carrier support number during setup.`,
  },
  {
    question: 'Where do my call recordings go? Is my data safe?',
    answer:
      `Recordings live in your dashboard, encrypted at rest (AES-256) and in transit (TLS). Only the End Voicemail founder has human access — no third parties listen, and ${POLICIES.dataNeverTrains.toLowerCase()} If you cancel, you can export everything or request deletion (PIPEDA right-to-erasure).`,
  },
  {
    question: `What if I subscribe and hate it?`,
    answer:
      `${POLICIES.moneyBack} Email Hasan directly (hasan@endvoicemail.ai), full refund processed within 48 hours. ${POLICIES.moneyBackFineprint} After day 30 of paid use, you can still cancel anytime from your dashboard — no notice period, no fees — but the 30-day guarantee window has passed.`,
  },
]
