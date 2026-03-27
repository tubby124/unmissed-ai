/**
 * Data definitions for niche landing pages.
 * Single source of truth — each for-{niche}/page.tsx imports its config from here.
 */

import type { LucideIcon } from "lucide-react";
import {
  Car, Zap, MapPin, Wrench, Clock, Phone, Shield,
  Home, Thermometer, Calendar,
  Droplets, AlertTriangle,
  Stethoscope, HeartPulse, ClipboardList,
  Scale, Users,
  DollarSign, BadgeCheck, Key,
} from "lucide-react";

export interface NicheStat {
  value: string;
  label: string;
  color: "primary" | "red" | "green";
}

export interface NicheCollectedItem {
  icon: LucideIcon;
  label: string;
}

export interface NicheDemoSection {
  /** "live" = green Live Agent box, "coming-soon" = amber Coming Soon box */
  type: "live" | "coming-soon";
  /** Text shown inside the demo box */
  text: string;
}

export interface NichePricingSection {
  headline: string;
  subtext: string;
}

export interface NichePageData {
  /** URL query param for /onboard?niche= */
  nicheParam: string;
  /** Lead card niche key */
  leadCardNiche: "auto-glass" | "hvac" | "plumbing" | "dental" | "legal" | "salon" | "realty";
  /** JSON-LD schema name + description */
  schema: { name: string; description: string };

  /** Hero section */
  hero: {
    subtitle: string;
    headline: string;
    body: string;
    tagline: string;
    ctaLabel: string;
    /** Optional extra line below tagline (e.g. social proof stat) */
    proofLine?: string;
    /** Secondary CTA — defaults to "/try" + "Try a Live Demo" */
    secondaryCta?: { href: string; label: string };
    /** Lead card preview label — defaults to standard text */
    leadCardLabel?: string;
  };

  /** 3 stat bar items */
  stats: [NicheStat, NicheStat, NicheStat];

  /** "What your agent collects" section */
  collected: {
    headline: string;
    subtext: string;
    items: NicheCollectedItem[];
  };

  /** Demo section */
  demo: NicheDemoSection;

  /** Pricing section */
  pricing: NichePricingSection;

  /** Final CTA */
  finalCta: {
    headline: string;
    ctaLabel: string;
  };

  /** Whether to show TryDemoPopup */
  showDemoPopup?: boolean;
}

// ─── Auto Glass ──────────────────────────────────────────────────────────────

export const AUTO_GLASS: NichePageData = {
  nicheParam: "auto_glass",
  leadCardNiche: "auto-glass",
  schema: {
    name: "Auto Glass Receptionist AI",
    description: "AI receptionist for auto glass shops. Answers inbound calls, collects vehicle details, damage description, and ADAS calibration requirements. Delivers structured lead cards via Telegram/SMS.",
  },
  hero: {
    subtitle: "For Auto Glass Shops",
    headline: "Stop losing windshield jobs to voicemail.",
    body: "You\u2019re mid-calibration. A customer calls about a cracked windshield on their 2024 F-150. Three rings. They hang up and call the next shop on Google. That\u2019s a $600 job gone — and you\u2019ll never know they called.",
    tagline: "You can\u2019t stop mid-install to answer. Your agent never lets a call go to voicemail.",
    ctaLabel: "Get My Auto Glass Agent \u2192",
  },
  stats: [
    { value: "$150\u2013$800", label: "Avg glass job value", color: "primary" },
    { value: "3 jobs/week", label: "Typical missed calls per shop", color: "red" },
    { value: "$93,600", label: "Estimated annual opportunity", color: "green" },
  ],
  collected: {
    headline: "Your agent collects everything you need to quote the job.",
    subtext: "You call back knowing the vehicle, the damage, and whether ADAS calibration is in play.",
    items: [
      { icon: Car, label: "Year, Make, Model" },
      { icon: Zap, label: "Damage type & size" },
      { icon: MapPin, label: "Damage location on glass" },
      { icon: Wrench, label: "ADAS calibration required?" },
      { icon: Clock, label: "Urgency (driving today?)" },
      { icon: Phone, label: "Caller name + callback number" },
      { icon: Shield, label: "Insurance or cash pay?" },
    ],
  },
  demo: {
    type: "live",
    text: "Talk to our auto glass AI agent right now \u2014 free, no sign-up:",
  },
  pricing: {
    headline: "One missed job pays for 6 months.",
    subtext: "At $400/avg job, a single captured lead covers your entire plan cost.",
  },
  finalCta: {
    headline: "Never lose a windshield job to voicemail again.",
    ctaLabel: "Get My Auto Glass Agent \u2192",
  },
  showDemoPopup: true,
};

