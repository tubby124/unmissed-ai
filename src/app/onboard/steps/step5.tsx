"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingData, NotificationMethod } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export default function Step5({ data, onUpdate }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">How should your agent notify you?</h2>
        <p className="text-sm text-gray-500 mt-1">
          Every call sends you an instant notification with the lead details.
        </p>
      </div>

      <div className="space-y-3">
        {[
          {
            value: "telegram" as NotificationMethod,
            label: "Telegram",
            badge: "Recommended",
            desc: "Instant, free, rich formatting — includes call summary + lead score",
          },
          {
            value: "sms" as NotificationMethod,
            label: "SMS text message",
            badge: "",
            desc: "Text message to your phone number",
          },
          {
            value: "both" as NotificationMethod,
            label: "Both Telegram + SMS",
            badge: "",
            desc: "Redundant — never miss a lead",
          },
        ].map((opt) => (
          <label
            key={opt.value}
            className={`
              flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
              ${data.notificationMethod === opt.value
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
              }
            `}
          >
            <input
              type="radio"
              name="notificationMethod"
              value={opt.value}
              checked={data.notificationMethod === opt.value}
              onChange={() => onUpdate({ notificationMethod: opt.value })}
              className="mt-1 accent-blue-600"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                {opt.badge && (
                  <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
                    {opt.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {(data.notificationMethod === "sms" || data.notificationMethod === "both") && (
        <div className="space-y-2">
          <Label htmlFor="notificationPhone">Phone number for SMS notifications</Label>
          <Input
            id="notificationPhone"
            type="tel"
            placeholder="(555) 555-0100"
            value={data.notificationPhone}
            onChange={(e) => onUpdate({ notificationPhone: e.target.value })}
          />
        </div>
      )}

      {data.notificationMethod === "telegram" && (
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm text-blue-800 font-medium">Telegram setup (2 minutes)</p>
          <p className="text-xs text-blue-600 mt-1">
            After your agent is live, we&apos;ll send you simple instructions to connect your Telegram account.
            No technical knowledge needed — just click a link.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notificationEmail">Email for backup notifications <span className="text-gray-400 font-normal text-xs">(optional)</span></Label>
        <Input
          id="notificationEmail"
          type="email"
          placeholder="owner@yourbusiness.com"
          value={data.notificationEmail}
          onChange={(e) => onUpdate({ notificationEmail: e.target.value })}
        />
      </div>
    </div>
  );
}
