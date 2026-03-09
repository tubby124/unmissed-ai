"use client";

import { Niche, nicheLabels, nicheEmojis, OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const INBOUND_NICHES: Niche[] = [
  "auto_glass",
  "hvac",
  "plumbing",
  "dental",
  "legal",
  "salon",
  "real_estate",
  "property_management",
  "other",
];

const OUTBOUND_NICHES: Niche[] = [
  "outbound_isa_realtor",
];

function NicheButton({ niche, selected, onSelect }: { niche: Niche; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all
        ${selected
          ? "border-blue-600 bg-blue-50 text-blue-900"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700"
        }
      `}
    >
      <span className="text-2xl">{nicheEmojis[niche]}</span>
      <span className="text-sm font-medium leading-tight">{nicheLabels[niche]}</span>
    </button>
  );
}

export default function Step1({ data, onUpdate }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">What type of business are you?</h2>
        <p className="text-sm text-gray-500 mt-1">
          Your agent will be customized with industry-specific knowledge for your niche.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Inbound — receives calls
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
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Outbound — makes calls
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
