"use client";

import { useEffect } from "react";
import { SUPPORT_EMAIL } from "@/lib/brand";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export function TrialSuccessScreen({ clientId, agentName, setupUrl, telegramLink }: { clientId: string | null; agentName: string | null; setupUrl: string | null; telegramLink: string | null }) {
  useEffect(() => {
    try { localStorage.removeItem(STORAGE_KEYS.ONBOARD_DRAFT); } catch { /* ignore */ }
  }, []);

  return (
    <div className="max-w-md w-full space-y-6 py-12">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-950/30 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-foreground">Your agent is live.</h1>
          <p className="text-sm text-muted-foreground">Your 7-day trial has started. Talk to your agent in the dashboard and set up your phone number.</p>
        </div>
      </div>

      {/* Confirmed items */}
      <div className="space-y-2">
        {[
          "Agent configured and ready",
          "7-day free trial activated — no credit card needed",
        ].map((label, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-emerald-800 dark:text-emerald-200">{label}</span>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="space-y-3">
        <a
          href={setupUrl || "/dashboard"}
          className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors text-base text-center"
        >
          {agentName ? `Talk to ${agentName} in your dashboard →` : "Talk to your agent →"}
        </a>

        {clientId && (
          <a
            href={`/api/stripe/trial-convert?clientId=${clientId}`}
            className="block w-full border-2 border-border hover:border-indigo-400 text-muted-foreground hover:text-indigo-700 font-medium py-2.5 px-6 rounded-xl transition-colors text-sm text-center"
          >
            Upgrade to get a phone number
          </a>
        )}

        {telegramLink && (
          <a
            href={telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-xs text-muted-foreground/70 hover:text-muted-foreground py-1.5 transition-colors"
          >
            Set up Telegram call notifications →
          </a>
        )}
      </div>

      {/* Footer */}
      <div className="space-y-1.5 text-center">
        <p className="text-xs text-muted-foreground/70">
          Closing this tab?{" "}
          <a href="/login" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
            Log back in with Google
          </a>
          {" "}any time.
        </p>
        <p className="text-xs text-muted-foreground/70">
          Questions?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
