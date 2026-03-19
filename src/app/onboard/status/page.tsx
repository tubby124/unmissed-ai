"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { AdminTestPanel } from "@/components/onboard/AdminTestPanel";
import { AgentPreviewCard, type IntakePreview } from "@/components/onboard/AgentPreviewCard";
import { TrialSuccessScreen } from "@/components/onboard/TrialSuccessScreen";
import { SuccessView } from "@/components/onboard/SuccessView";

interface InventoryNumber {
  phone_number: string;
  display: string;
  province: string | null;
  area_code: string | null;
  country: string;
}

function StatusContent() {
  const searchParams = useSearchParams();
  const intakeId = searchParams.get("id");
  const success = searchParams.get("success");
  const isTrial = searchParams.get("trial") === "true";
  const trialClientId = searchParams.get("clientId");
  const rawSetupUrl = searchParams.get("setupUrl") ? decodeURIComponent(searchParams.get("setupUrl")!) : null;
  // Sanitize: if the stored URL has localhost (from a dev-environment test), fall back to /dashboard
  const trialSetupUrl = rawSetupUrl && !rawSetupUrl.includes("localhost") ? rawSetupUrl : "/dashboard";
  const trialTelegramLink = searchParams.get("telegramLink") ? decodeURIComponent(searchParams.get("telegramLink")!) : null;
  // tier param deprecated — single plan now. Kept for backward compat with old URLs.

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
    return <SuccessView twilioNumber={twilioNumber} intakeId={intakeId} />;
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
                  <span className="ml-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Save $5 — $20 CAD setup</span>
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
            : `Activate my agent — ${selectedNumber ? "$20" : "$25"} setup + subscription`}
        </button>

        <p className="text-xs text-muted-foreground/70">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">Terms of Service</Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">Privacy Policy</Link>.
        </p>

        <p className="text-xs text-muted-foreground/70">
          One-time setup fee + monthly subscription. 30-day free trial included. Secure checkout powered by Stripe.
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
