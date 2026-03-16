"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import BrowserTestCall, { type TranscriptEntry } from "@/components/dashboard/BrowserTestCall"
import ShimmerButton from "@/components/ui/shimmer-button"

// ── Niche-specific scenario hints ─────────────────────────────────────────────

const NICHE_HINTS: Record<string, string[]> = {
  auto_glass: [
    "Try: 'I have a crack on the driver's side windshield — can you come today?'",
    "Try: 'My insurance is covering it, what info do you need?'",
    "Try: 'Is mobile repair available? I'm at work.'",
  ],
  property_mgmt: [
    "Try: 'My kitchen faucet has been leaking for two days.'",
    "Try: 'I'm interested in the 2-bedroom unit I saw online.'",
    "Try: 'My rent cheque is lost — how do I pay online?'",
  ],
  real_estate: [
    "Try: 'I'm looking to sell my home — what's the process?'",
    "Try: 'What are homes selling for in my area right now?'",
    "Try: 'Can I book a showing this weekend?'",
  ],
  salon: [
    "Try: 'I need a haircut and colour — how far out are you?'",
    "Try: 'Do you have any cancellations today?'",
    "Try: 'What's the price for a balayage?'",
  ],
  print_shop: [
    "Try: 'I need 500 business cards by Friday — is that doable?'",
    "Try: 'Can you print a 4x8 coroplast sign for my yard sale?'",
    "Try: 'Do you do same-day banners?'",
  ],
  voicemail: [
    "Try: 'Hi I'm calling about your services'",
    "Try: 'What are your hours?'",
    "Try: 'Can I leave a message?'",
  ],
}

const DEFAULT_HINTS = [
  "Try asking about availability",
  "Try: 'What services do you offer?'",
  "Try asking a follow-up question after the agent responds",
]

