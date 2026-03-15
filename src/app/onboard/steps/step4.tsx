"use client";

import { OnboardingData } from "@/types/onboarding";
import AutoGlassNiche from "./niches/auto-glass";
import HvacNiche from "./niches/hvac";
import PlumbingNiche from "./niches/plumbing";
import DentalNiche from "./niches/dental";
import LegalNiche from "./niches/legal";
import SalonNiche from "./niches/salon";
import RealEstateNiche from "./niches/real-estate";
import PropertyManagementNiche from "./niches/property-management";
import OutboundIsaRealtorNiche from "./niches/outbound-isa-realtor";
import VoicemailNiche from "./niches/voicemail";
import RestaurantNiche from "./niches/restaurant";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

// NICHE REGISTRY: add new niches here + create niches/[name].tsx
const NICHE_COMPONENTS = {
  auto_glass: AutoGlassNiche,
  hvac: HvacNiche,
  plumbing: PlumbingNiche,
  dental: DentalNiche,
  legal: LegalNiche,
  salon: SalonNiche,
  real_estate: RealEstateNiche,
  property_management: PropertyManagementNiche,
  outbound_isa_realtor: OutboundIsaRealtorNiche,
  voicemail: VoicemailNiche,
  restaurant: RestaurantNiche,
} as const;

export default function Step4({ data, onUpdate }: Props) {
  const niche = data.niche;

  const handleNicheChange = (key: string, value: string | string[] | boolean) => {
    onUpdate({
      nicheAnswers: { ...data.nicheAnswers, [key]: value },
    });
  };

  if (!niche) {
    return (
      <div className="text-center py-8 text-gray-400">
        Please go back and select your industry first.
      </div>
    );
  }

  const NicheComponent = niche in NICHE_COMPONENTS
    ? NICHE_COMPONENTS[niche as keyof typeof NICHE_COMPONENTS]
    : null;

  if (!NicheComponent) {
    // Fallback for "other" — generic questions
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tell us about your services</h2>
          <p className="text-sm text-gray-500 mt-1">
            We&apos;ll use this to customize what your agent knows.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            What are the main services or inquiries your agent should handle?
          </label>
          <textarea
            className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="e.g. Property listings, buyer consultations, rental inquiries, open house schedules..."
            value={(data.nicheAnswers.generalServices as string) || ""}
            onChange={(e) => handleNicheChange("generalServices", e.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Your services</h2>
        <p className="text-sm text-slate-500 mt-1">
          These help your agent give accurate answers to callers.
        </p>
      </div>
      <NicheComponent data={data} onChange={handleNicheChange} />
    </div>
  );
}
