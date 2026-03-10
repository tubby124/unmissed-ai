"use client";

import {
  Car, Flame, Wrench, Stethoscope, Scale, Scissors,
  Home, Building2, PhoneCall, Voicemail, HelpCircle, type LucideIcon,
} from "lucide-react";
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

const INBOUND_NICHES: Niche[] = [
  "auto_glass",
  "hvac",
  "plumbing",
  "dental",
  "legal",
  "salon",
  "real_estate",
  "property_management",
  "voicemail",
  "other",
];

const OUTBOUND_NICHES: Niche[] = [
  "outbound_isa_realtor",
];

function NicheButton({ niche, selected, onSelect }: { niche: Niche; selected: boolean; onSelect: () => void }) {
  const Icon = nicheIcons[niche];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer min-h-[56px]
        ${selected
          ? "border-indigo-600 bg-indigo-50 text-indigo-900"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700"
        }
      `}
    >
      <Icon className={`w-5 h-5 shrink-0 ${selected ? "text-indigo-600" : "text-gray-500"}`} />
      <span className="text-sm font-medium leading-tight">{nicheLabels[niche]}</span>
    </button>
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
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Receives calls
          </p>
          <div className="grid grid-cols-2 gap-3">
            {INBOUND_NICHES.map((niche) => (
              <NicheButton
                key={niche}
                niche={niche}
                selected={data.niche === niche}
                onSelect={() => onUpdate({ niche })}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Makes calls
          </p>
          <div className="grid grid-cols-2 gap-3">
            {OUTBOUND_NICHES.map((niche) => (
              <NicheButton
                key={niche}
                niche={niche}
                selected={data.niche === niche}
                onSelect={() => onUpdate({ niche })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
