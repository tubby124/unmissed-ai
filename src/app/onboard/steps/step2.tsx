"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingData, defaultAgentNames, NICHE_CONFIG, Niche } from "@/types/onboarding";

function countDigits(s: string): number {
  return (s.match(/\d/g) || []).length;
}

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const CA_PROVINCES = [
  { code: "AB", label: "Alberta" },
  { code: "BC", label: "British Columbia" },
  { code: "MB", label: "Manitoba" },
  { code: "NB", label: "New Brunswick" },
  { code: "NL", label: "Newfoundland & Labrador" },
  { code: "NS", label: "Nova Scotia" },
  { code: "NT", label: "Northwest Territories" },
  { code: "NU", label: "Nunavut" },
  { code: "ON", label: "Ontario" },
  { code: "PE", label: "Prince Edward Island" },
  { code: "QC", label: "Quebec" },
  { code: "SK", label: "Saskatchewan" },
  { code: "YT", label: "Yukon" },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export default function Step2({ data, onUpdate }: Props) {
  const suggestedName = data.niche ? defaultAgentNames[data.niche] : "Sam";
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneDigits = countDigits(data.callbackPhone);
  const phoneInvalid = phoneTouched && data.callbackPhone.length > 0 && phoneDigits < 10;

  const nicheConfig = data.niche ? NICHE_CONFIG[data.niche as Niche] : null;
  const showAddress = nicheConfig?.hasPhysicalAddress ?? false;
  const isFastTrack = nicheConfig?.fastTrack ?? false;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Tell us about your business</h2>
        <p className="text-sm text-slate-500 mt-1">
          This shapes how your agent introduces itself and routes calls.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="businessName">Business name <span className="text-red-400">*</span></Label>
        <Input
          id="businessName"
          placeholder="e.g. Dallas Quick Glass"
          value={data.businessName}
          onChange={(e) => onUpdate({ businessName: e.target.value })}
        />
      </div>

      {showAddress && (
        <div className="space-y-2">
          <Label htmlFor="streetAddress">
            Street address{" "}
            <span className="text-slate-400 font-normal text-xs">(optional — helps agent answer &quot;where are you located?&quot;)</span>
          </Label>
          <Input
            id="streetAddress"
            placeholder="e.g. 123 Main St"
            value={data.streetAddress}
            onChange={(e) => onUpdate({ streetAddress: e.target.value })}
          />
        </div>
      )}

      {!isFastTrack && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="city">City <span className="text-red-400">*</span></Label>
            <Input
              id="city"
              placeholder="e.g. Dallas"
              value={data.city}
              onChange={(e) => onUpdate({ city: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">Province / State <span className="text-red-400">*</span></Label>
            <select
              id="state"
              value={data.state}
              onChange={(e) => onUpdate({ state: e.target.value })}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <option value="">Select…</option>
              <optgroup label="Canada">
                {CA_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>{p.label} ({p.code})</option>
                ))}
              </optgroup>
              <optgroup label="United States">
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="callbackPhone">
          Your real callback number <span className="text-red-400">*</span>{" "}
          <span className="text-slate-400 font-normal text-xs">(NOT the AI line — sent to callers via SMS)</span>
        </Label>
        <Input
          id="callbackPhone"
          type="tel"
          placeholder="(403) 555-1234"
          value={data.callbackPhone}
          onChange={(e) => onUpdate({ callbackPhone: e.target.value })}
          onBlur={() => setPhoneTouched(true)}
        />
        {phoneInvalid && (
          <p className="text-xs text-red-600 mt-1">Phone number must have at least 10 digits</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactEmail">
          Your email address <span className="text-red-400">*</span>
        </Label>
        <Input
          id="contactEmail"
          type="email"
          placeholder="mike@yourshop.com"
          value={data.contactEmail}
          onChange={(e) => onUpdate({ contactEmail: e.target.value })}
        />
        <p className="text-xs text-slate-400">Used for setup updates — not shared with callers</p>
      </div>

      <div className="pt-1 space-y-4 border-t border-gray-100">
        <p className="text-xs text-slate-400 pt-2">Optional — fill in what you know now, skip the rest</p>

        <div className="space-y-2">
          <Label htmlFor="agentName">
            Agent name{" "}
            <span className="text-slate-400 font-normal text-xs">
              (suggested: {suggestedName})
            </span>
          </Label>
          <Input
            id="agentName"
            placeholder={suggestedName}
            value={data.agentName}
            onChange={(e) => onUpdate({ agentName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownerName">Your name</Label>
          <Input
            id="ownerName"
            placeholder="e.g. Mike Johnson"
            value={data.ownerName}
            onChange={(e) => onUpdate({ ownerName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="websiteUrl">Business website</Label>
          <Input
            id="websiteUrl"
            type="url"
            placeholder="https://yourshop.com"
            value={data.websiteUrl}
            onChange={(e) => onUpdate({ websiteUrl: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
