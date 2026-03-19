"use client";

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { ActivationProgress } from "./ActivationProgress";

const LiveTestCall = lazy(() => import("@/components/admin/LiveTestCall"));

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

export function AdminTestPanel({ intakeId }: { intakeId: string }) {
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
