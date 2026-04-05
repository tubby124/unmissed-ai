"use client";

import { Label } from "@/components/ui/label";
import ChipSelector from "@/components/onboard/ChipSelector";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

const PROPERTY_TYPES = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "strata_condo", label: "Strata / Condo" },
  { value: "mixed", label: "Mixed" },
];

const UNIT_COUNTS = [
  { value: "small", label: "1–20 units" },
  { value: "medium", label: "21–100 units" },
  { value: "large", label: "100+ units" },
];

const MAINTENANCE_EMERGENCY_TRIGGERS = [
  { value: "flooding", label: "Flooding / water damage" },
  { value: "no_heat", label: "No heat (winter)" },
  { value: "sparking", label: "Sparking / electrical" },
  { value: "gas_smell", label: "Gas smell" },
  { value: "security", label: "Break-in / security" },
  { value: "no_hot_water", label: "No hot water" },
  { value: "elevator_stuck", label: "Elevator stuck" },
  { value: "fire", label: "Fire / smoke" },
];

const SERVICES_NOT_OFFERED = [
  { value: "pest_control", label: "Pest control" },
  { value: "major_renovations", label: "Major renovations" },
  { value: "owner_disputes", label: "Owner disputes" },
  { value: "legal_eviction", label: "Legal / eviction advice" },
  { value: "commercial_properties", label: "Commercial properties" },
  { value: "short_term_rentals", label: "Short-term / Airbnb rentals" },
];

export default function PropertyManagementNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const propertyTypes = (answers.propertyTypes as string[]) || [];
  const unitCount = (answers.unitCount as string) || "";
  const hasEmergencyLine = (answers.hasEmergencyLine as boolean) ?? false;
  const maintenanceEmergencyTriggers = (answers.maintenanceEmergencyTriggers as string[]) || [];
  const servicesNotOffered = (answers.servicesNotOffered as string[]) || [];

  return (
    <div className="space-y-6">
      {/* Property types */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          What type of properties do you manage?{" "}
          <span className="text-gray-400 font-normal">(select all)</span>
        </Label>
        <ChipSelector
          multi
          options={PROPERTY_TYPES}
          value={propertyTypes}
          onChange={(val) => onChange("propertyTypes", val)}
        />
      </div>

      {/* Unit count */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">How many units?</Label>
        <ChipSelector
          options={UNIT_COUNTS}
          value={unitCount}
          onChange={(val) => onChange("unitCount", val)}
        />
      </div>

      {/* Emergency line */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">24/7 emergency line?</Label>
        <ChipSelector
          options={[
            { value: "yes", label: "Yes — urgent issues need immediate response" },
            { value: "no", label: "No — next business day is fine" },
          ]}
          value={hasEmergencyLine ? "yes" : "no"}
          onChange={(val) => onChange("hasEmergencyLine", val === "yes")}
        />
      </div>

      {/* Maintenance emergency triggers */}
      {hasEmergencyLine && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            What counts as a P1 emergency?{" "}
            <span className="text-gray-400 font-normal">(select all)</span>
          </Label>
          <ChipSelector
            multi
            options={MAINTENANCE_EMERGENCY_TRIGGERS}
            value={maintenanceEmergencyTriggers}
            onChange={(val) => onChange("maintenanceEmergencyTriggers", val)}
          />
        </div>
      )}

      {/* Services not offered */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          What does your company NOT handle?{" "}
          <span className="text-gray-400 font-normal">(select all that apply)</span>
        </Label>
        <ChipSelector
          multi
          options={SERVICES_NOT_OFFERED}
          value={servicesNotOffered}
          onChange={(val) => onChange("servicesNotOffered", val)}
        />
      </div>

      {/* Pet policy */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Pet policy{" "}
          <span className="text-gray-400 font-normal">(tenants ask — helps your agent answer correctly)</span>
        </Label>
        <ChipSelector
          options={[
            { value: "no_pets", label: "No pets" },
            { value: "cats_only", label: "Cats only" },
            { value: "cats_dogs", label: "Cats & small dogs" },
            { value: "all_pets", label: "All pets welcome" },
            { value: "case_by_case", label: "Case by case — ask owner" },
          ]}
          value={(answers.petPolicy as string) || ""}
          onChange={(val) => onChange("petPolicy", val)}
        />
      </div>

      {/* Parking */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Parking situation{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <ChipSelector
          options={[
            { value: "street_only", label: "Street parking only" },
            { value: "assigned", label: "Assigned stalls" },
            { value: "underground", label: "Underground parkade" },
            { value: "visitor_only", label: "Visitor stalls only" },
          ]}
          value={(answers.parkingPolicy as string) || ""}
          onChange={(val) => onChange("parkingPolicy", val)}
        />
      </div>

      {/* Package handling */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Package / delivery handling{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <ChipSelector
          options={[
            { value: "lobby_only", label: "Lobby / front desk only" },
            { value: "locked_room", label: "Locked package room" },
            { value: "notify_tenant", label: "Carrier leaves at unit" },
            { value: "no_policy", label: "No managed policy" },
          ]}
          value={(answers.packagePolicy as string) || ""}
          onChange={(val) => onChange("packagePolicy", val)}
        />
      </div>

      {/* Maintenance contacts */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Maintenance contacts <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <p className="text-xs text-gray-500">
          List staff or contractors with name, phone, and what they handle. Agent routes emergency calls directly.
        </p>
        <textarea
          value={(answers.maintenanceContacts as string) ?? ""}
          onChange={(e) => onChange("maintenanceContacts", e.target.value)}
          placeholder={
            "Plumbing: Mike (416-555-1234) — leaks, burst pipes\nElectrical: Bob (416-555-5678) — power outage, sparks\nGeneral: Pedro (416-555-9012) — appliances, doors"
          }
          rows={4}
          className="w-full bg-hover border b-theme rounded-xl p-3 text-xs t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
          maxLength={3000}
        />
        <p className="text-[10px] text-gray-400">
          {((answers.maintenanceContacts as string) ?? "").length.toLocaleString()} / 3,000 chars
        </p>
      </div>

      {/* Tenant roster */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Tenant roster <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <p className="text-xs text-gray-500">
          Paste a CSV or plain list: unit, tenant name, rent amount. Agent references this to identify callers.
        </p>
        <textarea
          value={(answers.tenantRoster as string) ?? ""}
          onChange={(e) => onChange("tenantRoster", e.target.value)}
          placeholder={"Unit, Tenant, Rent\n4A, John Smith, $1,200\n4B, Sarah Lee, $1,350"}
          rows={4}
          className="w-full bg-hover border b-theme rounded-xl p-3 text-xs t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
          maxLength={8000}
        />
        <p className="text-[10px] text-gray-400">
          {((answers.tenantRoster as string) ?? "").length.toLocaleString()} / 8,000 chars
        </p>
      </div>
    </div>
  );
}
