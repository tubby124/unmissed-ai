"use client";

import { OnboardingData, nicheLabels } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  stepSequence: number[];
  onEdit: (step: number) => void;
}

function formatHoursDisplay(data: OnboardingData) {
  const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
  const labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const lines: string[] = [];
  days.forEach((day, i) => {
    const h = data.hours[day];
    if (!h.closed && h.open && h.close) {
      lines.push(`${labels[i]}: ${formatTime12(h.open)}–${formatTime12(h.close)}`);
    }
  });
  return lines.join(" · ") || "Not set";
}

function formatTime12(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function camelToLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatNicheValue(value: string | string[] | boolean): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((v) => camelToLabel(v.replace(/_/g, " "))).join(", ");
  return String(value);
}

function AgentPreview({ data }: { data: OnboardingData }) {
  const name = data.agentName || (data.niche ? ({ auto_glass:"Mark",hvac:"Mike",plumbing:"Dave",dental:"Ashley",legal:"Jordan",salon:"Jamie",real_estate:"Alex",property_management:"Alisha",outbound_isa_realtor:"Fatima",voicemail:"Sam",other:"Sam" } as Record<string,string>)[data.niche] : "Sam");
  const biz = data.businessName || "[Your Business]";
  return (
    <div className="bg-gray-900 rounded-xl p-4 text-sm font-mono">
      <p className="text-gray-400 text-xs mb-2">Agent opening line:</p>
      <p className="text-green-400">
        &quot;Hi! This is {name}, an AI assistant for {biz}. How can I help you today?&quot;
      </p>
    </div>
  );
}

export default function Step7({ data, stepSequence, onEdit }: Props) {
  const allRows: Array<{ label: string; value: string; step: number }> = [
    { label: "Industry", value: data.niche ? nicheLabels[data.niche] : "—", step: 1 },
    { label: "Business", value: data.businessName || "—", step: 2 },
    { label: "Location", value: [data.streetAddress, data.city, data.state].filter(Boolean).join(", ") || "—", step: 2 },
    { label: "Agent name", value: data.agentName || "(using default)", step: 2 },
    { label: "Callback #", value: data.callbackPhone || "—", step: 2 },
    { label: "Hours", value: formatHoursDisplay(data), step: 3 },
    ...(data.afterHoursBehavior === "route_emergency" && data.emergencyPhone ? [{ label: "Emergency #", value: data.emergencyPhone, step: 3 }] : []),
    { label: "Notifications", value: data.notificationMethod, step: 5 },
    { label: "Caller auto-text", value: data.callerAutoText ? "On" : "Off", step: 5 },
    ...(data.pricingPolicy ? [{ label: "Pricing policy", value: data.pricingPolicy.replace(/_/g, " "), step: 6 }] : []),
    { label: "Primary goal", value: data.primaryGoal.replace(/_/g, " ") || "—", step: 6 },
    { label: "Agent tone", value: data.agentTone, step: 6 },
  ];
  const rows = allRows.filter(r => stepSequence.includes(r.step));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Review your setup</h2>
        <p className="text-sm text-gray-500 mt-1">
          Everything looks right? Hit Activate to go live.
        </p>
      </div>

      <AgentPreview data={data} />

      <div className="border rounded-xl overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between px-4 py-3 ${i < rows.length - 1 ? "border-b" : ""}`}
          >
            <span className="text-sm text-gray-500 w-32 shrink-0">{row.label}</span>
            <span className="text-sm text-gray-900 flex-1 truncate">{row.value}</span>
            <button
              type="button"
              onClick={() => onEdit(row.step)}
              className="text-xs text-blue-600 hover:text-blue-800 ml-3 shrink-0"
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      {Object.keys(data.nicheAnswers).length > 0 && stepSequence.includes(4) && (
        <div className="border rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b">
            <span className="text-sm font-medium text-gray-700">Industry Details</span>
            <button
              type="button"
              onClick={() => onEdit(4)}
              className="text-xs text-blue-600 hover:text-blue-800 ml-3"
            >
              Edit
            </button>
          </div>
          {Object.entries(data.nicheAnswers).map(([key, value]) => (
            <div key={key} className="flex items-start px-4 py-2.5 border-b last:border-b-0">
              <span className="text-sm text-gray-500 w-40 shrink-0">{camelToLabel(key)}</span>
              <span className="text-sm text-gray-900 flex-1">{formatNicheValue(value)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
        <p className="font-medium">After activation — 2 quick manual steps:</p>
        <p>1. Set up Telegram notifications (we&apos;ll send instructions)</p>
        <p>2. Forward your business phone to your new AI number (2-min guide included)</p>
      </div>
    </div>
  );
}
