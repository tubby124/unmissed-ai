"use client";

import {
  Car, Flame, Wrench, Stethoscope, Scale, Scissors,
  Home, Building2, PhoneCall, Voicemail, HelpCircle, Sparkles, type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { Niche, nicheLabels, OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

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
  other: HelpCircle,
};

// Fully built and ready to use
const LIVE_NICHES: Niche[] = ["real_estate"];

// Available but still in beta
const BETA_NICHES: Niche[] = ["voicemail"];

const INBOUND_NICHES: Niche[] = [
  "auto_glass",
  "hvac",
  "plumbing",
  "dental",
  "legal",
  "salon",
  "property_management",
  "other",
];

const OUTBOUND_NICHES: Niche[] = [
  "outbound_isa_realtor",
];

function LiveNicheButton({ niche, selected, onSelect }: { niche: Niche; selected: boolean; onSelect: () => void }) {
  const Icon = nicheIcons[niche];
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      animate={selected ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`
        relative w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer min-h-[64px]
        ${selected
          ? "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-md shadow-indigo-100"
          : "border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-500 text-gray-800"
        }
      `}
    >
      <Icon className={`w-5 h-5 shrink-0 ${selected ? "text-indigo-600" : "text-emerald-600"}`} />
      <span className="text-sm font-semibold leading-tight flex items-center gap-1.5">
        {nicheLabels[niche]}
        <Sparkles className={`w-3.5 h-3.5 ${selected ? "text-indigo-400" : "text-emerald-500"}`} />
      </span>

      {/* Live badge */}
      <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-full px-2 py-0.5 shrink-0">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        Live
      </span>
    </motion.button>
  );
}

function BetaNicheButton({ niche, selected, onSelect }: { niche: Niche; selected: boolean; onSelect: () => void }) {
  const Icon = nicheIcons[niche];
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      animate={selected ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`
        relative w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer min-h-[64px]
        ${selected
          ? "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-md shadow-indigo-100"
          : "border-amber-300 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-400 text-gray-800"
        }
      `}
    >
      <Icon className={`w-5 h-5 shrink-0 ${selected ? "text-indigo-600" : "text-amber-600"}`} />
      <span className="text-sm font-semibold leading-tight">
        {nicheLabels[niche]}
      </span>

      {/* Beta badge */}
      <span className="ml-auto text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-2 py-0.5 shrink-0">
        Beta
      </span>
    </motion.button>
  );
}

function ComingSoonButton({ niche }: { niche: Niche }) {
  const Icon = nicheIcons[niche];
  return (
    <div
      className="relative flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-left min-h-[56px] opacity-45 cursor-not-allowed select-none"
    >
      <Icon className="w-5 h-5 shrink-0 text-gray-400" />
      <span className="text-sm font-medium text-gray-400 leading-tight">{nicheLabels[niche]}</span>
      <span className="ml-auto text-[10px] font-semibold text-gray-400 bg-gray-200 rounded-full px-2 py-0.5 shrink-0">
        Soon
      </span>
    </div>
  );
}

export default function Step1({ data, onUpdate }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">What type of business are you?</h2>
        <p className="text-sm text-slate-500 mt-1">
          Your agent will be customized with industry-specific knowledge.
        </p>
      </div>

      <div className="space-y-5">
        {/* Live niches — full width, prominent */}
        <div>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-3">
            Available now
          </p>
          <div className="flex flex-col gap-3">
            {LIVE_NICHES.map((niche) => (
              <LiveNicheButton
                key={niche}
                niche={niche}
                selected={data.niche === niche}
                onSelect={() => onUpdate({ niche })}
              />
            ))}
          </div>
        </div>

        {/* Beta niches */}
        <div>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-3">
            In beta — available now
          </p>
          <div className="flex flex-col gap-3">
            {BETA_NICHES.map((niche) => (
              <BetaNicheButton
                key={niche}
                niche={niche}
                selected={data.niche === niche}
                onSelect={() => onUpdate({ niche })}
              />
            ))}
          </div>
        </div>

        {/* Coming soon — inbound */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Coming soon — receives calls
          </p>
          <div className="grid grid-cols-2 gap-3">
            {INBOUND_NICHES.map((niche) => (
              <ComingSoonButton key={niche} niche={niche} />
            ))}
          </div>
        </div>

        {/* Coming soon — outbound */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Coming soon — makes calls
          </p>
          <div className="grid grid-cols-2 gap-3">
            {OUTBOUND_NICHES.map((niche) => (
              <ComingSoonButton key={niche} niche={niche} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
