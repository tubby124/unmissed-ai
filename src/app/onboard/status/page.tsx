"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

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

  const [loading, setLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Inventory number picker
  const [availableNumbers, setAvailableNumbers] = useState<InventoryNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null); // null = fresh $20

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

  // Fetch available inventory numbers for the picker
  useEffect(() => {
    if (!intakeId || success) return;
    fetch(`/api/public/available-numbers?intakeId=${intakeId}`)
      .then((r) => r.json())
      .then((json) => { if (json.numbers) setAvailableNumbers(json.numbers); })
      .catch(() => { /* silently ignore — falls back to $20 flow */ });
  }, [intakeId, success]);

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

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center px-4 overflow-y-auto py-8 z-10"
        style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)" }}
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
            <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <svg className="animate-spin w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span className="text-sm text-slate-400">Provisioning your number&hellip;</span>
            </div>
          )}

          {/* 3 next steps */}
          <div className="space-y-3">
            {([
              { d: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z", text: "Call your number to test it" },
               { d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", text: "Connect Telegram via the link in your SMS" },
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

          {/* CTA */}
          <a
            href="/login"
            className="block w-full text-center py-3 px-6 rounded-full text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
          >
            Set up my dashboard →
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

        {/* Number picker — only shown when inventory numbers are available */}
        {availableNumbers.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-800">Choose your phone number</p>
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
                  <span className="text-sm font-medium text-gray-900">Pick from available numbers</span>
                  <span className="ml-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Save $3 — $17 CAD</span>
                  <p className="text-xs text-gray-400 mt-0.5">Ready to go — no wait for provisioning</p>
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
                        : "border-gray-200 hover:border-gray-300 bg-white"
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
                    <span className="text-sm font-mono font-medium text-gray-900">{num.display}</span>
                    {num.province && (
                      <span className="text-xs text-gray-400 ml-auto">{num.province}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 h-px" />

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
                  <span className="text-sm font-medium text-gray-900">Get a fresh local number</span>
                  <span className="ml-2 text-xs text-gray-500">$20 CAD</span>
                  <p className="text-xs text-gray-400 mt-0.5">Assigned from your province after payment</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {payError && (
          <p className="text-sm text-red-600">{payError}</p>
        )}

        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed text-base"
        >
          {loading
            ? "Redirecting to checkout…"
            : selectedNumber
            ? "Activate my agent — $17 CAD"
            : "Activate my agent — $20 CAD"}
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
