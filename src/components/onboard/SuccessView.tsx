"use client";

import { ActivationProgressDark } from "./ActivationProgress";
import { SUPPORT_EMAIL } from "@/lib/brand";

export function SuccessView({ twilioNumber, intakeId }: { twilioNumber: string | null; intakeId: string | null }) {
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
          href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'hassitant_1bot'}`}
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
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-slate-500 hover:text-slate-400 underline underline-offset-2 transition-colors">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
