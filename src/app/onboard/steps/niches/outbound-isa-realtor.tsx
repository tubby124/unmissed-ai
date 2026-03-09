"use client";

import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

const LEAD_TYPES = [
  { value: "buyers", label: "Buyers" },
  { value: "sellers", label: "Sellers" },
  { value: "both", label: "Both" },
];

const SCRIPT_STYLES = [
  { value: "consultative", label: "Consultative", desc: "Conversational, builds rapport before pitching" },
  { value: "direct", label: "Direct", desc: "Gets to the point quickly, efficient qualification" },
  { value: "aggressive", label: "Aggressive", desc: "Persistent follow-up, strong CTA on every call" },
];

const OBJECTION_HANDLING = [
  { value: "soft", label: "Acknowledge and pivot", desc: "Validates the objection, then redirects to value" },
  { value: "firm", label: "Push through", desc: "Continues the pitch, doesn't accept the first 'no'" },
  { value: "log_and_close", label: "Log and close", desc: "Notes the objection and ends call — quality over persistence" },
];

export default function OutboundIsaRealtorNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const leadType = (answers.leadType as string) || "";
  const scriptStyle = (answers.scriptStyle as string) || "";
  const objectionHandling = (answers.objectionHandling as string) || "";
  const marketArea = (answers.marketArea as string) || "";
  const dailyCallTarget = (answers.dailyCallTarget as string) || "";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          What type of leads are you calling?
        </label>
        <div className="space-y-2">
          {LEAD_TYPES.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="leadType"
                value={opt.value}
                checked={leadType === opt.value}
                onChange={() => onChange("leadType", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="marketArea" className="text-sm font-medium text-gray-700">
          What market area or city do you serve?
        </label>
        <input
          id="marketArea"
          type="text"
          placeholder="e.g. Calgary AB, Saskatoon SK, Greater Toronto Area"
          value={marketArea}
          onChange={(e) => onChange("marketArea", e.target.value)}
          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          What call script style do you prefer?
        </label>
        <div className="space-y-2">
          {SCRIPT_STYLES.map((opt) => (
            <label key={opt.value} className="flex items-start gap-3 cursor-pointer group p-3 rounded-lg border border-gray-200 hover:border-gray-300">
              <input
                type="radio"
                name="scriptStyle"
                value={opt.value}
                checked={scriptStyle === opt.value}
                onChange={() => onChange("scriptStyle", opt.value)}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          How should the agent handle objections?
        </label>
        <div className="space-y-2">
          {OBJECTION_HANDLING.map((opt) => (
            <label key={opt.value} className="flex items-start gap-3 cursor-pointer group p-3 rounded-lg border border-gray-200 hover:border-gray-300">
              <input
                type="radio"
                name="objectionHandling"
                value={opt.value}
                checked={objectionHandling === opt.value}
                onChange={() => onChange("objectionHandling", opt.value)}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="dailyCallTarget" className="text-sm font-medium text-gray-700">
          Target calls per day <span className="text-gray-400 font-normal text-xs">(optional — helps calibrate agent pacing)</span>
        </label>
        <input
          id="dailyCallTarget"
          type="text"
          placeholder="e.g. 50, 100, 200+"
          value={dailyCallTarget}
          onChange={(e) => onChange("dailyCallTarget", e.target.value)}
          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}
