"use client";

import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

const PROPERTY_TYPES = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "both", label: "Both" },
];

const UNIT_COUNTS = [
  { value: "small", label: "Small (1–20 units)" },
  { value: "medium", label: "Medium (21–100 units)" },
  { value: "large", label: "Large (100+ units)" },
];

export default function PropertyManagementNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const propertyType = (answers.propertyType as string) || "";
  const unitCount = (answers.unitCount as string) || "";
  const hasEmergencyLine = (answers.hasEmergencyLine as boolean) ?? false;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          What type of properties do you manage?
        </label>
        <div className="space-y-2">
          {PROPERTY_TYPES.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="propertyType"
                value={opt.value}
                checked={propertyType === opt.value}
                onChange={() => onChange("propertyType", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          How many units or properties do you manage?
        </label>
        <div className="space-y-2">
          {UNIT_COUNTS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="unitCount"
                value={opt.value}
                checked={unitCount === opt.value}
                onChange={() => onChange("unitCount", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={hasEmergencyLine}
            onChange={(e) => onChange("hasEmergencyLine", e.target.checked)}
            className="mt-0.5 accent-blue-600"
          />
          <div>
            <span className="text-sm font-medium text-gray-700">
              I need an emergency line for urgent issues
            </span>
            <p className="text-xs text-gray-400 mt-0.5">
              e.g. flooding, no heat, security concerns — agent will flag these as URGENT
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}
