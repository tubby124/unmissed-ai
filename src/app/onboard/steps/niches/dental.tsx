"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

export default function DentalNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const newPatients = (answers.newPatients as string) || "yes";
  const insurance = (answers.insurance as string) || "";
  const emergencyAppts = (answers.emergencyAppts as string) || "yes";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Are you accepting new patients?</Label>
        <div className="space-y-2">
          {[
            { value: "yes", label: "Yes — accepting new patients" },
            { value: "waitlist", label: "Waitlist only — we'll add them and call back" },
            { value: "no", label: "No — established patients only" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="newPatients"
                value={opt.value}
                checked={newPatients === opt.value}
                onChange={() => onChange("newPatients", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="insurance" className="text-sm font-medium">
          Insurance accepted <span className="text-gray-400 font-normal">(list the main ones)</span>
        </Label>
        <Input
          id="insurance"
          placeholder="e.g. Delta Dental, Cigna, Aetna, MetLife, United Concordia"
          value={insurance}
          onChange={(e) => onChange("insurance", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Do you book emergency / same-day appointments?</Label>
        <div className="space-y-2">
          {[
            { value: "yes", label: "Yes — we fit in dental emergencies same-day" },
            { value: "no", label: "No — schedule ahead only" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="emergencyAppts"
                value={opt.value}
                checked={emergencyAppts === opt.value}
                onChange={() => onChange("emergencyAppts", opt.value)}
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
