"use client";

import { useEffect } from "react";

export function TrialSuccessScreen({ clientId, setupUrl, telegramLink }: { clientId: string | null; setupUrl: string | null; telegramLink: string | null }) {
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