function getNicheHints(niche: string | null): string[] {
  if (!niche) return DEFAULT_HINTS
  return NICHE_HINTS[niche] ?? DEFAULT_HINTS
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PromptVersion {
  id: string
  version: number
  content: string
  change_description: string | null
  created_at: string
  is_active: boolean
}

interface CallResult {
  transcripts: TranscriptEntry[]
  classification: "HOT" | "WARM" | "COLD" | "JUNK" | null
  classifying: boolean
  durationSecs: number | null
}

interface LabViewProps {
  isAdmin: boolean
  clientId: string | null
  livePrompt: string | null
  agentName: string
  niche: string | null
  initialVersions: PromptVersion[]
}

// ── Char count helpers ────────────────────────────────────────────────────────

const CHAR_WARN = 40000
const CHAR_MAX = 50000

function charCountColor(len: number): string {
  if (len >= CHAR_MAX) return "#dc2626"
  if (len >= CHAR_WARN) return "#d97706"
  return "var(--color-text-3)"
}

// ── Classification badge ──────────────────────────────────────────────────────

function ClassBadge({ label }: { label: string | null }) {
  if (!label) return null

  const config: Record<string, { bg: string; text: string; icon: string }> = {
    HOT: {
      bg: "#fef2f2",
      text: "#b91c1c",
      icon: "M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z",
    },
    WARM: {
      bg: "#fffbeb",
      text: "#92400e",
      icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
    },
    COLD: {
      bg: "#eff6ff",
      text: "#1e40af",
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
    },
    JUNK: {
      bg: "var(--color-bg)",
      text: "var(--color-text-3)",
      icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    },
  }

  const c = config[label] ?? config.JUNK
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
      style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.text}22` }}
    >
      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
      </svg>
      {label}
    </motion.span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ size = 3 }: { size?: number }) {
  return (
    <svg
      className={`animate-spin w-${size} h-${size} shrink-0`}
      fill="none" viewBox="0 0 24 24" aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LabView({
  isAdmin,
  clientId,
  livePrompt,
  agentName,
  niche,
  initialVersions,
}: LabViewProps) {
  const [draftPrompt, setDraftPrompt] = useState<string>("")
  const [draftSaved, setDraftSaved] = useState(false)

  const [resultA, setResultA] = useState<CallResult | null>(null)
  const [resultB, setResultB] = useState<CallResult | null>(null)

  const [activeSlot, setActiveSlot] = useState<"A" | "B" | null>(null)
  const [startingSlot, setStartingSlot] = useState<"A" | "B" | null>(null) // connecting in-progress
  const [joinUrl, setJoinUrl] = useState<string | null>(null)
  const [callStartTime, setCallStartTime] = useState<number | null>(null)

  const [versions, setVersions] = useState<PromptVersion[]>(initialVersions)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [makingLive, setMakingLive] = useState(false)
  const [hintIdx, setHintIdx] = useState(0)

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [sessions, setSessions] = useState<{ id: string; created_at: string; transcript_json: unknown[]; prompt_snapshot: string | null }[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const hints = getNicheHints(niche)
  const STORAGE_KEY = clientId ? `lab-draft-${clientId}` : "lab-draft-anonymous"

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setDraftPrompt(saved)
    } catch { /* private browsing */ }
  }, [STORAGE_KEY])

  // Persist draft to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, draftPrompt)
    } catch { /* ignore */ }
  }, [draftPrompt, STORAGE_KEY])

  // Rotate hint every 8s
  useEffect(() => {
    if (activeSlot) return
    const id = setInterval(() => setHintIdx(i => (i + 1) % hints.length), 8000)
    return () => clearInterval(id)
  }, [activeSlot, hints.length])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const loadHistory = useCallback(async () => {
    if (!clientId) return
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/dashboard/lab-transcripts?clientId=${clientId}`)
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions ?? [])
      }
    } finally {
      setHistoryLoading(false)
    }
  }, [clientId])

  // Detect unsaved draft (differs from live)
  const hasUnsavedDraft = draftPrompt.trim() !== "" && draftPrompt !== livePrompt

  // ── Start a test call ────────────────────────────────────────────────────────

  const startTest = useCallback(async (slot: "A" | "B") => {
    if (activeSlot || startingSlot) return // already in or starting a call

    const promptSlot = slot === "A" ? "live" : "draft"
    const promptContent = slot === "B" ? draftPrompt : undefined

    if (slot === "B" && !draftPrompt.trim()) {
      showToast("Enter a draft prompt first.")
      return
    }

    setStartingSlot(slot)
    try {
      const res = await fetch("/api/dashboard/browser-test-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptSlot,
          promptContent,
          ...(isAdmin && clientId ? { clientId } : {}),
        }),
      })

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Request failed" }))
        showToast(error || "Failed to start test call")
        return
      }

      const { joinUrl: url } = await res.json()
      setJoinUrl(url)
      setActiveSlot(slot)
      setCallStartTime(Date.now())
    } catch {
      showToast("Network error — could not start call")
    } finally {
      setStartingSlot(null)
    }
  }, [activeSlot, startingSlot, draftPrompt, isAdmin, clientId])

  // ── Call ended callback ───────────────────────────────────────────────────

  const handleCallEnd = useCallback(async (transcripts: TranscriptEntry[]) => {
    const slot = activeSlot
    const duration = callStartTime ? Math.round((Date.now() - callStartTime) / 1000) : null
    setActiveSlot(null)
    setJoinUrl(null)
    setCallStartTime(null)

    const result: CallResult = { transcripts, classification: null, classifying: true, durationSecs: duration }
    if (slot === "A") setResultA(result)
    else setResultB(result)

    // Classify the transcript in the background
    const finalText = transcripts.filter(t => t.isFinal).map(t => `${t.speaker}: ${t.text}`).join("\n")
    if (finalText) {
      try {
        const res = await fetch("/api/dashboard/analyze-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: finalText }),
        })
        if (res.ok) {
          const data = await res.json()
          const update = { transcripts, classification: data.classification ?? null, classifying: false, durationSecs: duration }
          if (slot === "A") setResultA(update)
          else setResultB(update)
          return
        }
      } catch { /* fall through */ }
    }
    // Fallback — no classification
    const noClass = { transcripts, classification: null, classifying: false, durationSecs: duration }
    if (slot === "A") setResultA(noClass)
    else setResultB(noClass)
  }, [activeSlot, callStartTime])

  // ── Make draft live ───────────────────────────────────────────────────────

  const makeDraftLive = async () => {
    if (!draftPrompt.trim() || makingLive) return
    setMakingLive(true)
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: draftPrompt,
          change_description: "Promoted from Agent Lab",
        }),
      })
      if (res.ok) {
        const vRes = await fetch("/api/dashboard/settings/prompt-versions")
        if (vRes.ok) {
          const { versions: v } = await vRes.json()
          setVersions(v ?? [])
        }
        showToast("Draft is now live. Callers hear the new version immediately.")
        setDraftSaved(true)
      } else {
        const { error } = await res.json().catch(() => ({ error: "Save failed" }))
        showToast(error || "Failed to make draft live")
      }
    } finally {
      setMakingLive(false)
    }
  }

  // ── Restore a version ─────────────────────────────────────────────────────

  const restoreVersion = async (versionId: string, content: string) => {
    setRestoring(versionId)
    try {
      const res = await fetch("/api/dashboard/settings/prompt-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: versionId }),
      })
      if (res.ok) {
        setDraftPrompt(content)
        showToast("Version loaded into Draft panel. Click 'Make Draft Live' to apply.")
        const vRes = await fetch("/api/dashboard/settings/prompt-versions")
        if (vRes.ok) {
          const { versions: v } = await vRes.json()
          setVersions(v ?? [])
        }
      } else {
        showToast("Failed to restore version")
      }
    } finally {
      setRestoring(null)
    }
  }

  // ── Format helpers ────────────────────────────────────────────────────────

  const fmtDuration = (s: number | null) => {
    if (!s) return null
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}m ${sec}s`
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  }

  const busy = activeSlot !== null || startingSlot !== null

  // ── Admin placeholder ─────────────────────────────────────────────────────

  if (isAdmin && !clientId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
        <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" style={{ color: "var(--color-text-3)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--color-text-2)" }}>Select a client first</p>
        <p className="text-xs" style={{ color: "var(--color-text-3)" }}>Go to the Clients page and open a client to test their agent in the Lab.</p>
      </div>
    )
  }

  if (!livePrompt) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
        <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" style={{ color: "var(--color-text-3)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--color-text-2)" }}>No live prompt yet</p>
        <p className="text-xs" style={{ color: "var(--color-text-3)" }}>Complete onboarding setup to generate your agent's prompt, then return here to test it.</p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            role="alert"
            aria-live="assertive"
            className="fixed top-4 right-4 z-50 flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-xs"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-1)" }}
          >
            <span className="flex-1">{toastMsg}</span>
            <button
              onClick={() => setToastMsg(null)}
              className="shrink-0 p-0.5 rounded cursor-pointer opacity-60 hover:opacity-100 transition-opacity focus-visible:outline focus-visible:outline-2"
              aria-label="Dismiss"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--color-text-1)" }}>Agent Lab</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-3)" }}>
            Tests are isolated — live callers are unaffected while you experiment.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasUnsavedDraft && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
              Unsaved draft
            </span>
          )}
          {draftPrompt.trim() && draftPrompt !== livePrompt && (
            <button
              onClick={makeDraftLive}
              disabled={makingLive}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 min-h-[36px] rounded-lg transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: "var(--color-accent)", color: "white" }}
            >
              {makingLive && <Spinner size={3} />}
              {makingLive ? "Saving..." : "Make Draft Live"}
            </button>
          )}
        </div>
      </div>

      {/* Mobile warning */}
      <div className="sm:hidden px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
        For best results, use desktop Chrome or Firefox. Mobile mic access may be unreliable.
      </div>

      {/* A/B Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Panel A — Live */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="rounded-xl p-4 space-y-3"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>
              Live
            </span>
            {resultA && (
              <div className="flex items-center gap-2">
                {resultA.classifying
                  ? <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--color-text-3)" }}><Spinner size={3} /> Classifying</span>
                  : <ClassBadge label={resultA.classification} />
                }
                {resultA.durationSecs && <span className="text-xs" style={{ color: "var(--color-text-3)" }}>{fmtDuration(resultA.durationSecs)}</span>}
              </div>
            )}
          </div>

          <textarea
            readOnly
            value={livePrompt}
            rows={8}
            aria-label="Live prompt (read-only)"
            className="w-full text-xs rounded-lg p-2 resize-none cursor-default"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-2)",
              outline: "none",
            }}
          />

          <button
            onClick={() => startTest("A")}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold min-h-[44px] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: activeSlot === "A" ? "var(--color-accent)" : "var(--color-bg)",
              color: activeSlot === "A" ? "white" : "var(--color-text-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            {startingSlot === "A" && <Spinner size={3} />}
            {activeSlot === "A" ? "Testing..." : startingSlot === "A" ? "Connecting..." : "Test Live Prompt"}
          </button>

          {resultA && !activeSlot && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
              <ResultTranscript transcripts={resultA.transcripts} agentName={agentName} />
              <div className="flex justify-end mt-2">
                <ShimmerButton
                  onClick={async () => {
                    setSaveState('saving')
                    try {
                      const res = await fetch('/api/dashboard/lab-transcripts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          clientId,
                          transcriptJson: resultA.transcripts,
                          promptSnapshot: draftPrompt || livePrompt,
                        }),
                      })
                      if (res.ok) {
                        const { id } = await res.json()
                        setSessions(prev => [{
                          id,
                          created_at: new Date().toISOString(),
                          transcript_json: resultA.transcripts as unknown[],
                          prompt_snapshot: draftPrompt || livePrompt || null,
                        }, ...prev])
                        setSaveState('saved')
                      } else {
                        setSaveState('error')
                      }
                      setTimeout(() => setSaveState('idle'), 3000)
                    } catch {
                      setSaveState('error')
                      setTimeout(() => setSaveState('idle'), 3000)
                    }
                  }}
                  disabled={saveState === 'saving' || saveState === 'saved'}
                  className="text-sm"
                >
                  {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved!' : saveState === 'error' ? 'Error — try again' : 'Save session'}
                </ShimmerButton>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Panel B — Draft */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.06 }}
          className="rounded-xl p-4 space-y-3"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}>
              Draft
            </span>
            {resultB && (
              <div className="flex items-center gap-2">
                {resultB.classifying
                  ? <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--color-text-3)" }}><Spinner size={3} /> Classifying</span>
                  : <ClassBadge label={resultB.classification} />
                }
                {resultB.durationSecs && <span className="text-xs" style={{ color: "var(--color-text-3)" }}>{fmtDuration(resultB.durationSecs)}</span>}
              </div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.1 }}
            className="relative"
          >
            <textarea
              value={draftPrompt}
              onChange={e => { setDraftPrompt(e.target.value); setDraftSaved(false) }}
              rows={8}
              placeholder="Paste or type your draft prompt here..."
              aria-label="Draft prompt"
              className="w-full text-xs rounded-lg p-2 resize-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-1px]"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-1)",
                outlineColor: "var(--color-accent)",
              }}
            />
            <span
              className="absolute bottom-2 right-2 text-xs pointer-events-none"
              style={{ color: charCountColor(draftPrompt.length) }}
              aria-live="polite"
            >
              {draftPrompt.length.toLocaleString()}/{CHAR_MAX.toLocaleString()}
            </span>
          </motion.div>
          {draftPrompt.length >= CHAR_MAX && (
            <p className="text-xs" style={{ color: "#dc2626" }}>Prompt exceeds Ultravox limit — trim before testing.</p>
          )}

          <button
            onClick={() => startTest("B")}
            disabled={busy || !draftPrompt.trim() || draftPrompt.length >= CHAR_MAX}
            className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold min-h-[44px] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: activeSlot === "B" ? "var(--color-accent)" : "var(--color-bg)",
              color: activeSlot === "B" ? "white" : "var(--color-text-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            {startingSlot === "B" && <Spinner size={3} />}
            {activeSlot === "B" ? "Testing..." : startingSlot === "B" ? "Connecting..." : "Test Draft Prompt"}
          </button>

          {resultB && !activeSlot && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
              <ResultTranscript transcripts={resultB.transcripts} agentName={agentName} />
            </motion.div>
          )}

        </motion.div>
      </div>

      {/* Active call area */}
      {activeSlot && joinUrl && (
        <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--color-text-2)" }}>
            Testing Prompt {activeSlot} — {agentName}
          </p>
          <BrowserTestCall joinUrl={joinUrl} onEnd={handleCallEnd} />
        </div>
      )}

      {/* Scenario hint (hidden during active call) */}
      {!activeSlot && (
        <div
          className="rounded-lg px-4 py-3 text-xs"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-3)" }}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="font-medium" style={{ color: "var(--color-text-2)" }}>Scenario hint: </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={hintIdx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {hints[hintIdx % hints.length]}
            </motion.span>
          </AnimatePresence>
        </div>
      )}

      {/* Comparison results */}
      {(resultA || resultB) && (
        <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-2)" }}>Comparison</p>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-semibold mb-1.5" style={{ color: "var(--color-text-1)" }}>Live (A)</p>
              {resultA
                ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {resultA.classifying
                      ? <span className="inline-flex items-center gap-1" style={{ color: "var(--color-text-3)" }}><Spinner size={3} /> Classifying</span>
                      : <ClassBadge label={resultA.classification} />
                    }
                    {resultA.durationSecs && <span style={{ color: "var(--color-text-3)" }}>{fmtDuration(resultA.durationSecs)}</span>}
                  </div>
                )
                : <span style={{ color: "var(--color-text-3)" }}>Not tested yet</span>}
            </div>
            <div>
              <p className="font-semibold mb-1.5" style={{ color: "var(--color-text-1)" }}>Draft (B)</p>
              {resultB
                ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {resultB.classifying
                      ? <span className="inline-flex items-center gap-1" style={{ color: "var(--color-text-3)" }}><Spinner size={3} /> Classifying</span>
                      : <ClassBadge label={resultB.classification} />
                    }
                    {resultB.durationSecs && <span style={{ color: "var(--color-text-3)" }}>{fmtDuration(resultB.durationSecs)}</span>}
                  </div>
                )
                : <span style={{ color: "var(--color-text-3)" }}>Not tested yet</span>}
            </div>
          </div>
        </div>
      )}

      {/* Revision history */}
      {versions.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <button
            className="w-full flex items-center justify-between px-4 min-h-[44px] text-xs font-bold uppercase tracking-wider cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
            style={{ color: "var(--color-text-2)" }}
            onClick={() => setVersionsOpen(v => !v)}
            aria-expanded={versionsOpen}
          >
            Revision History ({versions.length})
            <svg
              className={`w-4 h-4 transition-transform ${versionsOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {versionsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ overflow: "hidden" }}
              >
                <div className="border-t" style={{ borderColor: "var(--color-border)" }}>
                  {versions.map(v => (
                    <div
                      key={v.id}
                      className="flex items-start justify-between gap-3 px-4 py-3 text-xs border-b last:border-b-0"
                      style={{ borderColor: "var(--color-border)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold" style={{ color: "var(--color-text-1)" }}>v{v.version}</span>
                          {v.is_active && (
                            <span className="px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>live</span>
                          )}
                          <span style={{ color: "var(--color-text-3)" }}>{fmtDate(v.created_at)}</span>
                        </div>
                        {v.change_description && (
                          <p className="mt-0.5 truncate" style={{ color: "var(--color-text-3)" }}>{v.change_description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => restoreVersion(v.id, v.content)}
                        disabled={!!restoring || v.is_active}
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-medium min-h-[32px] px-2 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-75 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        style={{ color: "var(--color-accent)" }}
                      >
                        {restoring === v.id && <Spinner size={3} />}
                        {restoring === v.id ? "Loading..." : "Load into Draft"}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Session History */}
      <div className="mt-6 border-t border-slate-200 pt-4">
        <button
          onClick={() => {
            const next = !historyOpen
            setHistoryOpen(next)
            if (next && sessions.length === 0) loadHistory()
          }}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <span>{historyOpen ? '▾' : '▸'}</span>
          Session History
          {historyLoading && <span className="text-xs text-slate-400 ml-1">Loading…</span>}
        </button>

        {historyOpen && (
          <div className="mt-3 space-y-2">
            {sessions.length === 0 && !historyLoading && (
              <p className="text-sm text-slate-400">No saved sessions yet.</p>
            )}
            {sessions.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">
                    {new Date(s.created_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {s.prompt_snapshot && (
                    <span className="text-xs text-indigo-500">{s.prompt_snapshot.slice(0, 40)}…</span>
                  )}
                </div>
                <p className="text-slate-600 text-xs">
                  {Array.isArray(s.transcript_json) ? `${s.transcript_json.length} transcript entries` : 'Session data'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inline transcript viewer ───────────────────────────────────────────────────

function ResultTranscript({ transcripts, agentName }: { transcripts: TranscriptEntry[], agentName: string }) {
  const finals = transcripts.filter(t => t.isFinal)
  if (finals.length === 0) return null
  return (
    <div
      className="rounded-lg p-3 max-h-36 overflow-y-auto space-y-1 text-xs"
      style={{ backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)" }}
    >
      {finals.map((t, i) => (
        <p key={i} style={{ color: t.speaker === "agent" ? "#6366f1" : "var(--color-text-2)" }}>
          <span className="font-medium mr-1" style={{ color: "var(--color-text-3)" }}>
            {t.speaker === "agent" ? agentName : "You:"}
          </span>
          {t.text}
        </p>
      ))}
    </div>
  )
}
