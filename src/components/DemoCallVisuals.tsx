"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { Check, Clock, PhoneOff } from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentStatus = "idle" | "listening" | "speaking" | "thinking"

export interface TranscriptEntry {
  speaker: "user" | "agent"
  text: string
  isFinal: boolean
}

export interface ClassificationTag {
  id: string
  label: string
  type: "intent" | "action" | "hot"
}

// Classification keyword rules per demo agent
const CLASSIFICATION_RULES: Record<string, Array<{ keywords: string[]; tag: Omit<ClassificationTag, "id"> }>> = {
  auto_glass: [
    { keywords: ["chip"], tag: { label: "Intent: Chip Repair", type: "intent" } },
    { keywords: ["crack", "cracked"], tag: { label: "Intent: Crack Replacement", type: "intent" } },
    { keywords: ["replace", "replacement"], tag: { label: "Intent: Replacement", type: "intent" } },
    { keywords: ["appointment", "book", "schedule", "come in"], tag: { label: "Lead: HOT", type: "hot" } },
    { keywords: ["insurance", "claim"], tag: { label: "Insurance Claim", type: "action" } },
  ],
  property_mgmt: [
    { keywords: ["maintenance", "repair", "fix", "broken", "leak"], tag: { label: "Intent: Maintenance", type: "intent" } },
    { keywords: ["rent", "lease", "move in", "available"], tag: { label: "Intent: Rental Inquiry", type: "intent" } },
    { keywords: ["payment", "bill", "charge"], tag: { label: "Intent: Billing", type: "intent" } },
    { keywords: ["urgent", "emergency", "flood", "fire"], tag: { label: "Lead: HOT", type: "hot" } },
  ],
  real_estate: [
    { keywords: ["showing", "view", "tour", "see the"], tag: { label: "Intent: Book Showing", type: "intent" } },
    { keywords: ["buy", "purchase", "offer"], tag: { label: "Intent: Buyer", type: "intent" } },
    { keywords: ["sell", "list", "listing"], tag: { label: "Intent: Seller", type: "intent" } },
    { keywords: ["pre-approved", "mortgage", "ready"], tag: { label: "Lead: HOT", type: "hot" } },
  ],
}

// ---------------------------------------------------------------------------
// BAR_HEIGHTS — deterministic, adapted from HeroCallMockup
// ---------------------------------------------------------------------------
const BAR_HEIGHTS = Array.from({ length: 16 }, (_, i) => 4 + ((i * 7 + 3) % 22))

// ---------------------------------------------------------------------------
// SoundCues — Web Audio API oscillator cues (zero audio files)
// ---------------------------------------------------------------------------
export function createSoundCues() {
  let ctx: AudioContext | null = null

  function getCtx(): AudioContext | null {
    if (ctx) return ctx
    try {
      ctx = new AudioContext()
      return ctx
    } catch {
      return null
    }
  }

  function playTone(freq: number, endFreq: number, durationMs: number, type: OscillatorType = "sine") {
    const c = getCtx()
    if (!c) return
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, c.currentTime)
    osc.frequency.linearRampToValueAtTime(endFreq, c.currentTime + durationMs / 1000)
    gain.gain.setValueAtTime(0.08, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + durationMs / 1000)
    osc.connect(gain).connect(c.destination)
    osc.start()
    osc.stop(c.currentTime + durationMs / 1000)
  }

  return {
    connectChime: () => playTone(400, 600, 200),
    tagPop: () => playTone(800, 800, 50, "triangle"),
    endTone: () => playTone(500, 300, 300),
  }
}

// ---------------------------------------------------------------------------
// VoiceOrb
// ---------------------------------------------------------------------------
interface VoiceOrbProps {
  status: AgentStatus
  energy: number
  agentColor?: string
  size?: "sm" | "md" | "lg"
  connecting?: boolean
}

