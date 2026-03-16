"use client";

import { useState } from "react";
import { OnboardingData, nicheLabels } from "@/types/onboarding";
import DemoCall from "@/components/DemoCall";

interface Props {
  data: OnboardingData;
  stepSequence: number[];
  onEdit: (step: number) => void;
}

interface PreviewResult {
  prompt: string;
  charCount: number;
  valid: boolean;
  warnings: string[];
  errors: string[];
  niche: string;
  smsTemplate: string;
  classificationRules: string;
  variableDebug: {
    fromIntake: Record<string, string>;
    fromDefaults: Record<string, string>;
    merged: Record<string, string>;
  };
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

const NICHE_AGENT_NAME: Record<string, string> = {
  auto_glass: "Mark", hvac: "Mike", plumbing: "Dave", dental: "Ashley",
  legal: "Jordan", salon: "Jamie", real_estate: "Alex",
  property_management: "Alisha", outbound_isa_realtor: "Fatima",
  voicemail: "Sam", restaurant: "Jamie", other: "Sam",
};

const NICHE_COLOR: Record<string, string> = {
  auto_glass: "#3B82F6", hvac: "#F59E0B", plumbing: "#06B6D4",
  dental: "#8B5CF6", legal: "#6B7280", salon: "#EC4899",
  real_estate: "#10B981", property_management: "#8B5CF6",
  outbound_isa_realtor: "#10B981", voicemail: "#6366F1",
  restaurant: "#EF4444", other: "#6366F1",
};

function OnboardDemoSection({ data }: { data: OnboardingData }) {
  const [phase, setPhase] = useState<"prompt" | "calling" | "done">("prompt");
  const [feedback, setFeedback] = useState<string | null>(null);

  const niche = data.niche || "other";
  const agentName = data.agentName || NICHE_AGENT_NAME[niche] || "Sam";
  const companyName = data.businessName || "Your Business";
  const agentColor = NICHE_COLOR[niche] || "#6366F1";

  if (phase === "calling") {
    return (
      <DemoCall
        demoId="onboard-preview"
        callerName="you"
        agentName={agentName}
        companyName={companyName}
        agentColor={agentColor}
        extraBody={{ mode: "preview", onboardingData: data }}
        onEnd={() => setPhase("done")}
      />
    );
  }

  if (phase === "done") {
    return (
      <div className="rounded-xl p-5 border border-indigo-200 bg-indigo-50 space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
            style={{ backgroundColor: agentColor }}
          >
            {agentName[0]}
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">That&apos;s {agentName}.</p>
            <p className="text-xs text-slate-500">How did it sound?</p>
          </div>
        </div>

        {!feedback ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "friendly", label: "More friendly" },
                { key: "professional", label: "More professional" },
                { key: "perfect", label: "Sounds perfect!" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFeedback(key)}
                  className="py-2 px-3 rounded-lg text-xs font-medium border transition-all hover:opacity-80 cursor-pointer"
                  style={
                    key === "perfect"
                      ? { backgroundColor: agentColor, color: "#fff", borderColor: agentColor }
                      : { backgroundColor: "#fff", color: "#475569", borderColor: "#e2e8f0" }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPhase("prompt")}
              className="w-full text-xs text-slate-400 hover:text-slate-600 py-1 cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="rounded-lg bg-white border border-indigo-100 px-4 py-3 space-y-1">
            {feedback === "perfect" ? (
              <p className="text-sm font-medium text-slate-900">You&apos;re all set.</p>
            ) : (
              <p className="text-sm font-medium text-slate-900">
                {feedback === "friendly" ? "Want a friendlier tone?" : "Want a more professional tone?"}
              </p>
            )}
            <p className="text-xs text-slate-500">
              You can tune {agentName}&apos;s tone, voice, and behavior anytime in{" "}
              <span className="font-medium text-indigo-600">Settings</span> after activation.
            </p>
          </div>
        )}

        <p className="text-xs text-center text-slate-400">
          Hit <span className="font-medium text-indigo-600">Activate My Agent</span> below to go live.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-5 border"
      style={{ borderColor: agentColor + "40", backgroundColor: agentColor + "08" }}
    >
      <div className="flex items-center gap-4 mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
          style={{ backgroundColor: agentColor }}
        >
          {agentName[0]}
        </div>
        <div>
          <p className="font-semibold text-slate-900">{agentName} is ready for {companyName}</p>
          <p className="text-sm text-slate-500">Hear exactly what your callers will hear</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPhase("calling")}
        className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 cursor-pointer"
        style={{ backgroundColor: agentColor }}
      >
        Talk to {agentName} — Free 2-min demo
      </button>
      <p className="text-xs text-center mt-2 text-slate-400">Uses your mic · No sign-up needed</p>
    </div>
  );
}

