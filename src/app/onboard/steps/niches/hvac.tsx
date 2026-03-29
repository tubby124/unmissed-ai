"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

const BRANDS = ["Carrier", "Lennox", "Trane", "Rheem", "York", "Goodman", "Bryant", "American Standard", "Daikin", "Mitsubishi"];

export default function HvacNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const emergency = (answers.emergency as string) || "yes";
  const serviceArea = (answers.serviceArea as string) || "";
  const selectedBrands = (answers.brands as string[]) || [];

  const toggleBrand = (brand: string) => {
    const updated = selectedBrands.includes(brand)
      ? selectedBrands.filter((b) => b !== brand)
      : [...selectedBrands, brand];
    onChange("brands", updated);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Do you offer emergency / after-hours service?</Label>
        <div className="space-y-2">
          {[
            { value: "yes", label: "Yes — 24/7 emergency calls welcome" },
            { value: "yes_premium", label: "Yes — after-hours at premium rate" },
            { value: "business_hours", label: "Business hours only" },
            { value: "no", label: "No emergency service" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="emergency"
                value={opt.value}
                checked={emergency === opt.value}
                onChange={() => onChange("emergency", opt.value)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="serviceArea" className="text-sm font-medium">
          Service area <span className="text-gray-400 font-normal">(cities or region)</span>
        </Label>
        <Input
          id="serviceArea"
          placeholder="e.g. Dallas metro, Plano, Frisco, McKinney"
          value={serviceArea}
          onChange={(e) => onChange("serviceArea", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Brands you service <span className="text-gray-400 font-normal">(select all)</span></Label>
        <div className="grid grid-cols-2 gap-2">
          {BRANDS.map((brand) => (
            <label key={brand} className="flex items-center gap-2 cursor-pointer group p-2 rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selectedBrands.includes(brand)}
                onChange={() => toggleBrand(brand)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{brand}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">How do you price your service?</Label>
        <div className="space-y-2">
          {[
            { value: "free_estimate", label: "Free estimate — we come out and quote before any work" },
            { value: "flat_rate", label: "Flat rate — fixed price per service type" },
            { value: "hourly", label: "Hourly — time + materials" },
            { value: "diagnostic_fee", label: "Diagnostic fee — paid visit to assess, then quote" },
          ].map(opt => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="pricingModel"
                value={opt.value}
                checked={(answers.pricingModel as string) === opt.value}
                onChange={() => onChange("pricingModel", opt.value)}
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
