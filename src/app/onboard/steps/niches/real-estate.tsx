"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

const TRANSACTION_TYPES = [
  { value: "buying", label: "Buying" },
  { value: "selling", label: "Selling" },
  { value: "rentals", label: "Rentals" },
  { value: "property_management", label: "Property management" },
  { value: "commercial", label: "Commercial" },
];

const LEAD_SOURCES = [
  { value: "website_inquiries", label: "Website inquiries" },
  { value: "sign_calls", label: "Sign calls" },
  { value: "referrals", label: "Referrals" },
  { value: "online_ads", label: "Online ads" },
  { value: "open_houses", label: "Open houses" },
];

const TEAM_SIZES = [
  { value: "solo", label: "Solo agent" },
  { value: "small_team", label: "Small team (2-5)" },
  { value: "brokerage", label: "Brokerage (6+)" },
];

const PRE_QUALIFICATION_OPTIONS = [
  { value: "ask_preapproval", label: "Ask about pre-approval status" },
  { value: "dont_ask", label: "Don't ask about financing" },
  { value: "refer_mortgage", label: "Refer to mortgage partner" },
];

const SHOWING_OPTIONS = [
  { value: "book_directly", label: "Book showings directly" },
  { value: "collect_info", label: "Collect info and call back" },
  { value: "booking_link", label: "Redirect to booking link" },
];

export default function RealEstateNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const selectedTransactionTypes = (answers.transactionTypes as string[]) || [];
  const serviceArea = (answers.serviceArea as string) || "";
  const teamSize = (answers.teamSize as string) || "";
  const selectedLeadSources = (answers.leadSources as string[]) || [];
  const preQualification = (answers.preQualification as string) || "";
  const showingPolicy = (answers.showingPolicy as string) || "";

  const toggleTransactionType = (val: string) => {
    const updated = selectedTransactionTypes.includes(val)
      ? selectedTransactionTypes.filter((t) => t !== val)
      : [...selectedTransactionTypes, val];
    onChange("transactionTypes", updated);
  };

  const toggleLeadSource = (val: string) => {
    const updated = selectedLeadSources.includes(val)
      ? selectedLeadSources.filter((s) => s !== val)
      : [...selectedLeadSources, val];
    onChange("leadSources", updated);
  };

  return (
    <div className="space-y-6">
      {/* Transaction Types */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">What types of transactions do you handle? <span className="text-gray-400 font-normal">(select all that apply)</span></Label>
        <div className="grid grid-cols-2 gap-2">
          {TRANSACTION_TYPES.map((type) => (
            <label key={type.value} className="flex items-center gap-2 cursor-pointer group p-2 rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selectedTransactionTypes.includes(type.value)}
                onChange={() => toggleTransactionType(type.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{type.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Service Area */}
      <div className="space-y-2">
        <Label htmlFor="serviceArea" className="text-sm font-medium">
          What areas/neighborhoods do you primarily serve? <span className="text-gray-400 font-normal">(cities or region)</span>
        </Label>
        <Input
          id="serviceArea"
          placeholder="e.g. Downtown Toronto, North York, Mississauga, Brampton"
          value={serviceArea}
          onChange={(e) => onChange("serviceArea", e.target.value)}
        />
      </div>

      {/* Team Size */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">What is your team size?</Label>
        <div className="space-y-2">
          {TEAM_SIZES.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="teamSize"
                value={opt.value}
                checked={teamSize === opt.value}
                onChange={() => onChange("teamSize", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Lead Sources */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Where do your leads come from? <span className="text-gray-400 font-normal">(select all that apply)</span></Label>
        <div className="grid grid-cols-2 gap-2">
          {LEAD_SOURCES.map((source) => (
            <label key={source.value} className="flex items-center gap-2 cursor-pointer group p-2 rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selectedLeadSources.includes(source.value)}
                onChange={() => toggleLeadSource(source.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{source.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Pre-qualification */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">How should the agent handle pre-qualification?</Label>
        <div className="space-y-2">
          {PRE_QUALIFICATION_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="preQualification"
                value={opt.value}
                checked={preQualification === opt.value}
                onChange={() => onChange("preQualification", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Showing Scheduling */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">How should showings be scheduled?</Label>
        <div className="space-y-2">
          {SHOWING_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="showingPolicy"
                value={opt.value}
                checked={showingPolicy === opt.value}
                onChange={() => onChange("showingPolicy", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
