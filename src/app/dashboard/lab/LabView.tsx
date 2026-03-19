"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import BrowserTestCall, { type TranscriptEntry } from "@/components/dashboard/BrowserTestCall"
import ShimmerButton from "@/components/ui/shimmer-button"

import { getNicheHints, charCountColor, CHAR_MAX } from "@/components/dashboard/lab/constants"
import type { LabViewProps, CallResult, PromptVersion } from "@/components/dashboard/lab/constants"
import { ClassBadge, Spinner } from "@/components/dashboard/lab/ClassBadge"
import { ResultTranscript } from "@/components/dashboard/lab/ResultTranscript"
import { VersionHistory } from "@/components/dashboard/lab/VersionHistory"
import { SessionHistory } from "@/components/dashboard/lab/SessionHistory"
import type { SessionHistoryHandle } from "@/components/dashboard/lab/SessionHistory"

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
  const [startingSlot, setStartingSlot] = useState<"A" | "B" | null>(null)
  const [joinUrl, setJoinUrl] = useState<string | null>(null)
  const [callStartTime, setCallStartTime] = useState<number | null>(null)

  const [versions, setVersions] = useState<PromptVersion[]>(initialVersions)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [makingLive, setMakingLive] = useState(false)
  const [hintIdx, setHintIdx] = useState(0)

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const sessionHistoryRef = useRef<SessionHistoryHandle>(null)

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

  // Detect unsaved draft (differs from live)
  const hasUnsavedDraft = draftPrompt.trim() !== "" && draftPrompt !== livePrompt

  // ── Start a test call ────────────────────────────────────────────────────────

  const startTest = useCallback(async (slot: "A" | "B") => {
    if (activeSlot || startingSlot) return

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
                        sessionHistoryRef.current?.addSession({
                          id,
                          created_at: new Date().toISOString(),
                          transcript_json: resultA.transcripts as unknown[],
                          prompt_snapshot: draftPrompt || livePrompt || null,
                        })
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
                  {saveState === 'saving' ? 'Saving\u2026' : saveState === 'saved' ? 'Saved!' : saveState === 'error' ? 'Error \u2014 try again' : 'Save session'}
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
      <VersionHistory versions={versions} restoring={restoring} onRestore={restoreVersion} />

      {/* Session History */}
      <SessionHistory ref={sessionHistoryRef} clientId={clientId} />
    </div>
  )
}