// ─── HVAC ────────────────────────────────────────────────────────────────────

export const HVAC: NichePageData = {
  nicheParam: "hvac",
  leadCardNiche: "hvac",
  schema: {
    name: "HVAC Receptionist AI",
    description: "AI receptionist for HVAC companies. Answers inbound calls, handles heating and cooling emergencies, collects system details, and routes urgent service inquiries.",
  },
  hero: {
    subtitle: "For HVAC Companies",
    headline: "Stop losing service calls to voicemail.",
    body: "It\u2019s \u201330\u00B0C and a furnace goes out at 2 AM. The homeowner calls your company. Three rings. Voicemail. They call the next HVAC company on Google. That\u2019s a $500 emergency call \u2014 and the service contract behind it \u2014 gone.",
    tagline: "Emergency or not, your agent answers before they try the next HVAC company.",
    ctaLabel: "Get My HVAC Agent \u2192",
  },
  stats: [
    { value: "$200\u2013$800", label: "Avg service call value", color: "primary" },
    { value: "5+ calls/week", label: "Missed during peak season", color: "red" },
    { value: "$156,000", label: "Estimated annual opportunity", color: "green" },
  ],
  collected: {
    headline: "Your agent collects everything you need to dispatch the right tech.",
    subtext: "You call back knowing the system, the urgency, and whether it\u2019s an emergency dispatch or a booking.",
    items: [
      { icon: Home, label: "Heating or cooling issue?" },
      { icon: Thermometer, label: "System type (furnace, AC, heat pump)" },
      { icon: Clock, label: "How urgent? (no heat, uncomfortable, maintenance)" },
      { icon: Calendar, label: "Preferred service window" },
      { icon: MapPin, label: "Service address" },
      { icon: Phone, label: "Caller name + callback" },
      { icon: Wrench, label: "System age if known" },
    ],
  },
  demo: {
    type: "coming-soon",
    text: "HVAC demo launching soon \u2014 try our live agents in the meantime:",
  },
  pricing: {
    headline: "One missed service call pays for 6 months.",
    subtext: "At $500/avg job, a single captured lead covers your entire plan cost.",
  },
  finalCta: {
    headline: "Never lose a service call to voicemail again.",
    ctaLabel: "Get My HVAC Agent \u2192",
  },
  showDemoPopup: true,
};

// ─── Plumbing ────────────────────────────────────────────────────────────────

