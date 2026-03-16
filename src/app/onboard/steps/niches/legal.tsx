"use client";

import { Label } from "@/components/ui/label";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

const PRACTICE_AREAS = [
  "Family Law",
  "Criminal Defense",
  "Personal Injury",
  "Real Estate",
  "Business / Corporate",
  "Immigration",
  "Estate Planning",
  "Employment Law",
];

export default function LegalNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const selectedAreas = (answers.practiceAreas as string[]) || [];
  const consultations = (answers.consultations as string) || "yes_free";
  const urgentRouting = (answers.urgentRouting as boolean) ?? true;

  const toggleArea = (area: string) => {
    const updated = selectedAreas.includes(area)
      ? selectedAreas.filter((a) => a !== area)
      : [...selectedAreas, area];
    onChange("practiceAreas", updated);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Practice areas <span className="text-gray-400 font-normal">(select all that apply)</span></Label>
        <div className="grid grid-cols-2 gap-2">
          {PRACTICE_AREAS.map((area) => (
            <label key={area} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selectedAreas.includes(area)}
                onChange={() => toggleArea(area)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{area}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Initial consultations?</Label>
        <div className="space-y-2">
          {[
            { value: "yes_free", label: "Free consultation — we want the inquiry" },
            { value: "yes_paid", label: "Paid consultation — agent collects details, we quote fee" },
            { value: "referral_only", label: "Referral only — not accepting cold inquiries" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="consultations"
                value={opt.value}
                checked={consultations === opt.value}
                onChange={() => onChange("consultations", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Flag urgent / criminal matters for immediate callback?</Label>
        <div className="space-y-2">
          {[
            { value: true, label: "Yes — mark criminal, DUI, custody emergency as URGENT" },
            { value: false, label: "No — treat all inquiries the same" },
          ].map((opt) => (
            <label key={String(opt.value)} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="urgentRouting"
                checked={urgentRouting === opt.value}
                onChange={() => onChange("urgentRouting", opt.value)}
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
