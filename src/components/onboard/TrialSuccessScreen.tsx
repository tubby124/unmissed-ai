"use client";

import { useEffect, useRef, useState } from "react";
import { SUPPORT_EMAIL } from "@/lib/brand";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { createBrowserClient } from "@/lib/supabase/client";
import { CallProvider } from "@/contexts/CallContext";
import BrowserTestCall from "@/components/dashboard/BrowserTestCall";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export function TrialSuccessScreen({
  clientId,
  agentName,
  setupUrl,
  telegramLink: _telegramLink,
  email,
  knowledgeCount: initialKnowledgeCount = 0,
}: {
  clientId: string | null;
  agentName: string | null;
  setupUrl: string | null;
  telegramLink: string | null;
  email: string | null;
  knowledgeCount?: number;
}) {
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createBrowserClient();
  const supabase = supabaseRef.current;

  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState(initialKnowledgeCount);
  const [showCall, setShowCall] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [callLoading, setCallLoading] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.removeItem(STORAGE_KEYS.ONBOARD_DRAFT); } catch { /* ignore */ }
  }, []);

  // Realtime subscription: increment liveCount as knowledge chunks finish seeding
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`knowledge-${clientId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'knowledge_chunks',
        filter: `client_id=eq.${clientId}`,
      }, () => {
        setLiveCount(c => c + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, supabase]);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    setGoogleLoading(false);
  }

  async function handleMagicLink() {
    if (!email) return;
    setMagicLoading(true);
    setMagicError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMagicLoading(false);
    if (error) {
      setMagicError(error.message);
    } else {
      setMagicSent(true);
    }
  }

  async function handleStartCall() {
    if (!clientId) return;
    setCallLoading(true);
    setCallError(null);
    try {
      const res = await fetch('/api/trial/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to start call');
      setJoinUrl(json.joinUrl);
      setShowCall(true);
    } catch (err) {
      setCallError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCallLoading(false);
    }
  }

  const subtitle = liveCount > 0
    ? `${agentName ?? "Your agent"} is ready to answer calls — trained on ${liveCount} facts from your business. 7-day free trial, no card needed.`
    : `${agentName ?? "Your agent"} is ready to answer calls. 7-day free trial, no credit card needed.`;

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
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {/* Primary CTAs */}
      <div className="space-y-3">
        {!showCall ? (
          <>
            <button
              onClick={handleStartCall}
              disabled={callLoading || !clientId}
              className="block w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors text-base text-center cursor-pointer disabled:cursor-not-allowed"
            >
              {callLoading
                ? "Connecting..."
                : agentName
                ? `Talk to ${agentName} →`
                : "Talk to your agent →"}
            </button>
            {callError && <p className="text-sm text-red-500 text-center">{callError}</p>}
            <a
              href={setupUrl || "/dashboard"}
              className="block w-full border border-border hover:border-indigo-400 text-muted-foreground hover:text-indigo-400 font-medium py-2.5 px-6 rounded-xl transition-colors text-sm text-center"
            >
              Open your dashboard →
            </a>
          </>
        ) : joinUrl ? (
          <>
            <CallProvider>
              <BrowserTestCall
                joinUrl={joinUrl}
                onEnd={(_transcripts) => setShowCall(false)}
              />
            </CallProvider>
            <a
              href={setupUrl || "/dashboard"}
              className="block w-full border border-border hover:border-indigo-400 text-muted-foreground hover:text-indigo-400 font-medium py-2.5 px-6 rounded-xl transition-colors text-sm text-center"
            >
              Open your dashboard →
            </a>
          </>
        ) : null}
      </div>

      {/* Login — magic link primary, Google secondary */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">Log in to your dashboard</p>
          <p className="text-xs text-muted-foreground">No password — we&apos;ll email you a one-click login link.</p>
        </div>

        {!magicSent ? (
          <>
            {email && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium text-foreground truncate">{email}</span>
              </div>
            )}
            {magicError && <p className="text-xs text-red-500">{magicError}</p>}
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={magicLoading || !email}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 min-h-[44px]"
            >
              {magicLoading ? "Sending…" : "Send me a login link →"}
            </button>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-muted-foreground/60 shrink-0">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-border bg-background hover:bg-muted/50 text-sm font-medium text-foreground transition-colors cursor-pointer disabled:opacity-60 min-h-[44px]"
            >
              <GoogleIcon />
              {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
            </button>
          </>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3.5">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Check your inbox</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Login link sent to <span className="font-medium">{email}</span>. Click it to open your dashboard — no password needed.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-muted-foreground/70 text-center">
        Questions?{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
          {SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  );
}