export function VoiceOrb({ status, energy, agentColor, size = "md", connecting }: VoiceOrbProps) {
  const reduced = useReducedMotion()

  const sizeClass = {
    sm: "w-16 h-16",
    md: "w-20 h-20 sm:w-28 sm:h-28",
    lg: "w-24 h-24 sm:w-32 sm:h-32",
  }[size]

  const colorMap: Record<AgentStatus, string> = {
    speaking: "rgba(16,185,129,0.7)",
    listening: agentColor ? `${agentColor}99` : "rgba(99,102,241,0.5)",
    thinking: "rgba(245,158,11,0.5)",
    idle: agentColor ? `${agentColor}66` : "rgba(99,102,241,0.3)",
  }

  const glowMap: Record<AgentStatus, string> = {
    speaking: `0 0 ${40 + energy * 40}px rgba(16,185,129,${0.15 + energy * 0.2})`,
    listening: `0 0 ${20 + energy * 20}px ${agentColor ? agentColor + "33" : "rgba(99,102,241,0.12)"}`,
    thinking: "0 0 30px rgba(245,158,11,0.15)",
    idle: "0 0 15px rgba(99,102,241,0.08)",
  }

  const scaleMap: Record<AgentStatus, number[]> = {
    speaking: [1, 1 + energy * 0.15, 1],
    listening: [0.98, 1.02, 0.98],
    thinking: [1, 1, 1],
    idle: [0.97, 1.03, 0.97],
  }

  return (
    <div className={`relative ${sizeClass} flex-shrink-0`}>
      {/* Sonar rings for connecting state */}
      {connecting && (
        <>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="absolute inset-0 rounded-full"
              style={{
                border: `1px solid ${agentColor || "rgba(99,102,241,0.3)"}`,
                animation: `sonar-ring 2s ease-out ${i * 0.4}s infinite`,
              }}
            />
          ))}
        </>
      )}

      {/* Core orb */}
      <motion.div
        className="w-full h-full rounded-full"
        animate={reduced ? {} : {
          scale: scaleMap[status],
          boxShadow: glowMap[status],
        }}
        transition={{
          scale: {
            duration: status === "speaking" ? 0.6 : 1.2,
            repeat: Infinity,
            ease: "easeInOut",
          },
          boxShadow: { duration: 0.5 },
        }}
        style={{
          background: `radial-gradient(circle at 35% 35%, ${colorMap[status]}, rgba(15,23,42,0.8))`,
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// WaveformBars
// ---------------------------------------------------------------------------
interface WaveformBarsProps {
  status: AgentStatus
  energy: number
  agentColor?: string
}

export function WaveformBars({ status, energy, agentColor }: WaveformBarsProps) {
  const reduced = useReducedMotion()

  const colorMap: Record<AgentStatus, string> = {
    speaking: "rgb(16,185,129)",
    listening: agentColor || "rgb(99,102,241)",
    thinking: "rgb(245,158,11)",
    idle: "rgba(99,102,241,0.35)",
  }

  return (
    <div className="flex items-end gap-[3px] h-8 sm:h-12">
      {BAR_HEIGHTS.map((h, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-full"
          animate={reduced ? { height: `${h * 0.4}px` } : {
            height:
              status === "speaking"
                ? [`${h * energy}px`, `${4 + ((h * 1.9 * energy) % 30)}px`, `${h * energy}px`]
                : status === "listening"
                ? `${3 + energy * 5}px`
                : status === "thinking"
                ? `${h * 0.5}px`
                : `${h * 0.15}px`,
            backgroundColor: colorMap[status],
            opacity: status === "idle" ? 0.3 : status === "thinking" ? [0.5, 0.8, 0.5] : 1,
          }}
          transition={{
            height: {
              duration: status === "speaking" ? 0.38 + (i % 5) * 0.07 : 0.5,
              repeat: status === "speaking" || status === "thinking" ? Infinity : 0,
              delay: i * 0.018,
              ease: "easeInOut",
            },
            backgroundColor: { duration: 0.4 },
            opacity: {
              duration: status === "thinking" ? 1.2 : 0.4,
              repeat: status === "thinking" ? Infinity : 0,
            },
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------
interface StatusBadgeProps {
  status: AgentStatus
  callState: "requesting" | "connecting" | "active" | "ended" | "error"
}

export function StatusBadge({ status, callState }: StatusBadgeProps) {
  if (callState !== "active" && callState !== "ended") return null

  const config: Record<string, { label: string; color: string; bg: string; pulse: boolean }> = {
    speaking: { label: "LIVE", color: "#10B981", bg: "rgba(16,185,129,0.12)", pulse: true },
    listening: { label: "LIVE", color: "#10B981", bg: "rgba(16,185,129,0.12)", pulse: true },
    thinking: { label: "Thinking...", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", pulse: false },
    idle: { label: "LIVE", color: "#10B981", bg: "rgba(16,185,129,0.12)", pulse: true },
    ended: { label: "AI Summary", color: "#818CF8", bg: "rgba(99,102,241,0.1)", pulse: false },
  }

  const key = callState === "ended" ? "ended" : status
  const c = config[key]

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: c.bg, color: c.color }}
      >
        {c.pulse && (
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: c.color }}
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          />
        )}
        {c.label}
      </motion.div>
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// CallTimer — SVG circle ring
// ---------------------------------------------------------------------------
interface CallTimerProps {
  secondsLeft: number
  totalSeconds: number
}

export function CallTimer({ secondsLeft, totalSeconds }: CallTimerProps) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const progress = secondsLeft / totalSeconds
  const offset = circumference * (1 - progress)

  const color = secondsLeft > 60 ? "#10B981" : secondsLeft > 30 ? "#F59E0B" : "#EF4444"

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

  return (
    <div className="relative w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
        {/* Background ring */}
        <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
        {/* Progress ring */}
        <motion.circle
          cx="22" cy="22" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-mono"
        style={{ color }}
      >
        {formatTime(secondsLeft)}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TranscriptBubble
// ---------------------------------------------------------------------------
interface TranscriptBubbleProps {
  entry: TranscriptEntry
  agentName: string
  showLabel: boolean
}

export function TranscriptBubble({ entry, agentName, showLabel }: TranscriptBubbleProps) {
  const isAgent = entry.speaker === "agent"

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`flex flex-col ${isAgent ? "items-start" : "items-end"}`}
    >
      {showLabel && (
        <span
          className="text-[10px] font-mono mb-0.5 px-1"
          style={{ color: "var(--color-text-3)" }}
        >
          {isAgent ? agentName : "You"}
        </span>
      )}
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isAgent ? "rounded-bl-sm" : "rounded-br-sm"
        }`}
        style={{
          backgroundColor: isAgent ? "rgba(99,102,241,0.1)" : "var(--color-surface)",
          border: isAgent ? "none" : "1px solid var(--color-border)",
          color: "var(--color-text-1)",
        }}
      >
        <AnimatePresence mode="wait">
          {!entry.isFinal ? (
            <motion.span
              key="dots"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-1 h-5"
            >
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: "var(--color-text-3)" }}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                />
              ))}
            </motion.span>
          ) : (
            <motion.span
              key="text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {entry.text}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// LiveClassificationTag
// ---------------------------------------------------------------------------
interface LiveClassificationTagsProps {
  tags: ClassificationTag[]
}

export function LiveClassificationTags({ tags }: LiveClassificationTagsProps) {
  const visibleTags = tags.slice(-3) // max 3 visible

  const borderColors: Record<ClassificationTag["type"], string> = {
    intent: "#F59E0B",
    action: "#10B981",
    hot: "#EF4444",
  }

  return (
    <div className="flex flex-wrap gap-1.5 justify-end">
      <AnimatePresence mode="popLayout">
        {visibleTags.map(tag => (
          <motion.div
            key={tag.id}
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium backdrop-blur-md"
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderLeft: `3px solid ${borderColors[tag.type]}`,
              color: borderColors[tag.type],
            }}
          >
            {tag.label}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// Hook to derive classification tags from transcripts
export function useClassificationTags(
  transcripts: TranscriptEntry[],
  demoId: string,
  onNewTag?: () => void
): ClassificationTag[] {
  const [tags, setTags] = useState<ClassificationTag[]>([])
  const detectedRef = useRef(new Set<string>())

  useEffect(() => {
    const rules = CLASSIFICATION_RULES[demoId] || []
    if (!rules.length) return

    // Check all final transcripts for keyword matches
    const allText = transcripts
      .filter(t => t.isFinal)
      .map(t => t.text.toLowerCase())
      .join(" ")

    const newTags: ClassificationTag[] = []
    for (const rule of rules) {
      const ruleKey = rule.tag.label
      if (detectedRef.current.has(ruleKey)) continue

      const matched = rule.keywords.some(kw => allText.includes(kw))
      if (matched) {
        detectedRef.current.add(ruleKey)
        newTags.push({ id: `${Date.now()}-${ruleKey}`, ...rule.tag })
      }
    }

    if (newTags.length > 0) {
      setTags(prev => [...prev, ...newTags])
      onNewTag?.()
    }
  }, [transcripts, demoId, onNewTag])

  return tags
}

// ---------------------------------------------------------------------------
// NotificationPreview — Telegram toast
// ---------------------------------------------------------------------------
interface NotificationPreviewProps {
  show: boolean
  agentName: string
  intent?: string
}

export function NotificationPreview({ show, agentName, intent }: NotificationPreviewProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          className="absolute -bottom-16 left-0 right-0 mx-2 rounded-xl px-4 py-3 flex items-center gap-3 z-10"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
            style={{ backgroundColor: "#229ED9" }}
          >
            T
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: "var(--color-text-1)" }}>
              HOT lead — {agentName} captured it
            </p>
            <p className="text-xs truncate" style={{ color: "var(--color-text-3)" }}>
              {intent || "Ready to book"} — tap for details
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// PostCallSummary
// ---------------------------------------------------------------------------
interface PostCallSummaryProps {
  transcripts: TranscriptEntry[]
  agentName: string
  companyName: string
  duration: number
  summary: string | null
  isPreview?: boolean
  summaryLoading: boolean
  tags: ClassificationTag[]
  callId: string | null
  demoId: string
  onEnd: () => void
}

export function PostCallSummary({
  transcripts,
  agentName,
  companyName,
  duration,
  summary,
  summaryLoading,
  tags,
  callId,
  demoId,
  isPreview,
  onEnd,
}: PostCallSummaryProps) {
  const [showFullTranscript, setShowFullTranscript] = useState(false)
  const finalTranscripts = transcripts.filter(t => t.isFinal)

  const formatDuration = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`

  // Determine highest classification for the pipeline reveal
  const hotTag = tags.find(t => t.type === "hot")
  const leadLabel = hotTag ? "HOT" : tags.length > 0 ? "WARM" : "Captured"

  const pipelineItems = isPreview
    ? [
        { label: `Answered in 0.3s`, done: true },
        { label: `Lead classified as ${leadLabel}`, done: true },
        { label: "Telegram alert → active after activation", done: false },
        { label: "SMS follow-up → active after activation", done: false },
      ]
    : [
        { label: `Answered in 0.3s`, done: true },
        { label: `Lead classified as ${leadLabel}`, done: true },
        { label: "Telegram alert sent to owner", done: true },
        { label: "SMS follow-up sent to caller", done: true },
      ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Orb with checkmark */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-16 h-16">
          <div
            className="w-full h-full rounded-full flex items-center justify-center"
            style={{
              background: "radial-gradient(circle at 35% 35%, rgba(99,102,241,0.3), rgba(15,23,42,0.8))",
              boxShadow: "0 0 20px rgba(99,102,241,0.12)",
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
            >
              <Check className="w-7 h-7 text-indigo-400" />
            </motion.div>
          </div>
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold" style={{ color: "var(--color-text-1)" }}>Demo complete</h3>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-3)" }}>
            {companyName} &middot; {formatDuration(duration)}
          </p>
        </div>
      </div>

      {/* AI Summary card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl px-4 py-3.5"
        style={{
          backgroundColor: "rgba(99,102,241,0.06)",
          border: "1px solid rgba(99,102,241,0.14)",
          backdropFilter: "blur(16px)",
        }}
      >
        <p className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "#818CF8" }}>
          AI Summary
        </p>
        {summaryLoading ? (
          <div className="space-y-2">
            {[80, 95, 60].map((w, i) => (
              <motion.div
                key={i}
                className="h-3 rounded"
                style={{ width: `${w}%`, backgroundColor: "rgba(99,102,241,0.12)" }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.15 }}
              />
            ))}
          </div>
        ) : (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-text-2)" }}
          >
            {summary || `${agentName} handled the call, collected caller information, and would have notified the business owner immediately.`}
          </motion.p>
        )}
      </motion.div>

      {/* What Your Business Gets */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-3)" }}>
          What your business gets
        </p>
        {pipelineItems.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.15, type: "spring", stiffness: 300, damping: 24 }}
            className="flex items-center gap-2.5"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6 + i * 0.15, type: "spring", stiffness: 400, damping: 15 }}
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: item.done ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.12)" }}
            >
              {item.done
                ? <Check className="w-3 h-3 text-emerald-400" />
                : <Clock className="w-3 h-3 text-slate-400" />
              }
            </motion.div>
            <span className="text-sm" style={{ color: item.done ? "var(--color-text-2)" : "var(--color-text-3)" }}>{item.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Transcript preview */}
      {finalTranscripts.length > 0 && (
        <div>
          <button
            onClick={() => setShowFullTranscript(!showFullTranscript)}
            className="text-xs font-medium mb-2 cursor-pointer"
            style={{ color: "var(--color-primary)" }}
          >
            {showFullTranscript ? "Hide transcript" : `Show transcript (${finalTranscripts.length} messages)`}
          </button>
          <AnimatePresence>
            {showFullTranscript && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden rounded-xl"
                style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <div className="p-3 max-h-48 overflow-y-auto space-y-2">
                  {finalTranscripts.map((t, i) => (
                    <div
                      key={i}
                      className={`text-sm ${t.speaker === "agent" ? "text-indigo-400" : ""}`}
                      style={{ color: t.speaker === "agent" ? undefined : "var(--color-text-2)" }}
                    >
                      <span className="text-[10px] font-mono mr-1.5" style={{ color: "var(--color-text-3)" }}>
                        {t.speaker === "agent" ? agentName : "You"}
                      </span>
                      {t.text}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* CTAs */}
      <div className="space-y-3 pt-2">
        {isPreview ? (
          <button
            onClick={onEnd}
            className="w-full py-4 text-white font-semibold text-sm rounded-xl cursor-pointer transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Continue &rarr;
          </button>
        ) : (
          <a
            href={callId ? `/onboard?ref=demo&callId=${callId}` : "/onboard"}
            onClick={() => {
              if (callId) {
                fetch("/api/demo/event", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ callId, eventType: "onboard_clicked", metadata: { demoId } }),
                }).catch(() => {})
              }
            }}
            className="group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap px-6 py-4 text-white font-semibold text-sm rounded-xl transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px w-full"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Get My Agent Set Up &rarr;
          </a>
        )}
        <button
          onClick={onEnd}
          className="w-full py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer"
          style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text-3)" }}
        >
          {isPreview ? "Hear it again" : "Try a different agent"}
        </button>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// EndCallButton
// ---------------------------------------------------------------------------
interface EndCallButtonProps {
  onEnd: () => void
}

export function EndCallButton({ onEnd }: EndCallButtonProps) {
  return (
    <button
      onClick={onEnd}
      className="w-full py-3 sm:py-3.5 rounded-xl font-semibold text-sm transition-all text-white flex items-center justify-center gap-2 cursor-pointer"
      style={{
        backgroundColor: "#DC2626",
        minHeight: "48px",
      }}
    >
      <PhoneOff className="w-4 h-4" />
      End Demo Call
    </button>
  )
}
