"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { OnboardingData, nicheLabels, Niche, defaultAgentNames, AfterHoursBehavior } from "@/types/onboarding";
import DemoCall from "@/components/DemoCall";
import { BETA_PROMO, BASE_PLAN, SETUP, TRIAL, getEffectiveMonthly } from "@/lib/pricing";

interface Props {
  data: OnboardingData;
  stepSequence: number[];
  onEdit: (step: number) => void;
  onActivate: (mode: "trial" | "paid") => void;
  onUpdate: (updates: Partial<OnboardingData>) => void;
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
  restaurant: "#EF4444", print_shop: "#0EA5E9", other: "#6366F1",
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

const VOICE_OPTIONS = [
  { id: "aa601962-1cbd-4bbd-9d96-3c7a93c3414a", name: "Jacqueline" },
  { id: "87edb04c-06d4-47c2-bd94-683bc47e8fbe", name: "Monika" },
  { id: "df0b14d7-945f-41b2-989a-7c8c57688ddf", name: "Ashley" },
  { id: "b0e6b5c1-3100-44d5-8578-9015aa3023ae", name: "Mark" },
  { id: "d766b9e3-69df-4727-b62f-cd0b6772c2ad", name: "Nour" },
  { id: "7d0bcff3-77ec-48ea-83d6-40ca0095e80c", name: "Terrence" },
];

const PROVINCE_AREA_CODES: Record<string, string> = {
  AB: "403/587/825", BC: "604/778/236", SK: "306/639",
  ON: "416/647/905", QC: "514/438/418", MB: "204/431",
  NS: "902", NB: "506", NL: "709", PE: "902",
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
                      : "bg-card t3 border-[var(--color-border)]"
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
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className="py-8 text-center space-y-5"
    >
      {/* Animated CSS orb */}
      <div className="relative mx-auto" style={{ width: 96, height: 96 }}>
        <div
          className="absolute inset-0 rounded-full motion-safe:animate-ping"
          style={{ backgroundColor: agentColor, opacity: 0.2 }}
        />
        <div
          className="absolute inset-0 rounded-full motion-safe:animate-ping"
          style={{ backgroundColor: agentColor, opacity: 0.12, animationDelay: "0.75s" }}
        />
        <div
          className="relative w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg"
          style={{ backgroundColor: agentColor }}
        >
          {agentName[0]}
        </div>
      </div>

      {/* Hero text */}
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold text-foreground">
          {agentName} is ready for {companyName}
        </h2>
        <p className="text-sm text-muted-foreground">
          Talk to {agentName} and hear exactly what your callers will hear
        </p>
      </div>

      {/* Primary CTA */}
      <button
        type="button"
        onClick={() => setPhase("calling")}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 cursor-pointer shadow-md"
        style={{ backgroundColor: agentColor }}
      >
        Talk to {agentName} — Free 2-min preview
      </button>
      <p className="text-xs text-muted-foreground/70">Uses your mic · No credit card needed</p>
    </motion.div>
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

// ── Inline Editor Sub-Components ─────────────────────────────────────────────

function InlineTextEditor({
  value,
  onSave,
  onCancel,
  type = "text",
  placeholder,
  label,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  type?: string;
  placeholder?: string;
  label: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <input
        ref={ref}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(draft);
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        aria-label={label}
        className="flex-1 min-w-0 bg-background border border-input rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
      />
      <button type="button" onClick={() => onSave(draft)} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 cursor-pointer rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
        Save
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 cursor-pointer rounded-md hover:bg-muted/50 transition-colors">
        Cancel
      </button>
    </div>
  );
}

function InlineSelectEditor({
  value,
  options,
  onSave,
  onCancel,
  label,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string) => void;
  onCancel: () => void;
  label: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <select
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        aria-label={label}
        className="flex-1 min-w-0 bg-background border border-input rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button type="button" onClick={() => onSave(draft)} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 cursor-pointer rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
        Save
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 cursor-pointer rounded-md hover:bg-muted/50 transition-colors">
        Cancel
      </button>
    </div>
  );
}

function InlineToggleEditor({
  value,
  onSave,
  onCancel,
  label,
}: {
  value: boolean;
  onSave: (v: boolean) => void;
  onCancel: () => void;
  label: string;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setDraft(!draft)}
        role="switch"
        aria-checked={draft}
        aria-label={label}
        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
          draft ? "bg-indigo-600" : "bg-muted-foreground/30"
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            draft ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className="text-sm text-foreground">{draft ? "On" : "Off"}</span>
      <div className="flex items-center gap-1 ml-auto">
        <button type="button" onClick={() => onSave(draft)} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 cursor-pointer rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 cursor-pointer rounded-md hover:bg-muted/50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

function InlineLocationEditor({
  city,
  state,
  onSave,
  onCancel,
}: {
  city: string;
  state: string;
  onSave: (c: string, s: string) => void;
  onCancel: () => void;
}) {
  const [draftCity, setDraftCity] = useState(city);
  const [draftState, setDraftState] = useState(state);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSave(draftCity, draftState);
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
      <input
        ref={ref}
        type="text"
        value={draftCity}
        onChange={(e) => setDraftCity(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="City"
        aria-label="City"
        className="flex-1 min-w-[100px] bg-background border border-input rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
      />
      <input
        type="text"
        value={draftState}
        onChange={(e) => setDraftState(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Province"
        aria-label="Province"
        className="w-28 shrink-0 bg-background border border-input rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
      />
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onSave(draftCity, draftState)} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 cursor-pointer rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 cursor-pointer rounded-md hover:bg-muted/50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main Step 6 — Review & Activate ──────────────────────────────────────────

const effectivePrice = getEffectiveMonthly();

export default function Step6Review({ data, stepSequence, onEdit, onActivate, onUpdate, isSubmitting, error }: Props) {

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

  // ── Inline edit state ────────────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // ── Summary rows ────────────────────────────────────────────────────────────
  const rows: Array<{ label: string; value: string; editStep: number; fieldKey: string; inline: boolean }> = [
    { label: "Industry", value: data.niche ? nicheLabels[data.niche as Niche] : "---", editStep: 1, fieldKey: "niche", inline: true },
    { label: "Voice", value: data.voiceName || "Default", editStep: 2, fieldKey: "voice", inline: true },
    { label: "Agent name", value: data.agentName || "(using default)", editStep: 2, fieldKey: "agentName", inline: true },
    { label: "Business", value: data.businessName || "---", editStep: 1, fieldKey: "businessName", inline: true },
    { label: "Location", value: [data.city, data.state].filter(Boolean).join(", ") || "---", editStep: 1, fieldKey: "location", inline: true },
    { label: "Callback #", value: data.callbackPhone || "---", editStep: 1, fieldKey: "callbackPhone", inline: true },
    ...(data.servicesOffered.trim() ? [{ label: "Services", value: data.servicesOffered, editStep: 1, fieldKey: "services", inline: true }] : []),
    ...(data.businessHoursText.trim() ? [{ label: "Hours", value: data.businessHoursText, editStep: 1, fieldKey: "hours", inline: true }] : []),
    { label: "After hours", value: AFTER_HOURS_LABELS[data.afterHoursBehavior] || data.afterHoursBehavior, editStep: 2, fieldKey: "afterHours", inline: true },
    { label: "SMS follow-up", value: data.callerAutoText ? "On" : "Off", editStep: 2, fieldKey: "smsFollowUp", inline: true },
    { label: "Voicemail menu", value: data.ivrEnabled ? "On" : "Off", editStep: 2, fieldKey: "ivrMenu", inline: true },
    { label: "Call handling", value: HANDLING_LABELS[data.callHandlingMode] || data.callHandlingMode, editStep: 2, fieldKey: "callHandling", inline: true },
    { label: "Knowledge docs", value: data.knowledgeDocs.length > 0 ? `${data.knowledgeDocs.length} file${data.knowledgeDocs.length !== 1 ? "s" : ""}` : "None", editStep: 4, fieldKey: "knowledgeDocs", inline: false },
    { label: "FAQ pairs", value: data.faqPairs.length > 0 ? `${data.faqPairs.length} pair${data.faqPairs.length !== 1 ? "s" : ""}` : "None", editStep: 4, fieldKey: "faqPairs", inline: false },
  ];

  // Only show rows whose edit step is in the step sequence
  const visibleRows = rows.filter(r => stepSequence.includes(r.editStep));

  // ── Inline editor renderer ────────────────────────────────────────────────
  const cancel = () => setEditingField(null);

  function renderEditor(fieldKey: string, label: string) {
    switch (fieldKey) {
      case "niche":
        return (
          <InlineSelectEditor
            value={data.niche || "other"}
            options={Object.entries(nicheLabels).map(([k, v]) => ({ value: k, label: v }))}
            onSave={(v) => { onUpdate({ niche: v as Niche }); setEditingField(null); }}
            onCancel={cancel}
            label={label}
          />
        );
      case "voice":
        return (
          <InlineSelectEditor
            value={data.voiceId || ""}
            options={[
              { value: "", label: "Default" },
              ...VOICE_OPTIONS.map((v) => ({ value: v.id, label: v.name })),
            ]}
            onSave={(v) => {
              const voice = VOICE_OPTIONS.find((vo) => vo.id === v);
              onUpdate({ voiceId: v || null, voiceName: voice?.name || "" });
              setEditingField(null);
            }}
            onCancel={cancel}
            label={label}
          />
        );
      case "agentName":
        return (
          <InlineTextEditor
            value={data.agentName}
            onSave={(v) => { onUpdate({ agentName: v }); setEditingField(null); }}
            onCancel={cancel}
            placeholder="Agent name"
            label={label}
          />
        );
      case "businessName":
        return (
          <InlineTextEditor
            value={data.businessName}
            onSave={(v) => { onUpdate({ businessName: v }); setEditingField(null); }}
            onCancel={cancel}
            placeholder="Business name"
            label={label}
          />
        );
      case "location":
        return (
          <InlineLocationEditor
            city={data.city}
            state={data.state}
            onSave={(c, s) => { onUpdate({ city: c, state: s }); setEditingField(null); }}
            onCancel={cancel}
          />
        );
      case "callbackPhone":
        return (
          <InlineTextEditor
            value={data.callbackPhone}
            onSave={(v) => { onUpdate({ callbackPhone: v }); setEditingField(null); }}
            onCancel={cancel}
            type="tel"
            placeholder="(555) 123-4567"
            label={label}
          />
        );
      case "services":
        return (
          <InlineTextEditor
            value={data.servicesOffered}
            onSave={(v) => { onUpdate({ servicesOffered: v }); setEditingField(null); }}
            onCancel={cancel}
            placeholder="Services offered"
            label={label}
          />
        );
      case "hours":
        return (
          <InlineTextEditor
            value={data.businessHoursText}
            onSave={(v) => { onUpdate({ businessHoursText: v }); setEditingField(null); }}
            onCancel={cancel}
            placeholder="e.g. Mon-Fri 9am-5pm"
            label={label}
          />
        );
      case "afterHours":
        return (
          <InlineSelectEditor
            value={data.afterHoursBehavior}
            options={Object.entries(AFTER_HOURS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            onSave={(v) => { onUpdate({ afterHoursBehavior: v as AfterHoursBehavior }); setEditingField(null); }}
            onCancel={cancel}
            label={label}
          />
        );
      case "smsFollowUp":
        return (
          <InlineToggleEditor
            value={data.callerAutoText}
            onSave={(v) => { onUpdate({ callerAutoText: v }); setEditingField(null); }}
            onCancel={cancel}
            label={label}
          />
        );
      case "ivrMenu":
        return (
          <InlineToggleEditor
            value={data.ivrEnabled}
            onSave={(v) => { onUpdate({ ivrEnabled: v }); setEditingField(null); }}
            onCancel={cancel}
            label={label}
          />
        );
      case "callHandling":
        return (
          <InlineSelectEditor
            value={data.callHandlingMode}
            options={Object.entries(HANDLING_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            onSave={(v) => { onUpdate({ callHandlingMode: v as "message_only" | "triage" | "full_service" }); setEditingField(null); }}
            onCancel={cancel}
            label={label}
          />
        );
      default:
        return null;
    }
  }

  // ── No-FAQ warning ──────────────────────────────────────────────────────────
  const showNoFaqWarning = data.faqPairs.length === 0 && data.knowledgeDocs.length === 0;

  // ── Area code hint ──────────────────────────────────────────────────────────
  const province = (data.state || "").toUpperCase().trim();
  const areaCodeHint = PROVINCE_AREA_CODES[province] || null;

  return (
    <div className="space-y-5">
      {/* Orb hero — idle phase is the hero reveal moment */}
      <OnboardDemoSection data={data} />

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

      {/* Website scanned — compact summary (full preview now on Knowledge step) */}
      {data.websiteUrl && (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
          <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <p className="text-sm text-foreground flex-1">
            Website scanned{" "}
            {stepSequence.includes(4) && (
              <button
                type="button"
                onClick={() => onEdit(4)}
                className="text-indigo-600 dark:text-indigo-400 font-medium underline underline-offset-2 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
              >
                review in Knowledge
              </button>
            )}
          </p>
        </div>
      )}

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
              Add FAQs in Knowledge
            </button>{" "}
            for better accuracy.
          </p>
        </div>
      )}

      {/* Collapsible configuration — hidden by default so the CTA is the focus */}
      <div>
        <button
          type="button"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          aria-expanded={isSettingsOpen}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isSettingsOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          {isSettingsOpen ? "Hide configuration" : "Show configuration"}
        </button>

        {isSettingsOpen && (
          <div className="mt-3 space-y-4">
            {/* Summary card — inline editing */}
            <div className="overflow-x-auto rounded-xl">
            <div className="border rounded-xl overflow-hidden min-w-[320px]">
              {visibleRows.map((row, i) => {
                const isEditing = editingField === row.fieldKey;
                return (
                  <div
                    key={row.fieldKey}
                    className={`flex items-center px-4 py-3 transition-colors ${
                      i < visibleRows.length - 1 ? "border-b" : ""
                    } ${isEditing ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""}`}
                  >
                    <span className="text-sm text-muted-foreground w-32 shrink-0">{row.label}</span>
                    {isEditing ? (
                      renderEditor(row.fieldKey, row.label)
                    ) : (
                      <>
                        <span className="text-sm text-foreground flex-1 truncate">{row.value}</span>
                        <button
                          type="button"
                          onClick={() => row.inline ? setEditingField(row.fieldKey) : onEdit(row.editStep)}
                          aria-label={`Edit ${row.label}`}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 ml-3 shrink-0 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center -my-1.5 -mr-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
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
          </div>
        )}
      </div>

      {/* Pricing */}
      <div className="rounded-xl border-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">${effectivePrice}</span>
          <span className="text-sm text-muted-foreground">/mo</span>
          {BETA_PROMO.enabled && (
            <span className="ml-auto text-xs font-semibold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
              {BETA_PROMO.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {BASE_PLAN.minutes} min/mo included{BETA_PROMO.enabled && ` · Regular $${BASE_PLAN.monthly}/mo after beta`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          + ${SETUP.price} one-time setup ({SETUP.includes})
        </p>
        {areaCodeHint && (
          <p className="text-xs text-muted-foreground/70 mt-2">
            Your dedicated number will be a local Canadian number ({areaCodeHint} area)
          </p>
        )}
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
              {isSubmitting ? "Activating..." : `Start ${TRIAL.days}-day free trial`}
            </p>
            <p className="text-indigo-100 text-xs font-medium">{TRIAL.days} days · No credit card</p>
            <p className="text-indigo-200 text-xs mt-2">Demo call included · Forwarding guide sent</p>
          </div>
        </button>

        {/* Paid card */}
        <button
          type="button"
          onClick={() => onActivate("paid")}
          disabled={isSubmitting}
          className="rounded-xl border-2 border-border hover:border-indigo-400 bg-card hover:bg-muted/30 p-4 text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="space-y-1">
            <p className="text-foreground font-bold text-base leading-tight">Activate now</p>
            <p className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
              ${effectivePrice}/mo · {BASE_PLAN.minutes} min
            </p>
            <p className="text-muted-foreground text-xs mt-2">Real number · Full SMS · Live today</p>
          </div>
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
