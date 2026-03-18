"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingData, NICHE_CONFIG, Niche, PricingPolicy } from "@/types/onboarding";
import { TIMEZONE_MAP } from "@/lib/intake-transform";

function countDigits(s: string): number {
  return (s.match(/\d/g) || []).length;
}

// Niches that have a Places-type → services mapping (mirrors PLACES_TYPE_TO_SERVICES in step1)
const NICHES_WITH_PLACES_SERVICES = new Set<Niche>([
  'auto_glass', 'dental', 'salon', 'plumbing', 'hvac', 'legal',
  'real_estate', 'restaurant',
])

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

export default function Step3Basics({ data, onUpdate }: Props) {
  const isVoicemail = data.niche === "voicemail";
  const isRealEstate = data.niche === "real_estate";
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const phoneDigits = countDigits(data.callbackPhone);
  const phoneInvalid = phoneTouched && data.callbackPhone.length > 0 && phoneDigits < 10;
  const emailInvalid = emailTouched && data.contactEmail.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail.trim());

  const nicheConfig = data.niche ? NICHE_CONFIG[data.niche as Niche] : null;
  const showAddress = nicheConfig?.hasPhysicalAddress ?? false;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {isVoicemail ? "Tell us about yourself" : "Tell us about your business"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          This shapes how your agent introduces itself and routes calls.
        </p>
      </div>

      {data.placeId && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
          <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Filled from Google — review and edit if needed</span>
        </div>
      )}

      {isRealEstate && (
        <div className="space-y-2">
          <Label htmlFor="ownerNameTop">
            Your full name <span className="text-red-400">*</span>
            <span className="text-muted-foreground/70 font-normal text-xs ml-1">
              (callers hear: &quot;from [your name]&apos;s office at [brokerage]&quot;)
            </span>
          </Label>
          <Input
            id="ownerNameTop"
            placeholder="e.g. Omar Sharif"
            value={data.ownerName}
            onChange={(e) => onUpdate({ ownerName: e.target.value })}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="businessName">
          {isVoicemail
            ? "Your name"
            : isRealEstate
              ? "Your brokerage"
              : "Business name"}{" "}
          <span className="text-red-400">*</span>
          {isVoicemail && (
            <span className="text-muted-foreground/70 font-normal text-xs ml-1">
              (callers hear: &quot;you&apos;ve reached [name]&apos;s AI assistant&quot;)
            </span>
          )}
        </Label>
        <Input
          id="businessName"
          placeholder={
            isVoicemail
              ? "e.g. John Smith"
              : isRealEstate
                ? "e.g. eXp Realty, RE/MAX, Royal LePage"
                : "e.g. Dallas Quick Glass"
          }
          value={data.businessName}
          onChange={(e) => onUpdate({ businessName: e.target.value })}
        />
      </div>

      {showAddress && (
        <div className="space-y-2">
          <Label htmlFor="streetAddress">
            Street address{" "}
            <span className="text-muted-foreground/70 font-normal text-xs">
              (optional — helps agent answer &quot;where are you located?&quot;)
            </span>
          </Label>
          <Input
            id="streetAddress"
            placeholder="e.g. 123 Main St"
            value={data.streetAddress}
            onChange={(e) => onUpdate({ streetAddress: e.target.value })}
          />
        </div>
      )}

      {!isVoicemail && (
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
              onChange={(e) => {
                const value = e.target.value;
                const detectedTz = TIMEZONE_MAP[value.toUpperCase()];
                onUpdate({
                  state: value,
                  ...(detectedTz ? { timezone: detectedTz } : {}),
                });
              }}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <option value="">Select...</option>
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

      {!isVoicemail && (
        <div className="space-y-2">
          <Label htmlFor="businessHoursText">
            Business hours <span className="text-red-400">*</span>
          </Label>
          <Input
            id="businessHoursText"
            placeholder="e.g. Mon-Fri 9am-5pm, Sat 10am-2pm"
            value={data.businessHoursText}
            onChange={(e) => onUpdate({ businessHoursText: e.target.value })}
          />
          <p className="text-xs text-muted-foreground/70">
            When is your business open? Your agent will use this to handle after-hours calls.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="callbackPhone">
          Your real callback number <span className="text-red-400">*</span>{" "}
          <span className="text-muted-foreground/70 font-normal text-xs">
            (NOT the AI line — sent to callers via SMS)
          </span>
        </Label>
        <Input
          id="callbackPhone"
          type="tel"
          placeholder="(403) 555-1234"
          value={data.callbackPhone}
          onChange={(e) => {
            if (e.target.value.length > 0) setPhoneTouched(true);
            onUpdate({ callbackPhone: e.target.value });
          }}
          onBlur={() => setPhoneTouched(true)}
        />
        {phoneInvalid && (
          <p className="text-xs text-red-400 mt-1">Need at least 10 digits</p>
        )}
        {!phoneInvalid && isVoicemail && (
          <p className="text-xs text-muted-foreground/70 mt-1">
            You&apos;ll receive a setup SMS at this number when your agent goes live.
          </p>
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
          onBlur={() => setEmailTouched(true)}
        />
        {emailInvalid ? (
          <p className="text-xs text-red-600 mt-1">Please enter a valid email address</p>
        ) : (
          <p className="text-xs text-muted-foreground/70">Used for setup updates — not shared with callers</p>
        )}
      </div>

      <div className="pt-1 space-y-4 border-t border-border">
        <p className="text-xs text-muted-foreground/70 pt-2">Optional — fill in what you know now, skip the rest</p>

        {!isRealEstate && !isVoicemail && (
          <div className="space-y-2">
            <Label htmlFor="ownerName">Your name</Label>
            <Input
              id="ownerName"
              placeholder="e.g. Mike Johnson"
              value={data.ownerName}
              onChange={(e) => onUpdate({ ownerName: e.target.value })}
            />
          </div>
        )}

        {!isVoicemail && (
          <div className="space-y-2">
            <Label htmlFor="servicesOffered">Services offered</Label>
            <textarea
              id="servicesOffered"
              rows={2}
              placeholder="e.g. windshield repair, chip filling, ADAS recalibration"
              value={data.servicesOffered}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                onUpdate({ servicesOffered: e.target.value })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            {data.servicesOffered && data.niche && NICHES_WITH_PLACES_SERVICES.has(data.niche as Niche) && (
              <p className="text-xs text-muted-foreground/60 mt-1">(edit if needed)</p>
            )}
          </div>
        )}

        {!isVoicemail && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">How do you handle pricing questions?</Label>
            <div className="space-y-2">
              {([
                { id: "quote_range" as PricingPolicy, label: "Give a price range", desc: "Agent shares a general price range when asked" },
                { id: "no_quote_callback" as PricingPolicy, label: "Collect info, we'll call back with quote", desc: "Agent gathers details, schedules a callback" },
                { id: "website_pricing" as PricingPolicy, label: "Direct to website pricing", desc: "Agent refers callers to your website" },
                { id: "collect_first" as PricingPolicy, label: "Collect info before giving any price", desc: "Agent qualifies the caller first" },
              ] as Array<{ id: PricingPolicy; label: string; desc: string }>).map(({ id, label, desc }) => (
                <label
                  key={id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <input
                    type="radio"
                    name="pricingPolicy"
                    value={id}
                    checked={data.pricingPolicy === id}
                    onChange={() => onUpdate({ pricingPolicy: id })}
                    className="mt-0.5 accent-indigo-600 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
