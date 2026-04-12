"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  Car, Flame, Wrench, Stethoscope, Scale, Scissors,
  Home, Building2, PhoneCall, Voicemail, HelpCircle,
  UtensilsCrossed, Printer, Settings, Bug, Zap, KeyRound, type LucideIcon,
} from "lucide-react";
import { OnboardingData } from "@/types/onboarding";
import { type Niche, nicheLabels, defaultAgentNames, getNicheHexColor, nicheShortLabels } from "@/lib/niche-registry";

const nicheIcons: Record<Niche, LucideIcon> = {
  auto_glass: Car,
  hvac: Flame,
  plumbing: Wrench,
  dental: Stethoscope,
  legal: Scale,
  salon: Scissors,
  real_estate: Home,
  property_management: Building2,
  outbound_isa_realtor: PhoneCall,
  voicemail: Voicemail,
  restaurant: UtensilsCrossed,
  print_shop: Printer,
  mechanic_shop: Settings,
  pest_control: Bug,
  electrician: Zap,
  locksmith: KeyRound,
  barbershop: Scissors,
  other: HelpCircle,
};


interface Props {
  data: OnboardingData;
  currentStep: number;
  stepIndex: number; // 0-based position in sequence
}

/**
 * Progressive "Agent Being Built" card shown above step content from step 2 onward.
 * Hides on step 6 (review) where the orb hero takes over.
 * Each data field animates in as it becomes available.
 */
export default function AgentBuildCard({ data, currentStep, stepIndex }: Props) {
  // Only show from step 2 onward; hide on review
  if (stepIndex < 1 || currentStep === 6) return null;

  const niche = data.niche;
  if (!niche) return null;

  const NicheIcon = nicheIcons[niche];
  const nicheColor = getNicheHexColor(niche);
  const nicheLabel = nicheShortLabels[niche] ?? nicheLabels[niche];
  const agentName = data.agentName || (defaultAgentNames[niche] ?? "Sam");
  const hasBusinessName = !!data.businessName;
  const hasVoice = !!data.voiceName && stepIndex >= 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-xl border border-border bg-card/60 p-3.5 mb-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2.5">
        Building your agent
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Niche chip */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-white shrink-0"
          style={{ backgroundColor: nicheColor }}
        >
          <NicheIcon className="w-3 h-3" />
          {nicheLabel}
        </motion.div>

        {/* Business name or pulse placeholder */}
        <AnimatePresence mode="wait">
          {hasBusinessName ? (
            <motion.div
              key="biz-filled"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {data.businessName}
            </motion.div>
          ) : (
            <motion.div
              key="biz-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-4 w-28 rounded bg-muted/70 animate-pulse"
            />
          )}
        </AnimatePresence>

        {/* Voice + agent name — visible once step 2 data is set (stepIndex ≥ 2) */}
        <AnimatePresence>
          {hasVoice ? (
            <motion.div
              key="voice-filled"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <svg className="w-3.5 h-3.5 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {data.voiceName} · {agentName}
            </motion.div>
          ) : stepIndex >= 2 ? (
            <motion.div
              key="voice-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-4 w-20 rounded bg-muted/70 animate-pulse"
            />
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
