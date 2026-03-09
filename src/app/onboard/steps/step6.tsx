"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OnboardingData, AgentTone, PrimaryGoal } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export default function Step6({ data, onUpdate }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Final preferences</h2>
        <p className="text-sm text-gray-500 mt-1">
          Optional — helps your agent handle edge cases and sound right for your brand.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">What should the agent primarily do on each call?</Label>
        <div className="space-y-2">
          {([
            { value: "capture_info" as PrimaryGoal, label: "Capture info for callback", desc: "Collect customer details — your team calls back to quote and book" },
            { value: "book_appointment" as PrimaryGoal, label: "Book the appointment directly", desc: "AI schedules the slot on the call — requires calendar integration" },
            { value: "faq_only" as PrimaryGoal, label: "Answer questions only", desc: "Handle FAQs and hours — humans close the booking" },
          ]).map((opt) => (
            <label
              key={opt.value}
              className={`
                flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${data.primaryGoal === opt.value
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              <input
                type="radio"
                name="primaryGoal"
                value={opt.value}
                checked={data.primaryGoal === opt.value}
                onChange={() => onUpdate({ primaryGoal: opt.value })}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="completionFields">
          What must be collected before hanging up?{" "}
          <span className="text-gray-400 font-normal text-xs">(3–5 items max)</span>
        </Label>
        <Textarea
          id="completionFields"
          placeholder="e.g. vehicle year, make, model, preferred timing"
          value={data.completionFields}
          onChange={(e) => onUpdate({ completionFields: e.target.value })}
          className="resize-none min-h-[80px]"
        />
        <p className="text-xs text-gray-400">The agent won&apos;t hang up until all of these are captured</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="callerFAQ">
          Common questions callers ask{" "}
          <span className="text-gray-400 font-normal text-xs">(optional)</span>
        </Label>
        <Textarea
          id="callerFAQ"
          placeholder="e.g. 'Where are you located?' — we're at 1234 Main St, north end near the Walmart. Parking is free out front."
          value={data.callerFAQ}
          onChange={(e) => onUpdate({ callerFAQ: e.target.value })}
          className="resize-none min-h-[80px]"
        />
        <p className="text-xs text-gray-400">Anything callers frequently ask that your agent should know the answer to.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agentRestrictions">
          Anything your agent should NOT say or do{" "}
          <span className="text-gray-400 font-normal text-xs">(optional)</span>
        </Label>
        <Textarea
          id="agentRestrictions"
          placeholder="e.g. Do not quote prices. Do not book appointments directly — take info and say we'll call back."
          value={data.agentRestrictions}
          onChange={(e) => onUpdate({ agentRestrictions: e.target.value })}
          className="resize-none min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Agent tone</Label>
        <div className="space-y-2">
          {[
            {
              value: "casual" as AgentTone,
              label: "Casual and friendly",
              desc: "Relaxed, conversational — like talking to a helpful person at the shop",
            },
            {
              value: "professional" as AgentTone,
              label: "Professional and formal",
              desc: "Polished, structured — better for legal, medical, financial services",
            },
            {
              value: "match_industry" as AgentTone,
              label: "Match my industry",
              desc: "We'll choose the right tone based on your niche",
            },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`
                flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${data.agentTone === opt.value
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              <input
                type="radio"
                name="agentTone"
                value={opt.value}
                checked={data.agentTone === opt.value}
                onChange={() => onUpdate({ agentTone: opt.value })}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
