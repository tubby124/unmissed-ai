"use client";

import { Label } from "@/components/ui/label";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

const SERVICES = [
  "Haircut / trim",
  "Hair color / highlights",
  "Blowout / styling",
  "Hair extensions",
  "Braids / natural styles",
  "Perms / relaxers",
  "Nails / manicure / pedicure",
  "Waxing",
  "Lashes",
  "Beard trim / shape-up",
];

export default function SalonNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const selectedServices = (answers.services as string[]) || [];
  const bookingType = (answers.bookingType as string) || "general";
  const walkIns = (answers.walkIns as string) || "yes";

  const toggleService = (svc: string) => {
    const updated = selectedServices.includes(svc)
      ? selectedServices.filter((s) => s !== svc)
      : [...selectedServices, svc];
    onChange("services", updated);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Services offered <span className="text-gray-400 font-normal">(select all)</span></Label>
        <div className="grid grid-cols-2 gap-2">
          {SERVICES.map((svc) => (
            <label key={svc} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selectedServices.includes(svc)}
                onChange={() => toggleService(svc)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{svc}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">How does booking work?</Label>
        <div className="space-y-2">
          {[
            { value: "general", label: "General booking — any available stylist" },
            { value: "by_stylist", label: "Clients book with a specific stylist by name" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="bookingType"
                value={opt.value}
                checked={bookingType === opt.value}
                onChange={() => onChange("bookingType", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Walk-ins welcome?</Label>
        <div className="space-y-2">
          {[
            { value: "yes", label: "Yes — walk-ins always welcome" },
            { value: "limited", label: "Limited — depends on availability" },
            { value: "no", label: "No — appointment only" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="walkIns"
                value={opt.value}
                checked={walkIns === opt.value}
                onChange={() => onChange("walkIns", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Enable appointment booking? <span className="text-gray-400 font-normal text-xs">(requires Google Calendar — set up in dashboard after sign-up)</span></Label>
        <div className="space-y-2">
          {[
            { value: "yes", label: "Yes — I want the agent to check availability and book appointments" },
            { value: "no", label: "No — just take messages and answer questions" },
          ].map(opt => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="bookingEnabled"
                value={opt.value}
                checked={(answers.bookingEnabled as string || 'no') === opt.value}
                onChange={() => onChange('bookingEnabled', opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
        {answers.bookingEnabled === 'yes' && (
          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-3">
            After signing up, go to Settings → Booking to connect your Google Calendar. The agent will check availability and book appointments in real time.
          </p>
        )}
      </div>
    </div>
  );
}