export const PLUMBING: NichePageData = {
  nicheParam: "plumbing",
  leadCardNiche: "plumbing",
  schema: {
    name: "Plumbing Receptionist AI",
    description: "AI receptionist for plumbing companies. Triages emergency calls, collects issue details, and delivers structured lead cards.",
  },
  hero: {
    subtitle: "For Plumbers",
    headline: "Stop losing emergency jobs to voicemail.",
    body: "A pipe bursts at midnight. The homeowner is panicking, water everywhere, shut-off valve location unknown. They call your company. Voicemail. They call the next plumber on Google and someone else gets the job. Emergency calls pay double. Your agent catches every one.",
    tagline: "A burst pipe at midnight can\u2019t wait for voicemail. Your agent is always there.",
    ctaLabel: "Get My Plumbing Agent \u2192",
  },
  stats: [
    { value: "$200\u2013$600", label: "Avg service call value", color: "primary" },
    { value: "4 calls/week", label: "Missed after hours", color: "red" },
    { value: "$124,800", label: "Estimated annual opportunity", color: "green" },
  ],
  collected: {
    headline: "Your agent captures what you\u2019d need to dispatch \u2014 before you pick up the phone.",
    subtext: "You call back knowing the issue, the urgency, and whether it needs same-day response.",
    items: [
      { icon: Droplets, label: "Type of issue (leak, clog, water heater, sewer)" },
      { icon: AlertTriangle, label: "Emergency level (flooding, no water, can wait)" },
      { icon: Home, label: "Residential or commercial?" },
      { icon: MapPin, label: "Service address" },
      { icon: Calendar, label: "Preferred timing" },
      { icon: Phone, label: "Caller name + callback" },
      { icon: Wrench, label: "Anything they\u2019ve already tried" },
    ],
  },
  demo: {
    type: "coming-soon",
    text: "Plumbing demo launching soon \u2014 try our live agents in the meantime:",
  },
  pricing: {
    headline: "One missed emergency pays for 6 months.",
    subtext: "At $400/avg job, a single captured lead covers your entire plan cost.",
  },
  finalCta: {
    headline: "Never lose a plumbing job to voicemail again.",
    ctaLabel: "Get My Plumbing Agent \u2192",
  },
  showDemoPopup: true,
};

// ─── Dental ──────────────────────────────────────────────────────────────────

export const DENTAL: NichePageData = {
  nicheParam: "dental",
  leadCardNiche: "dental",
  schema: {
    name: "Dental Office Receptionist AI",
    description: "AI receptionist for dental offices. Answers calls, screens new patients, collects insurance info, and captures appointment preferences.",
  },
  hero: {
    subtitle: "For Dental Offices",
    headline: "Stop losing new patients to voicemail.",
    body: "A patient has a toothache at 8 PM. They call your office. Voicemail. They call the next dentist on Google and book there instead. That\u2019s not just a lost appointment \u2014 it\u2019s the cleaning, the crown, the X-rays, and every visit for the next decade. Gone because nobody picked up.",
    tagline: "After-hours patients call once. Your agent makes sure it counts.",
    ctaLabel: "Get My Dental Agent \u2192",
  },
  stats: [
    { value: "$800\u2013$2,000", label: "Avg new patient lifetime value", color: "primary" },
    { value: "8+ calls/week", label: "Missed outside office hours", color: "red" },
    { value: "$332,800", label: "Estimated annual opportunity", color: "green" },
  ],
  collected: {
    headline: "Your agent captures what your front desk would \u2014 even after hours.",
    subtext: "You arrive Monday knowing who called, what they needed, and who to book first thing.",
    items: [
      { icon: Stethoscope, label: "New or existing patient?" },
      { icon: HeartPulse, label: "Reason for call (pain, cleaning, cosmetic, emergency)" },
      { icon: Clock, label: "Urgency level" },
      { icon: Shield, label: "Insurance provider" },
      { icon: Calendar, label: "Preferred appointment time" },
      { icon: Phone, label: "Patient name + callback" },
      { icon: ClipboardList, label: "Any relevant medical notes" },
    ],
  },
  demo: {
    type: "coming-soon",
    text: "Dental demo launching soon \u2014 try our live agents in the meantime:",
  },
  pricing: {
    headline: "One new patient pays for a full year.",
    subtext: "At $800+ lifetime value, a single captured patient covers your entire plan cost.",
  },
  finalCta: {
    headline: "Never lose a new patient to voicemail again.",
    ctaLabel: "Get My Dental Agent \u2192",
  },
  showDemoPopup: true,
};

// ─── Legal ───────────────────────────────────────────────────────────────────

