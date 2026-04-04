"use client";

import { Label } from "@/components/ui/label";
import ChipSelector from "@/components/onboard/ChipSelector";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

const INSURANCE_OPTIONS = [
  { value: "all_major", label: "All major insurance" },
  { value: "private_pay", label: "Private pay only" },
  { value: "pending", label: "Working on insurance approval" },
  { value: "other", label: "Other" },
];

const MOBILE_OPTIONS = [
  { value: "no", label: "Shop only" },
  { value: "yes", label: "We come to you" },
  { value: "emergency_only", label: "Emergency only" },
];

const SERVICES = [
  { value: "chip_repair", label: "Chip repair" },
  { value: "full_replacement", label: "Full replacement" },
  { value: "side_rear_glass", label: "Side & rear glass" },
  { value: "adas_calibration", label: "ADAS calibration" },
  { value: "window_tinting", label: "Window tinting" },
  { value: "sunroof", label: "Sunroof / moonroof" },
  { value: "rv_glass", label: "RV glass" },
  { value: "commercial_fleet", label: "Commercial / fleet" },
];

const EXCLUDED_SERVICES = [
  { value: "no_rv", label: "No RV glass" },
  { value: "no_large_crack", label: "No cracks > 6 inches" },
  { value: "no_fleet", label: "No fleet accounts" },
  { value: "no_tinting", label: "No tinting" },
  { value: "no_adas", label: "No ADAS calibration" },
];

export default function AutoGlassNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const selectedServices = (answers.services as string[]) || [];
  const excludedServices = (answers.excludedServices as string[]) || [];
  const insurance = (answers.insurance as string) || "";
  const mobileService = (answers.mobileService as string) || "";

  return (
    <div className="space-y-6">
      {/* Insurance */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Do you accept insurance claims?</Label>
        <ChipSelector
          options={INSURANCE_OPTIONS}
          value={insurance}
          onChange={(val) => onChange("insurance", val)}
        />
      </div>

      {/* Mobile service */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Mobile / on-site service?</Label>
        <ChipSelector
          options={MOBILE_OPTIONS}
          value={mobileService}
          onChange={(val) => onChange("mobileService", val)}
        />
      </div>

      {/* Services offered */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Services offered <span className="text-gray-400 font-normal">(select all)</span>
        </Label>
        <ChipSelector
          multi
          options={SERVICES}
          value={selectedServices}
          onChange={(val) => onChange("services", val)}
        />
      </div>

      {/* Services NOT offered */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Services you do <span className="italic">not</span> offer{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <ChipSelector
          multi
          options={EXCLUDED_SERVICES}
          value={excludedServices}
          onChange={(val) => onChange("excludedServices", val)}
        />
      </div>
    </div>
  );
}
