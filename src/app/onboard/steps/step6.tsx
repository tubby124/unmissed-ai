"use client";

import { Label } from "@/components/ui/label";
import { OnboardingData, AgentTone, PrimaryGoal, PricingPolicy, NICHE_CONFIG } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

function CardRadio<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: T; label: string; desc: string }[];
  value: T | "";
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`
            flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
            ${value === opt.value
              ? "border-indigo-600 bg-indigo-50"
              : "border-gray-200 hover:border-gray-300"
            }
          `}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="mt-0.5 accent-indigo-600"
          />
          <div>
            <span className="text-sm font-medium text-slate-900">{opt.label}</span>
            <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

export default function Step6({ data, onUpdate }: Props) {
  const nicheConfig = data.niche ? NICHE_CONFIG[data.niche] : null;
  const showPricing = nicheConfig?.showPricingPolicy ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">A few preferences</h2>
        <p className="text-sm text-slate-500 mt-1">
          2-3 quick choices — you can fine-tune everything in Settings after your agent is live.
        </p>
      </div>

      {/* Pricing policy — niche-conditional */}
      {showPricing && (
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">How should your agent handle pricing questions?</Label>
            <p className="text-xs text-slate-400 mt-0.5">This is often the first thing callers ask</p>
          </div>
          <CardRadio<PricingPolicy>
            name="pricingPolicy"
            value={data.pricingPolicy}
            onChange={(v) => onUpdate({ pricingPolicy: v })}
            options={[
              {
                value: "quote_range",
                label: "Give a ballpark range",
                desc: "Casual and transparent — works well for jobs with predictable pricing",
              },
              {
                value: "no_quote_callback",
                label: "Never quote — call back with a quote",
                desc: "Manages expectations — best when pricing varies a lot",
              },
              {
                value: "website_pricing",
                label: "Direct to website",
                desc: "Good if you have a pricing page — keeps calls short",
              },
              {
                value: "collect_first",
                label: "Collect info first, then give a range",
                desc: "Highest conversion — gets caller info before they can object to price",
              },
            ]}
          />
        </div>
      )}

      {/* Primary goal */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">What should your agent primarily do on each call?</Label>
        <CardRadio<PrimaryGoal>
          name="primaryGoal"
          value={data.primaryGoal}
          onChange={(v) => onUpdate({ primaryGoal: v })}
          options={[
            {
              value: "capture_info",
              label: "Capture info for callback",
              desc: "Collect customer details — your team calls back to quote and book",
            },
            {
              value: "book_appointment",
              label: "Book the appointment directly",
              desc: "AI schedules the slot on the call — requires calendar integration",
            },
            {
              value: "faq_only",
              label: "Answer questions only",
              desc: "Handle FAQs and hours — humans close the booking",
            },
          ]}
        />
      </div>

      {/* Agent tone */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Agent tone</Label>
        <CardRadio<AgentTone>
          name="agentTone"
          value={data.agentTone}
          onChange={(v) => onUpdate({ agentTone: v })}
          options={[
            {
              value: "casual",
              label: "Casual and friendly",
              desc: "Relaxed, conversational — like talking to someone helpful at the shop",
            },
            {
              value: "professional",
              label: "Professional and formal",
              desc: "Polished, structured — better for legal, medical, financial services",
            },
            {
              value: "match_industry",
              label: "Match my industry",
              desc: "We choose the right tone based on your niche",
            },
          ]}
        />
      </div>

      <p className="text-xs text-slate-400 pt-1">
        More options (custom FAQs, what to collect, restrictions) are available in Settings after activation.
      </p>
    </div>
  );
}