export const LEGAL: NichePageData = {
  nicheParam: "legal",
  leadCardNiche: "legal",
  schema: {
    name: "Law Firm Receptionist AI",
    description: "AI receptionist for law firms. Screens potential clients, collects case type and details, and delivers structured intake cards.",
  },
  hero: {
    subtitle: "For Law Firms",
    headline: "Stop losing clients to voicemail.",
    body: "Someone just got in a car accident. They need a personal injury lawyer now. They call your firm at 6 PM. Voicemail. They call the next firm on Google. That\u2019s a $3,000\u2013$10,000 retainer gone \u2014 to a firm that simply picked up.",
    tagline: "Clients call in crisis. Your agent makes sure they reach someone.",
    ctaLabel: "Get My Law Firm Agent \u2192",
  },
  stats: [
    { value: "$3,000\u2013$10,000", label: "Avg retainer value", color: "primary" },
    { value: "6+ calls/week", label: "Missed after hours", color: "red" },
    { value: "$936,000", label: "Estimated annual opportunity", color: "green" },
  ],
  collected: {
    headline: "Your agent collects everything you need to qualify the lead.",
    subtext: "You call back knowing the practice area, urgency, and whether they\u2019re ready to retain.",
    items: [
      { icon: Scale, label: "Area of law (PI, family, criminal, business, real estate)" },
      { icon: ClipboardList, label: "Brief case description" },
      { icon: Clock, label: "Urgency (active case, deadline, general inquiry)" },
      { icon: Calendar, label: "Consultation preference" },
      { icon: Phone, label: "Caller name + callback" },
      { icon: Users, label: "Have they spoken to other firms?" },
      { icon: MapPin, label: "Jurisdiction / location" },
    ],
  },
  demo: {
    type: "coming-soon",
    text: "Legal demo launching soon \u2014 try our live agents in the meantime:",
  },
  pricing: {
    headline: "One signed client pays for years of service.",
    subtext: "At $3,000+ per retainer, a single captured lead covers your entire plan cost many times over.",
  },
  finalCta: {
    headline: "Never lose a client to voicemail again.",
    ctaLabel: "Get My Law Firm Agent \u2192",
  },
  showDemoPopup: true,
};

// ─── Real Estate ─────────────────────────────────────────────────────────────

export const REALTY: NichePageData = {
  nicheParam: "realty",
  leadCardNiche: "realty",
  schema: {
    name: "Real Estate AI Receptionist",
    description: "AI receptionist and lead qualification service for real estate agents. Handles inbound buyer and seller inquiries, qualifies leads by budget, timeline, and pre-approval status, and delivers structured lead cards via Telegram/SMS.",
  },
  hero: {
    subtitle: "For Real Estate Agents",
    headline: "Your AI that handles calls while you show properties.",
    body: "You\u2019re in the middle of a showing. Your phone rings \u2014 a buyer saw your sign, wants to book a viewing, has a pre-approval, timeline is next month. You can\u2019t stop. They call the next agent on the listing. By the time the showing wraps, they\u2019ve already booked a tour somewhere else.",
    tagline: "Your AI agent qualifies every inquiry \u2014 even at 11pm.",
    ctaLabel: "Get My Realtor Agent \u2192",
    secondaryCta: { href: "/demo", label: "Hear a Demo Call \u2192" },
    leadCardLabel: "This hits your Telegram within seconds of every inquiry:",
  },
  stats: [
    { value: "2,082+", label: "Calls handled for one BC agent", color: "primary" },
    { value: "$12,000+", label: "Avg deal commission", color: "red" },
    { value: "24/7", label: "Coverage \u2014 even on showings", color: "green" },
  ],
  collected: {
    headline: "Pre-qualified leads waiting in your Telegram.",
    subtext: "By the time you call back, you already know their budget, timeline, and readiness.",
    items: [
      { icon: Home, label: "Buying or selling?" },
      { icon: DollarSign, label: "Budget range" },
      { icon: BadgeCheck, label: "Pre-approved?" },
      { icon: Calendar, label: "Timeline to move" },
      { icon: MapPin, label: "Preferred area" },
      { icon: Phone, label: "Name + callback number" },
      { icon: Key, label: "Bedrooms / property type" },
    ],
  },
  demo: {
    type: "live",
    text: "Talk to our real estate AI agent right now \u2014 free, no sign-up:",
  },
  pricing: {
    headline: "One qualified lead pays for a year.",
    subtext: "At $12,000+ avg commission, the math is obvious.",
  },
  finalCta: {
    headline: "Never miss a buyer inquiry again.",
    ctaLabel: "Get My Realtor Agent \u2192",
  },
  showDemoPopup: false,
};
