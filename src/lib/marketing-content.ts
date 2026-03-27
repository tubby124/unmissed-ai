/**
 * MARKETING CONTENT — unmissed.ai
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

import { Phone, Users, Zap, Clock } from 'lucide-react'
import { PhoneIncoming, Bot, BellRing, CircleCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PLANS, SETUP, MINUTE_RELOAD, POLICIES } from './pricing'
import { BRAND_NAME } from './brand'

// ─── Hero ────────────────────────────────────────────────────────────
export const HERO = {
  eyebrow: '$29/mo · Built for service businesses that can\'t afford to miss calls',
  headline: ['They called.', 'You didn\'t answer.', 'We fix that.'],
  /** Highlighted portion of the last headline line (rendered in primary color) */
  headlineAccent: 'We fix that.',
  subtitle:
    "85% of callers who reach voicemail don't call back. That's a $400 job — gone to whoever picked up. We make sure you're whoever picked up.",
  ctaLabel: "Hear your agent answer — we'll call you now:",
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
  label: 'Trusted by service businesses across Canada',
  stats: [
    { icon: Phone as LucideIcon, value: '8,400+', label: 'Calls answered', delay: 0 },
    { icon: Users as LucideIcon, value: '2,100+', label: 'Jobs captured', delay: 0.1 },
    { icon: Zap as LucideIcon, value: '<1s', label: 'Answer time', delay: 0.2 },
    { icon: Clock as LucideIcon, value: '24/7', label: 'Always on', delay: 0.3 },
  ],
}

// ─── Demo Section (DemoAudioPlayer) ─────────────────────────────────
export const DEMO_SECTION = {
  eyebrow: 'Live Demo',
  headline: 'Hear it answer.',
  subheadline: 'Real calls your AI agent handles — every caller greeted, every job captured.',
  ctaLabel: 'Talk to an AI Agent Live',
  ctaHref: '/try',
  ctaSubtext: 'Free · No sign-up · Browser-based demo',
}

// ─── How It Works ────────────────────────────────────────────────────
export const HOW_IT_WORKS = {
  eyebrow: 'How It Works',
  headline: 'Four steps. No setup work on your end.',
  subheadline: 'Your agent is built during signup. You just forward your calls.',
  /** Shown below the steps grid */
  proofLine: '8,400+ calls answered · 24/7 coverage · Built from your business info during signup',
  steps: [
    {
      number: '01',
      icon: PhoneIncoming as LucideIcon,
      title: 'Your number forwards to your agent',
      description:
        'Your existing business number forwards to your AI agent. Takes two minutes. No downtime, no new number required.',
    },
    {
      number: '02',
      icon: Bot as LucideIcon,
      title: 'Agent answers — every time',
      description:
        'Your agent knows your trade, your services, your hours. It speaks naturally, captures the caller\'s info, and understands what they need.',
    },
    {
      number: '03',
      icon: BellRing as LucideIcon,
      title: 'You get the message instantly',
      description:
        'A full call summary hits your Telegram or SMS within seconds: caller name, number, what they need, and who to call back first.',
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
  headline: '$29/mo. Agent live before your first call.',
  subheadline: 'Flat monthly plans with generous included minutes. No surprise per-minute billing — optional reload packs available when you need more.',
  fullPricingLinkText: 'See full pricing details and feature comparison →',
}

// ─── Final CTA (homepage) ────────────────────────────────────────────
export const FINAL_CTA = {
  headline: 'The next missed call is a job you won\'t get back.',
  subheadline: 'Every unanswered call goes to whoever picked up. Make sure that\'s you.',
  signupLinkText: 'Or sign up and get your agent live →',
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
      "That's the whole point. Your agent answers every call, 24/7/365 — including 2am emergencies, Christmas Day, and while you're elbow-deep in a job. You'll get an instant Telegram or SMS notification so you can decide whether to call back immediately or in the morning.",
  },
  {
    question: 'How do I update what my agent knows?',
    answer:
      "Log into your dashboard and update your agent's knowledge base directly — add new pricing, new services, new FAQs, or change your hours. Your agent picks up the changes on the next call. You can also message us and we'll handle it within 24 hours.",
  },
  {
    question: 'What if I want to cancel?',
    answer:
      `${POLICIES.cancellation} No contracts, no cancellation fees. Your call logs stay in your dashboard — you keep your data either way. We're confident you won't want to cancel once you see the jobs you were missing.`,
  },
]
