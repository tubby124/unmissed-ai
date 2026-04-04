"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import ChipSelector from "@/components/onboard/ChipSelector";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

const EMERGENCY_OPTIONS = [
  { value: "yes_24_7", label: "24/7 emergency" },
  { value: "yes_business_hours", label: "Business hours only" },
  { value: "no", label: "No emergency" },
];

const CLIENT_TYPE_OPTIONS = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "both", label: "Both" },
];

const SERVICES = [
  { value: "drain_cleaning", label: "Drain cleaning" },
  { value: "water_heater", label: "Water heater" },
  { value: "burst_pipe", label: "Burst pipes" },
  { value: "toilet_repair", label: "Toilet repair" },
  { value: "sewer_backup", label: "Sewer backup" },
  { value: "gas_line", label: "Gas line" },
  { value: "bathroom_reno", label: "Bathroom reno" },
  { value: "leak_detection", label: "Leak detection" },
];

const EXCLUDED_SERVICES = [
  { value: "no_septic", label: "No septic tanks" },
  { value: "no_commercial_grease", label: "No commercial grease traps" },
  { value: "no_gas", label: "No gas line work" },
  { value: "no_reno", label: "No renovations" },
  { value: "no_well", label: "No well/pump systems" },
];

const P1_EMERGENCY_OPTIONS = [
  { value: "burst_pipe", label: "Burst pipe" },
  { value: "flooding", label: "Active flooding" },
  { value: "no_water", label: "No water at all" },
  { value: "sewage_backup", label: "Sewage backup" },
  { value: "gas_smell", label: "Gas smell" },
  { value: "ceiling_dripping", label: "Water dripping from ceiling" },
];

export default function PlumbingNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const emergency = (answers.emergency as string) || "";
  const serviceArea = (answers.serviceArea as string) || "";
  const clientType = (answers.clientType as string) || "";
  const selectedServices = (answers.services as string[]) || [];
  const excludedServices = (answers.excludedServices as string[]) || [];
  const p1Triggers = (answers.p1Triggers as string[]) || [];

  return (
    <div className="space-y-6">
      {/* Emergency service */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Emergency service?</Label>
        <ChipSelector
          options={EMERGENCY_OPTIONS}
          value={emergency}
          onChange={(val) => onChange("emergency", val)}
        />
      </div>

      {/* P1 emergency triggers */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          What counts as a same-day emergency?{" "}
          <span className="text-gray-400 font-normal">(select all)</span>
        </Label>
        <ChipSelector
          multi
          options={P1_EMERGENCY_OPTIONS}
          value={p1Triggers}
          onChange={(val) => onChange("p1Triggers", val)}
        />
      </div>

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
          Services you do <span className="italic">not</span> offer{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <ChipSelector
          multi
          options={EXCLUDED_SERVICES}
          value={excludedServices}
          onChange={(val) => onChange("excludedServices", val)}
        />
      </div>

      {/* Client type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Residential or commercial?</Label>
        <ChipSelector
          options={CLIENT_TYPE_OPTIONS}
          value={clientType}
          onChange={(val) => onChange("clientType", val)}
        />
      </div>

      {/* Service area */}
      <div className="space-y-2">
        <Label htmlFor="serviceArea" className="text-sm font-medium">Service area</Label>
        <Input
          id="serviceArea"
          placeholder="e.g. Atlanta metro, Decatur, Sandy Springs"
          value={serviceArea}
          onChange={(e) => onChange("serviceArea", e.target.value)}
        />
      </div>
    </div>
  );
}