function PromptPreview({ data }: { data: OnboardingData }) {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [hidden, setHidden] = useState(false);

  const fetchPreview = async () => {
    if (preview) {
      setShowPrompt(!showPrompt);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/preview-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.status === 401 || res.status === 403) {
        setHidden(true);
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Preview failed (${res.status})`);
      }
      const result: PreviewResult = await res.json();
      setPreview(result);
      setShowPrompt(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  if (hidden) return null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={fetchPreview}
        disabled={loading}
        className="w-full text-sm font-medium text-indigo-600 border border-indigo-200 rounded-xl px-4 py-2.5 hover:bg-indigo-50 transition-colors disabled:opacity-50 cursor-pointer"
      >
        {loading ? "Generating preview..." : showPrompt ? "Hide Prompt Preview" : "Preview Agent Prompt"}
      </button>

      {error && (
        <p className="text-xs text-red-600 px-1">{error}</p>
      )}

      {preview && showPrompt && (
        <div className="border border-indigo-200 rounded-xl overflow-hidden">
          {/* Header with badges */}
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-200 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-indigo-700">System Prompt</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              preview.valid
                ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                : "bg-red-100 text-red-700 border border-red-300"
            }`}>
              {preview.valid ? "Valid" : "Invalid"}
            </span>
            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
              {preview.charCount.toLocaleString()} chars
            </span>
            <span className="text-[10px] font-medium text-indigo-500 bg-indigo-100 border border-indigo-200 rounded-full px-2 py-0.5">
              {preview.niche.replace(/_/g, " ")}
            </span>
          </div>

          {/* Warnings/errors */}
          {preview.errors.length > 0 && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-200">
              {preview.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700">{e}</p>
              ))}
            </div>
          )}
          {preview.warnings.length > 0 && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
              {preview.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">{w}</p>
              ))}
            </div>
          )}

          {/* Full prompt */}
          <pre className="px-4 py-3 text-xs text-gray-800 bg-white max-h-96 overflow-y-auto whitespace-pre-wrap break-words font-mono leading-relaxed">
            {preview.prompt}
          </pre>

          {/* SMS Template */}
          <div className="px-4 py-3 bg-gray-50 border-t">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">SMS Follow-up Template</p>
            <p className="text-xs text-gray-700 bg-white rounded-lg px-3 py-2 border">{preview.smsTemplate}</p>
          </div>

          {/* Classification Rules */}
          <div className="px-4 py-3 bg-gray-50 border-t">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Classification Rules (HOT/WARM/COLD)</p>
            <p className="text-xs text-gray-700 bg-white rounded-lg px-3 py-2 border">{preview.classificationRules}</p>
          </div>

          {/* Variable Debug */}
          <div className="px-4 py-3 bg-gray-50 border-t">
            <button
              type="button"
              onClick={() => setShowDebug(!showDebug)}
              className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider hover:text-indigo-800 cursor-pointer"
            >
              {showDebug ? "Hide" : "Show"} Variable Sources ({Object.keys(preview.variableDebug.fromIntake).length} from intake, {Object.keys(preview.variableDebug.fromDefaults).length} defaults)
            </button>
            {showDebug && (
              <div className="mt-2 max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pb-1 font-medium">Variable</th>
                      <th className="pb-1 font-medium">Source</th>
                      <th className="pb-1 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(preview.variableDebug.fromIntake).map(([key, val]) => (
                      <tr key={`i-${key}`} className="border-t border-gray-100">
                        <td className="py-1 font-mono text-gray-700">{key}</td>
                        <td className="py-1"><span className="text-emerald-600 font-medium">intake</span></td>
                        <td className="py-1 text-gray-600 truncate max-w-[200px]">{val}</td>
                      </tr>
                    ))}
                    {Object.entries(preview.variableDebug.fromDefaults).map(([key, val]) => (
                      <tr key={`d-${key}`} className="border-t border-gray-100">
                        <td className="py-1 font-mono text-gray-700">{key}</td>
                        <td className="py-1"><span className="text-gray-400 font-medium">default</span></td>
                        <td className="py-1 text-gray-400 truncate max-w-[200px]">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
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

      <OnboardDemoSection data={data} />

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

      <PromptPreview data={data} />

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
        <p className="font-medium">After activation — 2 quick manual steps:</p>
        <p>1. Set up Telegram notifications (we&apos;ll send instructions)</p>
        <p>2. Forward your business phone to your new AI number (2-min guide included)</p>
      </div>
    </div>
  );
}
