"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import ChipSelector from "@/components/onboard/ChipSelector";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

const SERVICES = [
  { value: "furnace_repair", label: "Furnace repair" },
  { value: "ac_repair", label: "AC repair" },
  { value: "furnace_install", label: "Furnace installation" },
  { value: "ac_install", label: "AC installation" },
  { value: "heat_pump", label: "Heat pump" },
  { value: "duct_cleaning", label: "Duct cleaning" },
  { value: "humidifier", label: "Humidifier" },
  { value: "thermostat", label: "Thermostat" },
  { value: "boiler", label: "Boiler" },
  { value: "air_quality", label: "Air quality" },
];

const EXCLUDED_SERVICES = [
  { value: "no_commercial", label: "Commercial HVAC" },
  { value: "no_oil_furnace", label: "Oil furnaces" },
  { value: "no_radiant", label: "Radiant heating" },
  { value: "no_geothermal", label: "Geothermal systems" },
  { value: "no_duct_fabrication", label: "Custom duct fabrication" },
];

const MOBILE_OPTIONS = [
  { value: "residential", label: "Residential only" },
  { value: "commercial", label: "Commercial only" },
  { value: "both", label: "Both" },
];

const EMERGENCY_OPTIONS = [
  { value: "yes_24_7", label: "Yes — 24/7" },
  { value: "yes_after_hours", label: "Yes — after hours" },
  { value: "no_emergency", label: "No emergency calls" },
];

const P1_TRIGGERS = [
  { value: "no_heat_winter", label: "No heat in winter" },
  { value: "furnace_not_starting", label: "Furnace not starting" },
  { value: "carbon_monoxide", label: "Carbon monoxide" },
  { value: "gas_smell", label: "Gas smell" },
  { value: "no_cooling_extreme_heat", label: "No AC in extreme heat" },
  { value: "system_flooded", label: "System flooded" },
];

const INSURANCE_OPTIONS = [
  { value: "all_major", label: "All major insurance" },
  { value: "private_pay", label: "Private pay only" },
  { value: "pending", label: "Pending/not yet" },
];

export default function HvacNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const selectedServices = (answers.services as string[]) || [];
  const excludedServices = (answers.excludedServices as string[]) || [];
  const mobileService = (answers.mobileService as string) || "";
  const emergencyService = (answers.emergencyService as string) || "";
  const p1Triggers = (answers.p1Triggers as string[]) || [];
  const insurance = (answers.insurance as string) || "";

  return (
    <div className="space-y-6">
      {/* Services offered */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Services offered <span className="text-gray-400 font-normal">(select all)</span>
        </Label>
        <ChipSelector
          multi
          options={SERVICES}
          value={selectedServices}
          onChange={(val) => onChange("services", val)}
        />
      </div>

      {/* Services NOT offered */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Services <span className="italic">not</span> offered{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <ChipSelector
          multi
          options={EXCLUDED_SERVICES}
          value={excludedServices}
          onChange={(val) => onChange("excludedServices", val)}
        />
      </div>

      {/* Service area */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Service area</Label>
        <ChipSelector
          options={MOBILE_OPTIONS}
          value={mobileService}
          onChange={(val) => onChange("mobileService", val)}
        />
      </div>

      {/* Emergency calls */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Emergency calls?</Label>
        <ChipSelector
          options={EMERGENCY_OPTIONS}
          value={emergencyService}
          onChange={(val) => onChange("emergencyService", val)}
        />
      </div>

      {/* P1 triggers */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          What counts as an emergency?{" "}
          <span className="text-gray-400 font-normal">(select all)</span>
        </Label>
        <ChipSelector
          multi
          options={P1_TRIGGERS}
          value={p1Triggers}
          onChange={(val) => onChange("p1Triggers", val)}
        />
      </div>

      {/* Insurance */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Insurance accepted</Label>
        <ChipSelector
          options={INSURANCE_OPTIONS}
          value={insurance}
          onChange={(val) => onChange("insurance", val)}
        />
      </div>

      {/* Diagnostic fee */}
      <div className="space-y-2">
        <Label htmlFor="diagnosticFee" className="text-sm font-medium">
          Dispatch/diagnostic fee <span className="text-gray-400 font-normal">(e.g. $89)</span>
        </Label>
        <Input
          id="diagnosticFee"
          placeholder="e.g. $89"
          value={(data.nicheAnswers?.diagnosticFee as string) || ""}
          onChange={(e) => onChange("diagnosticFee", e.target.value)}
        />
      </div>
    </div>
  );
}
