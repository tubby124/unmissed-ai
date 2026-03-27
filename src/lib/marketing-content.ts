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
  eyebrow: 'AI Receptionist for Service Businesses',
  headline: ['Every call answered.', 'Every lead captured.', 'Even at 2am.'],
  /** Highlighted portion of the last headline line (rendered in primary color) */
  headlineAccent: 'Even at 2am.',
  subtitle:
    "62% of service businesses miss calls daily. 85% of those callers won't call back. That's a $400 job — gone to whoever picked up.",
  ctaLabel: "Hear it yourself — we'll call you in 10 seconds:",
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
  toastTitle: 'HOT lead — Tyler captured it',
  toastSubtitle: 'Windshield chip · ready to book',
}

// ─── Trust Bar ───────────────────────────────────────────────────────
export const TRUST_BAR = {
  label: 'Trusted by service businesses across Canada',
  stats: [
    { icon: Phone as LucideIcon, value: '8,400+', label: 'Calls handled', delay: 0 },
    { icon: Users as LucideIcon, value: '2,100+', label: 'Leads captured', delay: 0.1 },
    { icon: Zap as LucideIcon, value: '<1s', label: 'Answer time', delay: 0.2 },
    { icon: Clock as LucideIcon, value: '24/7', label: 'Always on', delay: 0.3 },
  ],
}

// ─── Demo Section (DemoAudioPlayer) ─────────────────────────────────
export const DEMO_SECTION = {
  eyebrow: 'Live Demo',
  headline: 'See it in action.',
  subheadline: 'Real conversations your AI receptionist handles — every call captured, every lead saved.',
  ctaLabel: 'Talk to an AI Agent Live',
  ctaHref: '/try',
  ctaSubtext: 'No sign-up needed · Uses your microphone · 5-minute demo',
}

// ─── How It Works ────────────────────────────────────────────────────
export const HOW_IT_WORKS = {
  eyebrow: 'How It Works',
  headline: 'Four steps. Zero work on your end.',
  subheadline: 'We set it all up. You just get the leads.',
  /** Shown below the steps grid */
  proofLine: '8,400+ calls handled · 24/7 coverage · Agent live within 24 hours',
  steps: [
    {
      number: '01',
      icon: PhoneIncoming as LucideIcon,
      title: 'Customer calls your number',
      description:
        'Your existing business number (or a new one) forwards to your AI agent. Zero downtime, zero configuration by you.',
    },
    {
      number: '02',
      icon: Bot as LucideIcon,
      title: 'AI agent answers — every time',
      description:
        'Your agent knows your business, your services, your pricing. It speaks naturally, collects the caller\'s info, and qualifies the lead.',
    },
    {
      number: '03',
      icon: BellRing as LucideIcon,
      title: 'You get an instant alert',
      description:
        'A structured lead card hits your Telegram or SMS within seconds: caller name, number, what they need, and how hot the lead is.',
    },
    {
      number: '04',
      icon: CircleCheck as LucideIcon,
      title: 'You call back only warm leads',
      description:
        'No more chasing cold voicemails. You see the full context before you dial. Close the job, not the guesswork.',
    },
  ],
}

// ─── Pricing Section (homepage inline) ───────────────────────────────
export const PRICING_SECTION = {
  eyebrow: 'Pricing',
  headline: 'Simple, honest pricing.',
  subheadline: 'No per-minute charges. Simple, predictable pricing.',
  fullPricingLinkText: 'See full pricing details and feature comparison →',
}

// ─── Final CTA (homepage) ────────────────────────────────────────────
export const FINAL_CTA = {
  headline: 'Stop leaving money on the table.',
  subheadline: 'Every call you miss is a job that went to someone who picked up.',
  signupLinkText: 'Or sign up and build your agent →',
}

// ─── FAQ ─────────────────────────────────────────────────────────────
// Uses PLANS, SETUP, MINUTE_RELOAD, POLICIES from pricing.ts — edit prices there,
// answers here update automatically.
export const FAQ_ITEMS = [
  {
    question: "Will customers know they're talking to AI?",
    answer:
      "Your agent sounds natural and professional — not robotic. We disclose it's an AI assistant when asked directly (required by law and good practice), but most callers are impressed, not put off. Your agent says 'I'm an AI assistant for [Your Business]' if asked. In practice, callers care more about getting their question answered than who's answering.",
  },
  {
    question: `What makes ${BRAND_NAME} worth it?`,
    answer:
      `Every plan includes generous minutes, niche-specific AI prompts, instant notifications, and our Learning Loop that improves your agent from real calls every week. There's no per-minute billing — you pay a flat rate starting at $${PLANS[0].monthly}/mo and know exactly what your bill will be. Need more minutes? Reload packs are just $${MINUTE_RELOAD.price} for ${MINUTE_RELOAD.minutes} minutes.`,
  },
  {
    question: 'How are you different from Dialzara, Rosie, or My AI Front Desk?',
    answer:
      `Three ways. First, pricing: they all charge per minute or per caller — your bill spikes when you're busy. We charge a flat rate per plan starting at $${PLANS[0].monthly}/mo. Second, setup: they're self-serve platforms where you configure everything yourself. We build your agent for you with industry-specific scripts tested on real calls. Third, depth: each plan includes generous minutes and core AI features. Booking, live transfer, and advanced features are available on Core ($${PLANS[1].monthly}/mo) and Pro ($${PLANS[2].monthly}/mo) plans.`,
  },
  {
    question: 'What does the $25 setup fee cover?',
    answer:
      `The ${SETUP.label} covers building your custom AI agent — we tune it to your specific business, niche, hours, and services. It includes ${SETUP.includes}. You don't configure anything yourself — we handle it all and have your agent live within 48 hours.`,
  },
  {
    question: 'What if the agent says something wrong?',
    answer:
      "Your agent only answers questions using what we program into its knowledge base — your services, pricing, hours, policies. If a caller asks something outside that scope, it politely says it'll have you follow up directly. It never makes up information. And through The Learning Loop, any knowledge gaps are flagged weekly so you can add to it.",
  },
  {
    question: 'Does it work after hours and on weekends?',
    answer:
      "That's the whole point. Your agent answers every call, 24/7/365 — including 2am emergencies, Christmas Day, and while you're elbow-deep in a job. You'll get an instant Telegram or SMS notification so you can decide whether to call back immediately or in the morning.",
  },
  {
    question: 'How do I update what my agent knows?',
    answer:
      "Log into your dashboard and update your agent's knowledge base directly — add new pricing, new services, new FAQs, or change your hours. Changes take effect immediately. You can also message us and we'll handle it within 24 hours. Either way, your agent stays current.",
  },
  {
    question: 'What if I want to cancel?',
    answer:
      `${POLICIES.cancellation} No contracts, no cancellation fees. Your call logs stay in your dashboard, so you keep your data either way. We're confident you won't want to cancel once you see the leads you were missing.`,
  },
]
