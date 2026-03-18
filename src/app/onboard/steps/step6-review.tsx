"use client";

import { useState } from "react";
import { OnboardingData, nicheLabels, Niche, defaultAgentNames } from "@/types/onboarding";
import DemoCall from "@/components/DemoCall";

type BillingTier = "starter" | "growth" | "pro";

interface Props {
  data: OnboardingData;
  stepSequence: number[];
  onEdit: (step: number) => void;
  onActivate: (mode: "trial" | "paid", tier?: BillingTier) => void;
  isSubmitting: boolean;
  error: string | null;
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

const HANDLING_LABELS: Record<string, string> = {
  message_only: "Message taking",
  triage: "Triage + message",
  full_service: "Full service",
};

const AFTER_HOURS_LABELS: Record<string, string> = {
  take_message: "Take a message",
  standard: "Tell caller hours & take message",
  route_emergency: "Route to emergency line",
};

// ── Demo Call Section ────────────────────────────────────────────────────────

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
      <div className="rounded-xl p-5 border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30 space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
            style={{ backgroundColor: agentColor }}
          >
            {agentName[0]}
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">That&apos;s {agentName}.</p>
            <p className="text-xs text-muted-foreground">How did it sound?</p>
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
                  onClick={() => {
                    setFeedback(key);
                    // TODO: wire onUpdate once prop is added to Step6Review:
                    // if (key === "friendly") onUpdate({ agentTone: "casual" });
                    // if (key === "professional") onUpdate({ agentTone: "professional" });
                    // "perfect" requires no data change
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all hover:opacity-80 cursor-pointer ${
                    key === "perfect"
                      ? "text-white"
                      : "bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  }`}
                  style={
                    key === "perfect"
                      ? { backgroundColor: agentColor, color: "#fff", borderColor: agentColor }
                      : undefined
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPhase("prompt")}
              className="w-full text-xs text-muted-foreground/70 hover:text-muted-foreground py-1 cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="rounded-lg bg-card border border-indigo-100 dark:border-indigo-800 px-4 py-3 space-y-1">
            {feedback === "perfect" ? (
              <p className="text-sm font-medium text-foreground">You&apos;re all set.</p>
            ) : (
              <p className="text-sm font-medium text-foreground">
                {feedback === "friendly" ? "Want a friendlier tone?" : "Want a more professional tone?"}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              You can tune {agentName}&apos;s tone, voice, and behavior anytime in{" "}
              <span className="font-medium text-indigo-600 dark:text-indigo-400">Settings</span> after activation.
            </p>
          </div>
        )}
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
          <p className="font-semibold text-foreground">{agentName} is ready for {companyName}</p>
          <p className="text-sm text-muted-foreground">Hear exactly what your callers will hear</p>
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
      <p className="text-xs text-center mt-2 text-muted-foreground/70">Uses your mic · No sign-up needed</p>
    </div>
  );
}

// ── Admin Prompt Preview ─────────────────────────────────────────────────────

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
        className="w-full text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors disabled:opacity-50 cursor-pointer"
      >
        {loading ? "Generating preview..." : showPrompt ? "Hide Prompt Preview" : "Preview Agent Prompt"}
      </button>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 px-1">{error}</p>
      )}

      {preview && showPrompt && (
        <div className="border border-indigo-200 dark:border-indigo-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-950/30 border-b border-indigo-200 dark:border-indigo-800 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">System Prompt</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              preview.valid
                ? "bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                : "bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
            }`}>
              {preview.valid ? "Valid" : "Invalid"}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground bg-muted border border-border rounded-full px-2 py-0.5">
              {preview.charCount.toLocaleString()} chars
            </span>
            <span className="text-[10px] font-medium text-indigo-500 bg-indigo-100 border border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950/30 dark:border-indigo-800 rounded-full px-2 py-0.5">
              {preview.niche.replace(/_/g, " ")}
            </span>
          </div>

          {preview.errors.length > 0 && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800">
              {preview.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700 dark:text-red-400">{e}</p>
              ))}
            </div>
          )}
          {preview.warnings.length > 0 && (
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
              {preview.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-400">{w}</p>
              ))}
            </div>
          )}

          <pre className="px-4 py-3 text-xs text-foreground bg-card max-h-96 overflow-y-auto whitespace-pre-wrap break-words font-mono leading-relaxed">
            {preview.prompt}
          </pre>

          <div className="px-4 py-3 bg-muted/30 border-t">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">SMS Follow-up Template</p>
            <p className="text-xs text-foreground bg-card rounded-lg px-3 py-2 border">{preview.smsTemplate}</p>
          </div>

          <div className="px-4 py-3 bg-muted/30 border-t">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Classification Rules (HOT/WARM/COLD)</p>
            <p className="text-xs text-foreground bg-card rounded-lg px-3 py-2 border">{preview.classificationRules}</p>
          </div>

          <div className="px-4 py-3 bg-muted/30 border-t">
            <button
              type="button"
              onClick={() => setShowDebug(!showDebug)}
              className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
            >
              {showDebug ? "Hide" : "Show"} Variable Sources ({Object.keys(preview.variableDebug.fromIntake).length} from intake, {Object.keys(preview.variableDebug.fromDefaults).length} defaults)
            </button>
            {showDebug && (
              <div className="mt-2 max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-1 font-medium">Variable</th>
                      <th className="pb-1 font-medium">Source</th>
                      <th className="pb-1 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(preview.variableDebug.fromIntake).map(([key, val]) => (
                      <tr key={`i-${key}`} className="border-t border-border">
                        <td className="py-1 font-mono text-foreground">{key}</td>
                        <td className="py-1"><span className="text-emerald-600 dark:text-emerald-400 font-medium">intake</span></td>
                        <td className="py-1 text-muted-foreground truncate max-w-[200px]">{val}</td>
                      </tr>
                    ))}
                    {Object.entries(preview.variableDebug.fromDefaults).map(([key, val]) => (
                      <tr key={`d-${key}`} className="border-t border-border">
                        <td className="py-1 font-mono text-foreground">{key}</td>
                        <td className="py-1"><span className="text-muted-foreground/70 font-medium">default</span></td>
                        <td className="py-1 text-muted-foreground/70 truncate max-w-[200px]">{val}</td>
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

// ── Main Step 6 — Review & Activate ──────────────────────────────────────────

const TIERS: { id: BillingTier; name: string; price: number; minutes: number; popular?: boolean }[] = [
  { id: "starter", name: "Starter", price: 49, minutes: 100 },
  { id: "growth",  name: "Growth",  price: 99, minutes: 250, popular: true },
  { id: "pro",     name: "Pro",     price: 199, minutes: 500 },
];

export default function Step6Review({ data, stepSequence, onEdit, onActivate, isSubmitting, error }: Props) {
  const [selectedTier, setSelectedTier] = useState<BillingTier>("starter");

  // ── Completeness score ──────────────────────────────────────────────────────
  const defaultAgentName = data.niche ? (defaultAgentNames[data.niche as Niche] ?? "") : "";
  const agentNameCustomized = data.agentName.trim() !== "" && data.agentName.trim() !== defaultAgentName;
  const faqHasPair = data.faqPairs.some(p => p.question.trim() && p.answer.trim());

  let completeness = 20; // base
  if (data.servicesOffered.trim()) completeness += 10;
  if (data.businessHoursText.trim()) completeness += 10;
  if (faqHasPair) completeness += 10;
  if (data.knowledgeDocs.length > 0) completeness += 10;
  if (agentNameCustomized) completeness += 10;
  if (data.callbackPhone.trim()) completeness += 10;
  if (data.contactEmail.trim()) completeness += 20;

  // ── Summary rows ────────────────────────────────────────────────────────────
  const rows: Array<{ label: string; value: string; editStep: number }> = [
    { label: "Industry", value: data.niche ? nicheLabels[data.niche as Niche] : "---", editStep: 1 },
    { label: "Voice", value: data.voiceName || "Default", editStep: 2 },
    { label: "Agent name", value: data.agentName || "(using default)", editStep: 2 },
    { label: "Business", value: data.businessName || "---", editStep: 3 },
    { label: "Location", value: [data.city, data.state].filter(Boolean).join(", ") || "---", editStep: 3 },
    { label: "Callback #", value: data.callbackPhone || "---", editStep: 3 },
    ...(data.servicesOffered.trim() ? [{ label: "Services", value: data.servicesOffered, editStep: 3 }] : []),
    ...(data.businessHoursText.trim() ? [{ label: "Hours", value: data.businessHoursText, editStep: 3 }] : []),
    { label: "After hours", value: AFTER_HOURS_LABELS[data.afterHoursBehavior] || data.afterHoursBehavior, editStep: 5 },
    { label: "SMS follow-up", value: data.callerAutoText ? "On" : "Off", editStep: 5 },
    { label: "Call handling", value: HANDLING_LABELS[data.callHandlingMode] || data.callHandlingMode, editStep: 5 },
    { label: "Knowledge docs", value: data.knowledgeDocs.length > 0 ? `${data.knowledgeDocs.length} file${data.knowledgeDocs.length !== 1 ? "s" : ""}` : "None", editStep: 4 },
    { label: "FAQ pairs", value: data.faqPairs.length > 0 ? `${data.faqPairs.length} pair${data.faqPairs.length !== 1 ? "s" : ""}` : "None", editStep: 4 },
  ];

  // Only show rows whose edit step is in the step sequence
  const visibleRows = rows.filter(r => stepSequence.includes(r.editStep));

  // ── No-FAQ warning ──────────────────────────────────────────────────────────
  const showNoFaqWarning = data.faqPairs.length === 0 && data.knowledgeDocs.length === 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Review your setup</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Everything looks right? Activate to go live, or start a free trial.
        </p>
      </div>

      {/* Ready badge */}
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3">
        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Your agent is ready to activate</p>
          {(completeness < 80) && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
              Add FAQs (+{faqHasPair ? 0 : 10}pts) or upload docs to improve accuracy
            </p>
          )}
        </div>
      </div>

      {/* No-FAQ warning */}
      {showNoFaqWarning && stepSequence.includes(4) && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5">
          <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-xs text-amber-800 dark:text-amber-200 flex-1">
            No FAQs or documents added. Your agent will use default responses.{" "}
            <button
              type="button"
              onClick={() => onEdit(4)}
              className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100 cursor-pointer"
            >
              Add FAQs in step 4
            </button>{" "}
            for better accuracy.
          </p>
        </div>
      )}

      {/* Demo call section */}
      <OnboardDemoSection data={data} />

      {/* Summary card */}
      <div className="overflow-x-auto rounded-xl">
      <div className="border rounded-xl overflow-hidden min-w-[320px]">
        {visibleRows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between px-4 py-3 ${i < visibleRows.length - 1 ? "border-b" : ""}`}
          >
            <span className="text-sm text-muted-foreground w-32 shrink-0">{row.label}</span>
            <span className="text-sm text-foreground flex-1 truncate">{row.value}</span>
            <button
              type="button"
              onClick={() => onEdit(row.editStep)}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 ml-3 shrink-0 cursor-pointer py-1.5 px-2 -my-1.5 -mr-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
            >
              Edit
            </button>
          </div>
        ))}
      </div>
      </div>

      {/* Niche-specific answers (if step 4 was part of the flow) */}
      {Object.keys(data.nicheAnswers).length > 0 && stepSequence.includes(4) && (
        <div className="border rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-muted/30 border-b">
            <span className="text-sm font-medium text-foreground">Industry Details</span>
            <button
              type="button"
              onClick={() => onEdit(4)}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 ml-3 shrink-0 cursor-pointer py-1.5 px-2 -my-1.5 -mr-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
            >
              Edit
            </button>
          </div>
          {Object.entries(data.nicheAnswers).map(([key, value]) => (
            <div key={key} className="flex items-start px-4 py-2.5 border-b last:border-b-0">
              <span className="text-sm text-muted-foreground w-40 shrink-0">
                {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()}
              </span>
              <span className="text-sm text-foreground flex-1">
                {typeof value === "boolean" ? (value ? "Yes" : "No") : Array.isArray(value) ? value.join(", ") : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Admin-only prompt preview */}
      <PromptPreview data={data} />

      {/* Pricing tiers */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Choose your plan</p>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTier(t.id)}
              className={`relative rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
                selectedTier === t.id
                  ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30"
                  : "border-border hover:border-indigo-300 bg-card"
              }`}
            >
              {t.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                  Popular
                </span>
              )}
              <p className="font-bold text-foreground text-sm">{t.name}</p>
              <p className="text-indigo-600 dark:text-indigo-400 text-lg font-bold">${t.price}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground mt-1">{t.minutes} min/mo</p>
            </button>
          ))}
        </div>
      </div>

      {/* What you're getting — preview before payment */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 space-y-5">
        {/* Included features */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">What you&apos;re getting</h3>
          <ul className="space-y-2">
            {[
              { text: "Dedicated phone number for your business", show: true },
              { text: `AI agent trained on your industry (${data.niche ? nicheLabels[data.niche as Niche] : "your niche"})`, show: true },
              { text: "SMS follow-up to every caller", show: !!data.callerAutoText },
              { text: "Telegram/email notifications for every call", show: true },
              { text: "Voicemail-to-email transcripts", show: data.niche === "voicemail" },
              { text: `${data.faqPairs.filter(p => p.question.trim() && p.answer.trim()).length} FAQ answers loaded`, show: data.faqPairs.some(p => p.question.trim() && p.answer.trim()) },
              { text: `${data.knowledgeDocs.length} knowledge document${data.knowledgeDocs.length !== 1 ? "s" : ""} uploaded`, show: data.knowledgeDocs.length > 0 },
            ]
              .filter(item => item.show)
              .map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-foreground">{item.text}</span>
                </li>
              ))}
          </ul>
        </div>

        {/* What happens next — 3-step timeline */}
        <div className="border-t border-indigo-200 dark:border-indigo-800 pt-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">What happens next</h3>
          <div className="space-y-3">
            {[
              { step: "1", title: "Pay & activate", desc: "Your agent goes live in ~2 minutes" },
              { step: "2", title: "Forward your phone", desc: "We'll send a step-by-step guide for your carrier" },
              { step: "3", title: "Start receiving calls", desc: "Every call is answered, summarized, and sent to you" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-white">{item.step}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Trial card */}
        <button
          type="button"
          onClick={() => onActivate("trial")}
          disabled={isSubmitting}
          className="rounded-xl border-2 border-indigo-600 bg-indigo-600 hover:bg-indigo-700 hover:border-indigo-700 p-4 text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="space-y-1">
            <p className="text-white font-bold text-base leading-tight">
              {isSubmitting ? "Activating..." : "Start free trial"}
            </p>
            <p className="text-indigo-100 text-xs font-medium">7 days · No credit card</p>
            <p className="text-indigo-200 text-xs mt-2">Demo call included · Forwarding guide sent</p>
          </div>
        </button>

        {/* Paid card */}
        <button
          type="button"
          onClick={() => onActivate("paid", selectedTier)}
          disabled={isSubmitting}
          className="rounded-xl border-2 border-border hover:border-indigo-400 bg-card hover:bg-muted/30 p-4 text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="space-y-1">
            <p className="text-foreground font-bold text-base leading-tight">Activate now</p>
            <p className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
              ${TIERS.find(t => t.id === selectedTier)?.price ?? 49} / month · {TIERS.find(t => t.id === selectedTier)?.minutes ?? 100} min
            </p>
            <p className="text-muted-foreground text-xs mt-2">Real number · Full SMS · Live today</p>
          </div>
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
      )}

      {/* Post-activation notes */}
      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 space-y-1">
        <p className="font-medium">After activation — 2 quick manual steps:</p>
        <p>1. Set up Telegram notifications (we&apos;ll send instructions)</p>
        <p>2. Forward your business phone to your new AI number (2-min guide included)</p>
      </div>
    </div>
  );
}
