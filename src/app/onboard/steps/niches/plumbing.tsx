"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

export default function PlumbingNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const emergency = (answers.emergency as string) || "yes_24_7";
  const serviceArea = (answers.serviceArea as string) || "";
  const clientType = (answers.clientType as string) || "both";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Do you offer emergency service?</Label>
        <div className="space-y-2">
          {[
            { value: "yes_24_7", label: "Yes — 24/7 emergency calls (burst pipes, flooding)" },
            { value: "yes_business_hours", label: "Yes — but only during business hours" },
            { value: "no", label: "No emergency service" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="emergency"
                value={opt.value}
                checked={emergency === opt.value}
                onChange={() => onChange("emergency", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="serviceArea" className="text-sm font-medium">Service area</Label>
        <Input
          id="serviceArea"
          placeholder="e.g. Atlanta metro, Decatur, Sandy Springs"
          value={serviceArea}
          onChange={(e) => onChange("serviceArea", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Residential or commercial?</Label>
        <div className="space-y-2">
          {[
            { value: "residential", label: "Residential only" },
            { value: "commercial", label: "Commercial only" },
            { value: "both", label: "Both residential and commercial" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="clientType"
                value={opt.value}
                checked={clientType === opt.value}
                onChange={() => onChange("clientType", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
