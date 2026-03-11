"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function StatusContent() {
  const searchParams = useSearchParams();
  const intakeId = searchParams.get("id");
  const success = searchParams.get("success");

  const [loading, setLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

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
        body: JSON.stringify({ intakeId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create checkout session");
      window.location.href = json.url;
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-md w-full text-center space-y-6 py-12">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900">You&apos;re all set!</h1>

        {twilioNumber ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-1">
            <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Your AI phone number</p>
            <p className="text-2xl font-bold text-emerald-800 tracking-wide font-mono">{twilioNumber}</p>
            <p className="text-xs text-emerald-600">Call this number to test your agent</p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500 flex items-center gap-3">
            <svg className="animate-spin w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Provisioning your phone number&hellip; usually takes under 30 seconds.
          </div>
        )}

        <p className="text-gray-600 text-sm leading-relaxed">
          Check your email — you&apos;ll receive a link to set your password and log into your dashboard.
        </p>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-900 text-left space-y-2">
          <p className="font-semibold">What happens next:</p>
          <ol className="list-decimal list-inside space-y-1 text-emerald-800">
            <li>Password setup email is on its way</li>
            <li>Call your new AI number to test it</li>
            <li>Log in to your dashboard to see the call log</li>
          </ol>
        </div>
        <p className="text-xs text-gray-400">
          Questions? Email{" "}
          <a href="mailto:support@unmissed.ai" className="underline">
            support@unmissed.ai
          </a>
        </p>
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
          <h1 className="text-2xl font-bold text-gray-900">One last step</h1>
          <p className="text-gray-500 text-sm">
            Your setup details are saved. Complete payment to activate your AI agent.
          </p>
        </div>

        {/* What's included */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-left space-y-2">
          <p className="font-semibold text-gray-800">What&apos;s included:</p>
          <ul className="space-y-1.5 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              Dedicated AI phone number (Canadian local)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              Custom voicemail agent — trained on your info
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              Dashboard access + call logs
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              <span><strong>First month free</strong> — no recurring charge today</span>
            </li>
          </ul>
        </div>

        {payError && (
          <p className="text-sm text-red-600">{payError}</p>
        )}

        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed text-base"
        >
          {loading ? "Redirecting to checkout…" : "Activate my agent — $20 CAD"}
        </button>

        <p className="text-xs text-gray-400">
          Secure checkout powered by Stripe. No subscription started today.
        </p>
      </div>
    );
  }

  // ── Fallback state (no id, no success) ────────────────────────────────────
  return (
    <div className="max-w-md w-full text-center space-y-6 py-12">
      <div className="text-5xl">✅</div>
      <h1 className="text-2xl font-bold text-gray-900">Request received!</h1>
      <p className="text-gray-600 text-sm leading-relaxed">
        We&apos;ve got your setup details. We&apos;ll reach out within 1–2 business
        days to get your AI agent live.
      </p>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900 text-left space-y-2">
        <p className="font-semibold">What happens next:</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-800">
          <li>We review your setup details</li>
          <li>We configure your custom AI agent</li>
          <li>We send you a test number to call before going live</li>
        </ol>
      </div>
      <p className="text-xs text-gray-400">
        Questions? Email{" "}
        <a href="mailto:support@unmissed.ai" className="underline">
          support@unmissed.ai
        </a>
      </p>
    </div>
  );
}

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-gray-400 text-sm">Loading…</div>}>
        <StatusContent />
      </Suspense>
    </div>
  );
}
