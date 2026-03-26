"use client";

import { useEffect, useRef, useState } from "react";
import { SUPPORT_EMAIL } from "@/lib/brand";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { createBrowserClient } from "@/lib/supabase/client";
import { CallProvider } from "@/contexts/CallContext";
import BrowserTestCall from "@/components/dashboard/BrowserTestCall";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentSnapshot {
  servicesNote: string | null;
  hoursNote: string | null;
  topFacts: string[];
  faqCount: number;
  scrapeStatus: "approved" | "extracted" | "none";
  hasWebsite: boolean;
  injectedNote: string | null;
  trialExpiresAt: string | null;
}

/** Returns "X days left" or "X hours left" string from an ISO date */
function getTrialCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Trial expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} left in trial`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

/** Single row in the "What [agent] knows" card */
function KnowledgeFact({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label?: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-emerald-400">
        {icon ?? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
          </svg>
        )}
      </span>
      <p className="text-sm text-white/70 leading-snug">
        {label && (
          <span className="text-white/90 font-medium">{label}:{" "}</span>
        )}
        {value}
      </p>
    </div>
  );
}

/** Label chip for a category row */
function CategoryChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-white/60 border border-white/10">
      {label}
    </span>
  );
}

/**
 * "What [AgentName] knows" card.
 *
 * States:
 *   loading   — skeleton shimmer
 *   no data   — hidden (nothing to show)
 *   sparse    — services + hours only (no website facts)
 *   approved  — services + hours + actual scraped facts
 *   extracted — services + hours + count, note about pending review
 *   failed    — services + hours only, website note omitted
 */
function AgentKnowledgeCard({
  agentName,
  snapshot,
  liveCount,
  loading,
  injectedNote,
}: {
  agentName: string | null;
  snapshot: AgentSnapshot | null;
  liveCount: number;
  loading: boolean;
  injectedNote?: string | null;
}) {
  const name = agentName ?? "Your agent";

  // Loading state — skeleton
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 animate-pulse">
        <div className="h-3.5 w-36 rounded bg-white/10" />
        <div className="space-y-2.5">
          <div className="h-3 w-full rounded bg-white/10" />
          <div className="h-3 w-4/5 rounded bg-white/10" />
          <div className="h-3 w-3/5 rounded bg-white/10" />
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  const { servicesNote, hoursNote, topFacts, faqCount, scrapeStatus, hasWebsite } = snapshot;

  // Nothing to show at all
  const hasAnything = servicesNote || hoursNote || topFacts.length > 0 || liveCount > 0 || injectedNote;
  if (!hasAnything) return null;

  // Show approved facts (user reviewed) or just a count for extracted
  const showFacts = scrapeStatus === "approved" && topFacts.length > 0;
  const showExtractedNote = scrapeStatus === "extracted" && hasWebsite;
  const showKnowledgeCount =
    liveCount > 0 && !showFacts;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">
          What {name} knows
        </p>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {servicesNote && <CategoryChip label="Services" />}
          {hoursNote && <CategoryChip label="Hours" />}
          {showFacts && <CategoryChip label="Website" />}
          {faqCount > 0 && <CategoryChip label="Q&A" />}
        </div>
      </div>

      {/* Facts */}
      <div className="space-y-2">
        {/* Services — direct from user input, always safe */}
        {servicesNote && (
          <KnowledgeFact label="Services" value={servicesNote} />
        )}

        {/* Hours — direct from user input, always safe */}
        {hoursNote && (
          <KnowledgeFact label="Hours" value={hoursNote} />
        )}

        {/* Live injected note — shows immediately after user saves */}
        {injectedNote && (
          <KnowledgeFact
            icon={
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zM7.25 5a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V5zm.75 6.5a.875.875 0 110-1.75.875.875 0 010 1.75z"/>
              </svg>
            }
            label="Right now"
            value={injectedNote}
          />
        )}

        {/* Approved scraped facts — user reviewed, show the actual strings */}
        {showFacts && topFacts.map((fact, i) => (
          <KnowledgeFact key={i} value={fact} />
        ))}

        {/* FAQ count note */}
        {faqCount > 0 && (
          <KnowledgeFact
            label="Q&A"
            value={`${faqCount} question${faqCount === 1 ? "" : "s"} your agent can answer`}
          />
        )}

        {/* Extracted (not user-reviewed) — show count, not content */}
        {showKnowledgeCount && (
          <KnowledgeFact
            value={`${liveCount} fact${liveCount === 1 ? "" : "s"} loaded from your business`}
          />
        )}
      </div>

      {/* Footer notes for partial/pending states */}
      {showExtractedNote && (
        <p className="text-[11px] text-white/35 leading-relaxed pt-0.5 border-t border-white/10">
          Website content detected — open your dashboard to review and approve specific facts.
        </p>
      )}
      {!hasWebsite && !showFacts && (
        <p className="text-[11px] text-white/35 leading-relaxed pt-0.5 border-t border-white/10">
          Add your website in the dashboard to teach {name} more about your business.
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TrialSuccessScreen({
  clientId,
  agentName,
  setupUrl,
  telegramLink: _telegramLink,
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
  const [liveCount, setLiveCount] = useState(initialKnowledgeCount);
  const [showCall, setShowCall] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [callLoading, setCallLoading] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callComplete, setCallComplete] = useState(false);

  // Agent knowledge snapshot — fetched once after mount
  const [snapshot, setSnapshot] = useState<AgentSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  // Quick note injection
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [liveNote, setLiveNote] = useState<string | null>(null);

  // Clear draft on mount
  useEffect(() => {
    try { localStorage.removeItem(STORAGE_KEYS.ONBOARD_DRAFT); } catch { /* ignore */ }
  }, []);

  // Fetch agent snapshot (what was actually learned during provisioning)
  useEffect(() => {
    if (!clientId) {
      setSnapshotLoading(false);
      return;
    }
    fetch(`/api/public/agent-snapshot?clientId=${clientId}`)
      .then(r => r.ok ? r.json() : null)
      .then((json: AgentSnapshot | null) => {
        if (json && !('error' in (json as object))) {
          setSnapshot(json);
          if (json.injectedNote) {
            setLiveNote(json.injectedNote);
            setNoteText(json.injectedNote);
          }
        }
      })
      .catch(() => { /* silent fail — card simply won't render */ })
      .finally(() => setSnapshotLoading(false));
  }, [clientId]);

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

  async function handleSaveNote() {
    if (!clientId || noteSaving) return;
    setNoteSaving(true);
    setNoteError(null);
    setNoteSaved(false);
    try {
      const res = await fetch('/api/trial/update-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, note: noteText.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setLiveNote(noteText.trim() || null);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 3000);
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Could not save. Try again.');
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    setGoogleLoading(false);
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
      setCallId(json.callId ?? null);
      setShowCall(true);
    } catch (err) {
      setCallError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCallLoading(false);
    }
  }

  const trialCountdown = snapshot?.trialExpiresAt ? getTrialCountdown(snapshot.trialExpiresAt) : null;
  const subtitle = liveCount > 0
    ? `${agentName ?? "Your agent"} is ready to answer calls — trained on ${liveCount} facts from your business.`
    : `${agentName ?? "Your agent"} is ready to answer calls.`;

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
          {trialCountdown && (
            <p className="text-xs font-semibold text-amber-400">
              {trialCountdown} — no card needed
            </p>
          )}
        </div>
      </div>

      {/* What the agent knows — the trust surface */}
      <AgentKnowledgeCard
        agentName={agentName}
        snapshot={snapshot}
        liveCount={liveCount}
        loading={snapshotLoading}
        injectedNote={liveNote}
      />

      {/* Quick note injection */}
      {clientId && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">
              Tell {agentName ?? "your agent"} something right now
            </p>
            <p className="text-[11px] text-white/30 leading-relaxed">
              Anything time-sensitive — out sick, running late, special hours, a promotion. Goes live instantly.
            </p>
          </div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={`e.g. "Closed today — back tomorrow at 9am" or "Free delivery this week"`}
            maxLength={500}
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
          />
          {noteError && <p className="text-xs text-red-400">{noteError}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveNote}
              disabled={noteSaving || noteText.trim() === (liveNote ?? "")}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {noteSaving ? "Saving…" : "Update agent"}
            </button>
            {noteSaved && (
              <span className="text-xs text-emerald-400 font-semibold">Live on next call ✓</span>
            )}
            {noteText.trim() && (
              <span className="text-xs text-white/25 ml-auto">{noteText.length}/500</span>
            )}
          </div>
        </div>
      )}

      {/* Primary CTAs */}
      <div className="space-y-3">
        {callComplete ? (
          /* Post-call conversion state — the "holy shit it worked" moment */
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-4 text-center">
            <div className="space-y-1">
              <p className="text-emerald-400 font-semibold text-sm">
                ✓ That call was recorded
              </p>
              <p className="text-white/70 text-sm leading-relaxed">
                Sign in to see the transcript, call summary, and everything {agentName ?? "your agent"} learned from that conversation.
              </p>
              {callId && (
                <p className="text-white/30 text-[11px]">
                  Call ID: {callId.slice(0, 8)}…
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-white hover:bg-white/90 text-gray-900 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 min-h-[44px]"
            >
              <GoogleIcon />
              {googleLoading ? "Redirecting to Google…" : "Sign in to see your call log"}
            </button>
            <a
              href="/login"
              className="block text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Sign in with email →
            </a>
            <button
              onClick={() => { setCallComplete(false); setShowCall(false); }}
              className="block w-full text-xs text-white/25 hover:text-white/40 transition-colors cursor-pointer"
            >
              Back to setup
            </button>
          </div>
        ) : !showCall ? (
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
              Log in to your dashboard →
            </a>
          </>
        ) : joinUrl ? (
          <>
            <CallProvider>
              <BrowserTestCall
                joinUrl={joinUrl}
                onEnd={(_transcripts) => {
                  setShowCall(false);
                  setCallComplete(true);
                }}
              />
            </CallProvider>
            <a
              href={setupUrl || "/dashboard"}
              className="block w-full border border-border hover:border-indigo-400 text-muted-foreground hover:text-indigo-400 font-medium py-2.5 px-6 rounded-xl transition-colors text-sm text-center"
            >
              Log in to your dashboard →
            </a>
          </>
        ) : null}
      </div>

      {/* Next steps */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2.5">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">What to do next</p>
        {[
          { n: "1", text: `Call ${agentName ?? "your agent"} — test it yourself first` },
          { n: "2", text: "Sign in to your dashboard to see call logs + tweak settings" },
          { n: "3", text: "Share the number with customers before the trial ends" },
        ].map(({ n, text }) => (
          <div key={n} className="flex items-start gap-2.5">
            <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 text-[10px] font-bold flex items-center justify-center mt-0.5">{n}</span>
            <p className="text-sm text-white/60">{text}</p>
          </div>
        ))}
      </div>

      {/* Dashboard access */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Access your dashboard</p>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-border bg-background hover:bg-muted/50 text-sm font-medium text-foreground transition-colors cursor-pointer disabled:opacity-60 min-h-[44px]"
        >
          <GoogleIcon />
          {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
        </button>
        <a
          href="/login"
          className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          Sign in with email →
        </a>
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
