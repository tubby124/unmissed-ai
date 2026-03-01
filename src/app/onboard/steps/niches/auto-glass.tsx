"use client";

import { Label } from "@/components/ui/label";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

const INSURANCE_OPTIONS = [
  { value: "all_major", label: "All major insurance — we handle billing directly" },
  { value: "private_pay", label: "Private pay only — we give receipts for claims" },
  { value: "pending", label: "Private pay for now — working on insurance approval" },
  { value: "other", label: "Other (explain below)" },
];

const SERVICES = [
  { value: "chip_repair", label: "Windshield chip repair" },
  { value: "full_replacement", label: "Windshield full replacement" },
  { value: "side_rear_glass", label: "Side & rear glass" },
  { value: "adas_calibration", label: "ADAS camera calibration" },
  { value: "window_tinting", label: "Window tinting" },
  { value: "sunroof", label: "Sunroof / moonroof" },
  { value: "rv_glass", label: "RV / motorhome glass" },
  { value: "commercial_fleet", label: "Commercial / fleet vehicles" },
];

export default function AutoGlassNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const selectedServices = (answers.services as string[]) || [];
  const insurance = (answers.insurance as string) || "";
  const mobileService = (answers.mobileService as string) || "no";

  const toggleService = (val: string) => {
    const updated = selectedServices.includes(val)
      ? selectedServices.filter((s) => s !== val)
      : [...selectedServices, val];
    onChange("services", updated);
  };

  return (
    <div className="space-y-6">
      {/* Insurance */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Do you accept insurance claims?</Label>
        <div className="space-y-2">
          {INSURANCE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="insurance"
                value={opt.value}
                checked={insurance === opt.value}
                onChange={() => onChange("insurance", opt.value)}
                className="mt-0.5 accent-blue-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Mobile service */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Do you offer mobile / on-site service?</Label>
        <div className="space-y-2">
          {[
            { value: "no", label: "No — customer comes to our shop" },
            { value: "yes", label: "Yes — we come to the customer" },
            { value: "emergency_only", label: "Emergency only (e.g. stuck on highway)" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="mobileService"
                value={opt.value}
                checked={mobileService === opt.value}
                onChange={() => onChange("mobileService", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Services */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">What services do you offer? <span className="text-gray-400 font-normal">(select all that apply)</span></Label>
        <div className="grid grid-cols-2 gap-2">
          {SERVICES.map((svc) => (
            <label key={svc.value} className="flex items-center gap-2 cursor-pointer group p-2 rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selectedServices.includes(svc.value)}
                onChange={() => toggleService(svc.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{svc.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
