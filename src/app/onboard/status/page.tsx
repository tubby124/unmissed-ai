"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const LiveTestCall = lazy(() => import("@/components/admin/LiveTestCall"));

// ── Activation progress steps ──────────────────────────────────────────────
const ACTIVATION_STEPS = [
  "Creating your AI agent...",
  "Setting up your phone number...",
  "Configuring your account...",
  "Almost done...",
];

function ActivationProgress({ active, done }: { active: boolean; done: boolean }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!active) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (!done) setVisibleCount(0);
      return;
    }
    setVisibleCount(1);
    const delays = [1500, 3000, 5500];
    const timers = delays.map((delay, i) =>
      setTimeout(() => setVisibleCount(i + 2), delay)
    );
    timersRef.current = timers;
    return () => timers.forEach(clearTimeout);
  }, [active, done]);

  useEffect(() => {
    if (done) setVisibleCount(ACTIVATION_STEPS.length);
  }, [done]);

  if (visibleCount === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      {ACTIVATION_STEPS.slice(0, visibleCount).map((step, i) => {
        const isLast = i === visibleCount - 1;
        const completed = done || !isLast;
        return (
          <div
            key={i}
            className="flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-1 duration-300"
          >
            {completed ? (
              <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="animate-spin w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span className={completed ? "text-emerald-700" : "text-muted-foreground"}>
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Dark-themed variant for the success screen
function ActivationProgressDark({ active, done }: { active: boolean; done: boolean }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!active) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (!done) setVisibleCount(0);
      return;
    }
    setVisibleCount(1);
    const delays = [1500, 3500, 6000];
    const timers = delays.map((delay, i) =>
      setTimeout(() => setVisibleCount(i + 2), delay)
    );
    timersRef.current = timers;
    return () => timers.forEach(clearTimeout);
  }, [active, done]);

  useEffect(() => {
    if (done) setVisibleCount(ACTIVATION_STEPS.length);
  }, [done]);

  if (visibleCount === 0) return null;

  return (
    <div className="space-y-2.5">
      {ACTIVATION_STEPS.slice(0, visibleCount).map((step, i) => {
        const isLast = i === visibleCount - 1;
        const completed = done || !isLast;
        return (
          <div key={i} className="flex items-center gap-2.5 text-sm">
            {completed ? (
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="animate-spin w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span className={completed ? "text-emerald-400/80" : "text-slate-400"}>
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface InventoryNumber {
  phone_number: string;
  display: string;
  province: string | null;
  area_code: string | null;
  country: string;
}

interface AdminResult {
  clientId: string;
  agentId: string;
  clientSlug: string;
  twilioNumber: string | null;
  authUserId: string | null;
  prompt: string;
  promptCharCount: number;
  smsTemplate: string;
  telegramLink: string;
}

function AdminTestPanel({ intakeId }: { intakeId: string }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activating, setActivating] = useState(false);
  const [result, setResult] = useState<AdminResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleaned, setCleaned] = useState(false);

  // Prompt editing + test call state
  const [editablePrompt, setEditablePrompt] = useState("");
  const [promptDirty, setPromptDirty] = useState(false);
  const [testCallJoinUrl, setTestCallJoinUrl] = useState<string | null>(null);
  const [testCallLoading, setTestCallLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(false);

  // Activation options
  const [buyNumber, setBuyNumber] = useState(false);

  // Test email
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  // Prevent duplicate admin check in React Strict Mode (double-mount)
  const adminCheckRef = useRef(false);
  useEffect(() => {
    if (adminCheckRef.current) return;
    adminCheckRef.current = true;
    fetch("/api/admin/check")
      .then((r) => r.json())
      .then((j) => setIsAdmin(j.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, []);

  if (!isAdmin) return null;

  async function handleActivate() {
    setActivating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/test-activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeId, skipTwilio: !buyNumber }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error || `Activation failed (${res.status})`);
      setResult(json);
      setEditablePrompt(json.prompt);
      setPromptDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setActivating(false);
    }
  }

  async function handleTestCall() {
    setTestCallLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/test-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: editablePrompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create test call");
      setTestCallJoinUrl(json.joinUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test call failed");
    } finally {
      setTestCallLoading(false);
    }
  }

  async function handleSavePrompt() {
    if (!result) return;
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/save-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSlug: result.clientSlug,
          agentId: result.agentId,
          prompt: editablePrompt,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setPromptDirty(false);
      setSaveMessage("Saved to Supabase + Ultravox agent");
      setResult({ ...result, promptCharCount: editablePrompt.length, prompt: editablePrompt });
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    if (!result) return;
    setSendingEmail(true);
    setEmailMessage(null);
    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientSlug: result.clientSlug }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Email failed");
      setEmailMessage(`Sent to ${json.sentTo}`);
      setTimeout(() => setEmailMessage(null), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email failed");
    } finally {
      setSendingEmail(false);
    }
  }

  function handleResetPrompt() {
    if (!result) return;
    setEditablePrompt(result.prompt);
    setPromptDirty(false);
  }

  async function handleCleanup() {
    if (!result) return;
    setCleaning(true);
    try {
      const res = await fetch("/api/admin/cleanup-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientSlug: result.clientSlug, deleteUltravox: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Cleanup failed");
      setCleaned(true);
      setResult(null);
      setEditablePrompt("");
      setTestCallJoinUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div className="border-2 border-amber-300 bg-amber-50 rounded-xl p-4 text-left space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Admin Testing</span>
        <span className="text-[10px] text-amber-500 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">Skip Stripe</span>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {saveMessage && <p className="text-xs text-emerald-600 font-medium">{saveMessage}</p>}

      {cleaned && (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
          <p className="font-medium">Cleaned up. Ultravox agent deleted, DB rows removed. Intake preserved.</p>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setCleaned(false); setError(null); }}
              className="text-xs font-semibold text-amber-800 bg-amber-200 hover:bg-amber-300 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
            >
              Re-activate same intake
            </button>
            <a href="/onboard" className="text-xs text-indigo-600 font-medium hover:text-indigo-800 underline underline-offset-2 self-center">
              Start fresh
            </a>
          </div>
        </div>
      )}

      {!result && !cleaned && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-amber-800 cursor-pointer">
            <input
              type="checkbox"
              checked={buyNumber}
              onChange={(e) => setBuyNumber(e.target.checked)}
              className="accent-amber-600"
            />
            Buy a real Twilio number (costs ~$1.15/mo)
          </label>
          <button
            onClick={handleActivate}
            disabled={activating}
            className="w-full text-sm font-semibold text-amber-800 bg-amber-200 hover:bg-amber-300 disabled:opacity-50 rounded-lg px-4 py-2.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {activating ? "Activating..." : `Test Activate — Skip Payment${buyNumber ? " (will buy number)" : ""}`}
          </button>
          <ActivationProgress active={activating} done={!!result} />
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Result summary */}
          <div className="bg-background border border-amber-200 rounded-lg p-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <span className="text-muted-foreground">Client slug</span>
              <span className="font-mono text-foreground">{result.clientSlug}</span>
              <span className="text-muted-foreground">Agent ID</span>
              <span className="font-mono text-foreground truncate">{result.agentId}</span>
              <span className="text-muted-foreground">Prompt length</span>
              <span className="text-foreground">{editablePrompt.length.toLocaleString()} chars{promptDirty && " (edited)"}</span>
              <span className="text-muted-foreground">Twilio</span>
              <span className="text-foreground">{result.twilioNumber || "Skipped"}</span>
              <span className="text-muted-foreground">Auth user</span>
              <span className="font-mono text-foreground truncate">{result.authUserId || "None"}</span>
              <span className="text-muted-foreground">Telegram</span>
              <span className="text-foreground">
                {result.telegramLink ? (
                  <a
                    href={result.telegramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2 break-all"
                  >
                    Open link
                  </a>
                ) : "Not generated"}
              </span>
            </div>
          </div>

          {/* Editable prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-800">System Prompt</span>
              <div className="flex items-center gap-2">
                {promptDirty && (
                  <span className="text-[10px] text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">unsaved</span>
                )}
                <button
                  onClick={() => setPromptExpanded(!promptExpanded)}
                  className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {promptExpanded ? "Collapse" : "Expand"}
                </button>
              </div>
            </div>
            <textarea
              value={editablePrompt}
              onChange={(e) => {
                setEditablePrompt(e.target.value);
                setPromptDirty(true);
              }}
              className={`w-full text-xs font-mono bg-background border border-amber-200 rounded-lg p-3 resize-y leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-amber-300 ${
                promptExpanded ? "h-96" : "h-48"
              }`}
              spellCheck={false}
            />
          </div>

          {/* Test Call + Save buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleTestCall}
              disabled={testCallLoading || !!testCallJoinUrl}
              className="flex-1 text-xs font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 disabled:opacity-50 rounded-lg px-3 py-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {testCallLoading ? "Starting call..." : testCallJoinUrl ? "Call active" : "Test Call (free, in browser)"}
            </button>
            {promptDirty && (
              <button
                onClick={handleSavePrompt}
                disabled={saving}
                className="flex-1 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-50 rounded-lg px-3 py-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save to Agent"}
              </button>
            )}
          </div>

          {/* Reset + Email row */}
          <div className="flex gap-2">
            {promptDirty && (
              <button
                onClick={handleResetPrompt}
                className="flex-1 text-xs font-medium text-muted-foreground border border-border rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                Reset to Original
              </button>
            )}
            <button
              onClick={handleTestEmail}
              disabled={sendingEmail}
              className="flex-1 text-xs font-medium text-violet-700 border border-violet-200 rounded-lg px-3 py-2 hover:bg-violet-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingEmail ? "Sending..." : "Send Test Email"}
            </button>
          </div>
          {emailMessage && <p className="text-xs text-violet-600 font-medium">{emailMessage}</p>}

          {/* Live test call */}
          {testCallJoinUrl && (
            <Suspense fallback={<div className="text-xs text-muted-foreground p-2">Loading call UI...</div>}>
              <LiveTestCall
                joinUrl={testCallJoinUrl}
                onEnd={() => setTestCallJoinUrl(null)}
              />
            </Suspense>
          )}

          {/* SMS template */}
          <details className="text-xs">
            <summary className="cursor-pointer text-amber-700 font-medium hover:text-amber-900">
              Show SMS template
            </summary>
            <p className="mt-2 bg-background border border-border rounded-lg p-3 text-foreground">{result.smsTemplate}</p>
          </details>

          {/* Actions */}
          <div className="flex gap-2">
            <a
              href="/dashboard"
              className="flex-1 text-center text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg px-3 py-2 hover:bg-indigo-50 transition-colors"
            >
              Open Dashboard
            </a>
            <button
              onClick={handleCleanup}
              disabled={cleaning}
              className="flex-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cleaning ? "Cleaning up..." : "Clean Up Test"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Niche labels + greetings for preview card ──────────────────────────────
const NICHE_LABELS: Record<string, string> = {
  auto_glass: "Auto Glass Shop",
  hvac: "HVAC / Heating & Cooling",
  plumbing: "Plumbing",
  dental: "Dental Office",
  legal: "Law Firm",
  salon: "Salon / Barbershop",
  real_estate: "Real Estate Agent",
  property_management: "Property Management",
  outbound_isa_realtor: "Realtor ISA (Outbound)",
  restaurant: "Restaurant / Food Service",
  voicemail: "Voicemail / Message Taking",
  other: "Other Business",
};

const DEFAULT_AGENT_NAMES: Record<string, string> = {
  auto_glass: "Mark", hvac: "Mike", plumbing: "Dave", dental: "Ashley",
  legal: "Jordan", salon: "Jamie", real_estate: "Alex",
  property_management: "Jade", outbound_isa_realtor: "Fatima",
  voicemail: "Sam", restaurant: "Sofia", other: "Sam",
};

function getSampleGreeting(niche: string, businessName: string, agentName: string): string {
  const biz = businessName || "your business";
  if (niche === "voicemail") {
    return `"Hey there, you've reached ${biz}. They can't come to the phone right now, but I can take a message for you."`;
  }
  return `"Hi, thanks for calling ${biz}! This is ${agentName}. How can I help you today?"`;
}

interface IntakePreview {
  businessName: string;
  niche: string;
  agentName: string;
  voiceId: string;
}

function AgentPreviewCard({ preview }: { preview: IntakePreview }) {
  const niche = preview.niche || "other";
  const agentName = preview.agentName || DEFAULT_AGENT_NAMES[niche] || "Sam";
  const businessName = preview.businessName || "Your Business";
  const nicheLabel = NICHE_LABELS[niche] || niche.replace(/_/g, " ");
  const voiceLabel = preview.voiceId ? "Custom voice selected" : "Auto (based on niche)";
  const greeting = getSampleGreeting(niche, businessName, agentName);

  return (
    <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-5 text-left space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-base shrink-0">
          {agentName[0]}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Your Agent Preview</p>
          <p className="text-xs text-muted-foreground">Here is what your AI receptionist will look like</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <span className="text-muted-foreground">Agent name</span>
        <span className="font-medium text-foreground">{agentName}</span>
        <span className="text-muted-foreground">Business</span>
        <span className="font-medium text-foreground">{businessName}</span>
        <span className="text-muted-foreground">Voice</span>
        <span className="font-medium text-foreground">{voiceLabel}</span>
        <span className="text-muted-foreground">Industry</span>
        <span className="font-medium text-foreground">{nicheLabel}</span>
      </div>

      <div className="bg-background border border-indigo-100 rounded-lg p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-1.5">Sample greeting</p>
        <p className="text-sm text-muted-foreground italic leading-relaxed">{greeting}</p>
      </div>
    </div>
  );
}

// ── Trial Success Screen ─────────────────────────────────────────────────────

function TrialSuccessScreen({ clientId, setupUrl, telegramLink }: { clientId: string | null; setupUrl: string | null; telegramLink: string | null }) {
  useEffect(() => {
    try { localStorage.removeItem("unmissed-onboard-draft"); } catch { /* ignore */ }
  }, []);

  const checklistItems = [
    { label: "Agent configured", done: true, link: null as string | null },
    { label: "Trial activated — 7 days free", done: true, link: null as string | null },
    { label: "Set up Telegram to receive call notifications", done: false, link: telegramLink },
    { label: "Forward your business phone to your new AI number", done: false, link: setupUrl },
  ];

  return (
    <div className="max-w-md w-full space-y-6 py-12">
      {/* Trial activation success */}
      <div className="space-y-6">
        {/* Hero */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-950/30 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">You&apos;re live!</h1>
          <p className="text-sm text-muted-foreground">Your 7-day trial has started. Here&apos;s what to do next:</p>
        </div>

        {/* Animated checklist */}
        <div className="space-y-2">
          {checklistItems.map((item, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl border p-3.5 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                item.done
                  ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30"
                  : "border-border bg-card"
              }`}
              style={{ animationDelay: `${i * 150}ms` }}
            >
              {item.done ? (
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-border shrink-0" />
              )}
              <span className={`text-sm flex-1 ${item.done ? "text-emerald-800 dark:text-emerald-200" : "text-foreground font-medium"}`}>
                {item.label}
              </span>
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                >
                  Set up →
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard CTA */}
      <div className="space-y-3">
        {setupUrl ? (
          <a
            href={setupUrl}
            className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-base text-center"
          >
            Open your Dashboard →
          </a>
        ) : (
          <a
            href="/dashboard"
            className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-base text-center"
          >
            Go to Dashboard
          </a>
        )}

        {clientId && (
          <a
            href={`/api/stripe/trial-convert?clientId=${clientId}`}
            className="block w-full border-2 border-border hover:border-indigo-400 text-muted-foreground hover:text-indigo-700 font-medium py-2.5 px-6 rounded-xl transition-colors text-sm text-center"
          >
            Upgrade to get a phone number
          </a>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-muted-foreground/70 text-center">
        Questions?{" "}
        <a href="mailto:support@unmissed.ai" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
          support@unmissed.ai
        </a>
      </p>
    </div>
  );
}

function StatusContent() {
  const searchParams = useSearchParams();
  const intakeId = searchParams.get("id");
  const success = searchParams.get("success");
  const isTrial = searchParams.get("trial") === "true";
  const trialClientId = searchParams.get("clientId");
  const trialSetupUrl = searchParams.get("setupUrl") ? decodeURIComponent(searchParams.get("setupUrl")!) : null;
  const trialTelegramLink = searchParams.get("telegramLink") ? decodeURIComponent(searchParams.get("telegramLink")!) : null;

  const [loading, setLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Agent preview data
  const [preview, setPreview] = useState<IntakePreview | null>(null);

  // Inventory number picker
  const [availableNumbers, setAvailableNumbers] = useState<InventoryNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null); // null = fresh number

  // Success screen: poll for Twilio number
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const fetchActivationStatus = useCallback(async () => {
    if (!intakeId) return;
    try {
      const res = await fetch(`/api/public/activation-status?intakeId=${intakeId}`);
      if (!res.ok) return;
      const json = await res.json() as { status: string; twilio_number: string | null };
      if (json.twilio_number) {
        setTwilioNumber(json.twilio_number);
        setPolling(false);
      }
    } catch { /* ignore — will retry */ }
  }, [intakeId]);

  // Clear localStorage draft and start polling for Twilio number on success
  useEffect(() => {
    if (success) {
      try { localStorage.removeItem("unmissed-onboard-draft"); } catch { /* ignore */ }
      if (intakeId) {
        setPolling(true);
        fetchActivationStatus();
      }
    }
  }, [success, intakeId, fetchActivationStatus]);

  // Fetch agent preview + available inventory numbers for the picker
  useEffect(() => {
    if (!intakeId || success || isTrial) return;
    fetch(`/api/public/intake-preview?intakeId=${intakeId}`)
      .then((r) => r.json())
      .then((json) => { if (json.businessName !== undefined) setPreview(json); })
      .catch(() => { /* silently ignore */ });
    fetch(`/api/public/available-numbers?intakeId=${intakeId}`)
      .then((r) => r.json())
      .then((json) => { if (json.numbers) setAvailableNumbers(json.numbers); })
      .catch(() => { /* silently ignore — falls back to fresh number flow */ });
  }, [intakeId, success, isTrial]);

  // Poll every 4 seconds until we get the number (Stripe webhook takes ~3-8s)
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(fetchActivationStatus, 4000);
    // Stop polling after 90 seconds
    const timeout = setTimeout(() => { setPolling(false); clearInterval(interval); }, 90_000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [polling, fetchActivationStatus]);

  async function handlePay() {
    if (!intakeId) return;
    setLoading(true);
    setPayError(null);
    try {
      const res = await fetch("/api/stripe/create-public-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeId, selectedNumber: selectedNumber ?? undefined }),
      });
      const json = await res.json();
      if (res.status === 409 && json.error?.includes("Number just taken")) {
        // Refresh available numbers and let user pick again
        const refreshRes = await fetch(`/api/public/available-numbers?intakeId=${intakeId}`);
        const refreshJson = await refreshRes.json();
        if (refreshJson.numbers) setAvailableNumbers(refreshJson.numbers);
        setSelectedNumber(null);
        throw new Error(json.error + " — please pick another or choose a fresh number.");
      }
      if (!res.ok) throw new Error(json.error || "Failed to create checkout session");
      window.location.href = json.url;
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  // ── Trial success screen ────────────────────────────────────────────────────
  if (isTrial) {
    return <TrialSuccessScreen clientId={trialClientId} setupUrl={trialSetupUrl} telegramLink={trialTelegramLink} />;
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center px-4 overflow-y-auto py-8 z-10"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #141414 100%)" }}
      >
        <style>{`
          @keyframes confetti-fall {
            0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
            100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
          }
          .cf { position: fixed; width: 7px; height: 7px; border-radius: 2px; animation: confetti-fall linear infinite; pointer-events: none; }
          @keyframes stroke-in {
            from { stroke-dashoffset: 100; }
            to   { stroke-dashoffset: 0; }
          }
          .ck { stroke-dasharray: 100; stroke-dashoffset: 100; animation: stroke-in 0.55s ease-out 0.35s forwards; }
        `}</style>

        {/* Confetti burst */}
        {["#818cf8","#34d399","#fbbf24","#f472b6","#60a5fa","#a78bfa","#34d399","#818cf8","#fbbf24","#f472b6","#60a5fa","#a78bfa"].map((color, i) => (
          <div key={i} className="cf" style={{ left: `${6 + i * 8}%`, animationDuration: `${2.4 + (i % 4) * 0.55}s`, animationDelay: `${(i % 6) * 0.18}s`, background: color }} />
        ))}

        {/* Glass card */}
        <div className="relative w-full max-w-lg rounded-2xl p-8 space-y-6" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(24px)" }}>

          {/* Animated checkmark */}
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.25)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path className="ck" d="M5 13l4 4L19 7" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-white">You&apos;re live.</h1>
            <p className="text-slate-400 text-sm">Your AI receptionist is answering calls.</p>
          </div>

          {/* Phone number card */}
          {twilioNumber ? (
            <div className="rounded-xl p-4 text-center space-y-2" style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.20)", boxShadow: "0 0 28px rgba(52,211,153,0.07)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">Your AI number</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl font-mono font-bold text-white tracking-wide">{twilioNumber}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(twilioNumber)}
                  className="p-1.5 rounded-lg text-emerald-400/50 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                  title="Copy"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5"/></svg>
                </button>
              </div>
              <p className="text-xs text-emerald-400/60">Call this number to test your agent</p>
            </div>
          ) : (
            <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <ActivationProgressDark active={!twilioNumber} done={!!twilioNumber} />
            </div>
          )}

          {/* Call forwarding card */}
          {twilioNumber && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,158,11,0.12)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    <polyline points="17 1 21 5 17 9" />
                    <line x1="21" y1="5" x2="14" y2="5" />
                  </svg>
                </div>
                <p className="text-amber-300 font-semibold text-sm">Forward your calls to your AI agent</p>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Set up call forwarding on your phone so incoming calls ring your AI number.
                Step-by-step instructions are in your dashboard.
              </p>
              <a
                href="/dashboard/setup"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors"
              >
                View setup instructions
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          )}

          {/* 3 next steps */}
          <div className="space-y-3">
            {([
              { d: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z", text: "Call your number to test it" },
               { d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", text: "Download Telegram, then tap the link in your SMS" },
               { d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", text: "Log in to see your call log" },
            ] as { d: string; text: string }[]).map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.22)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={step.d} />
                  </svg>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>

          {/* Download Telegram CTA */}
          <a
            href="https://t.me/hassitant_1bot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 px-6 rounded-full font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: "rgba(41,182,246,0.15)", border: "1px solid rgba(41,182,246,0.30)", color: "#7dd3fc" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.9l-2.972-.924c-.643-.204-.657-.643.136-.953l11.567-4.461c.537-.194 1.006.131.993.659z"/>
            </svg>
            Download Telegram
          </a>

          {/* CTA */}
          <a
            href="/login"
            className="block w-full text-center py-3 px-6 rounded-full text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
          >
            Set up my dashboard &rarr;
          </a>

          {/* Footer */}
          <p className="text-center text-xs text-slate-600">
            Questions?{" "}
            <a href="mailto:support@unmissed.ai" className="text-slate-500 hover:text-slate-400 underline underline-offset-2 transition-colors">
              support@unmissed.ai
            </a>
          </p>
        </div>
      </div>
    );
  }

  // ── Payment state ──────────────────────────────────────────────────────────
  if (intakeId) {
    return (
      <div className="max-w-md w-full text-center space-y-6 py-12">
        <div className="w-14 h-14 mx-auto rounded-full bg-indigo-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">One last step</h1>
          <p className="text-muted-foreground text-sm">
            Your setup details are saved. Complete payment to activate your AI agent.
          </p>
        </div>

        {/* Agent preview */}
        {preview && <AgentPreviewCard preview={preview} />}

        {/* What's included */}
        <div className="bg-muted/30 border border-border rounded-xl p-4 text-sm text-left space-y-2">
          <p className="font-semibold text-foreground">What&apos;s included:</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">&#10003;</span>
              Dedicated AI phone number (Canadian local)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">&#10003;</span>
              Custom voicemail agent — trained on your info
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">&#10003;</span>
              Dashboard access + call logs
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">&#10003;</span>
              <span><strong>First month free</strong> — no recurring charge today</span>
            </li>
          </ul>
        </div>

        {/* Number picker — only shown when inventory numbers are available */}
        {availableNumbers.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Choose your phone number</p>
            </div>

            {/* Inventory option */}
            <div className="p-4 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="numberOption"
                  checked={selectedNumber !== null}
                  onChange={() => selectedNumber === null && setSelectedNumber(availableNumbers[0].phone_number)}
                  className="mt-0.5 accent-indigo-600"
                />
                <div>
                  <span className="text-sm font-medium text-foreground">Pick from available numbers</span>
                  <span className="ml-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Save $5 — $20 CAD</span>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Ready to go, nothing wrong — just in stock</p>
                </div>
              </label>

              {/* Number list */}
              <div className="ml-6 space-y-1.5">
                {availableNumbers.map((num) => (
                  <label
                    key={num.phone_number}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedNumber === num.phone_number
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-border hover:border-border bg-background"
                    }`}
                  >
                    <input
                      type="radio"
                      name="inventoryNumber"
                      value={num.phone_number}
                      checked={selectedNumber === num.phone_number}
                      onChange={() => setSelectedNumber(num.phone_number)}
                      className="accent-indigo-600"
                    />
                    <span className="text-sm font-mono font-medium text-foreground">{num.display}</span>
                    {num.province && (
                      <span className="text-xs text-muted-foreground/70 ml-auto">{num.province}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-border h-px" />

            {/* Fresh number option */}
            <div className="p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="numberOption"
                  checked={selectedNumber === null}
                  onChange={() => setSelectedNumber(null)}
                  className="mt-0.5 accent-indigo-600"
                />
                <div>
                  <span className="text-sm font-medium text-foreground">Get a fresh local number</span>
                  <span className="ml-2 text-xs text-muted-foreground">$25 CAD</span>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Assigned from your province after payment</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {payError && (
          <p className="text-sm text-red-600">{payError}</p>
        )}

        <AdminTestPanel intakeId={intakeId} />

        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed text-base"
        >
          {loading
            ? "Redirecting to checkout..."
            : selectedNumber
            ? "Activate my agent — $20 CAD"
            : "Activate my agent — $25 CAD"}
        </button>

        <p className="text-xs text-muted-foreground/70">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">Terms of Service</Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">Privacy Policy</Link>.
        </p>

        <p className="text-xs text-muted-foreground/70">
          One-time setup fee — includes 50 free minutes. Secure checkout powered by Stripe.
        </p>
      </div>
    );
  }

  // ── Fallback state (no id, no success) ────────────────────────────────────
  return (
    <div className="max-w-md w-full text-center space-y-6 py-12">
      <h1 className="text-2xl font-bold text-foreground">Nothing to show here</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        This page requires a valid intake ID. If you&apos;re setting up a new agent,
        start from the beginning.
      </p>
      <a
        href="/onboard"
        className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm"
      >
        Start setup
      </a>
      <p className="text-xs text-muted-foreground/70">
        Questions?{" "}
        <a href="mailto:support@unmissed.ai" className="underline">
          support@unmissed.ai
        </a>
      </p>
    </div>
  );
}

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading...</div>}>
        <StatusContent />
      </Suspense>
    </div>
  );
}
