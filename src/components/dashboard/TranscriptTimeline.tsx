'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface TranscriptMessage {
  role: 'agent' | 'user'
  text: string
  startTime?: number
  endTime?: number
}

interface TranscriptTimelineProps {
  messages: TranscriptMessage[]
  currentTime?: number
  onSeek?: (time: number) => void
  agentName?: string
  isLive?: boolean
}

function fmtTime(s?: number) {
  if (s == null || !isFinite(s)) return ''
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function BlinkingCursor() {
  return (
    <motion.span
      className="inline-block w-[2px] h-[1em] bg-green-400 ml-1 align-middle rounded-sm"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ repeat: Infinity, duration: 0.9, ease: [1, 0, 0, 0] }}
    />
  )
}

export default function TranscriptTimeline({
  messages,
  currentTime = 0,
  onSeek,
  agentName = 'Agent',
  isLive = false,
}: TranscriptTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(messages.length)

  // Live mode: auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isLive && messages.length !== prevLengthRef.current) {
      prevLengthRef.current = messages.length
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [messages.length, isLive])

  // On mount when live: scroll to bottom immediately
  useEffect(() => {
    if (isLive) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Post-call: scroll to active audio-synced bubble
  useEffect(() => {
    if (!isLive) {
      activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentTime, isLive])

  if (!messages.length) {
    return (
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
        <div className="flex items-center gap-2 mb-4">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: "var(--color-text-3)" }}>
            {isLive ? 'Live Transcript' : 'Transcript'}
          </p>
          {isLive && (
            <span className="relative flex w-1.5 h-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
          )}
        </div>
        <p className="text-sm" style={{ color: "var(--color-text-3)" }}>
          {isLive ? 'Waiting for conversation to start…' : 'No transcript available.'}
        </p>
      </div>
    )
  }

  let lastRole: string | null = null

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: "var(--color-text-3)" }}>
            {isLive ? 'Live Transcript' : 'Transcript'}
          </p>
          {isLive && (
            <span className="relative flex w-1.5 h-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono" style={{ color: "var(--color-text-3)" }}>{messages.length} msg</span>
      </div>

      <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            const isAgent = msg.role === 'agent'
            const isActive = !isLive && msg.startTime != null && msg.endTime != null
              && currentTime >= msg.startTime && currentTime <= msg.endTime
            const sameAsLast = msg.role === lastRole
            const isLatest = i === messages.length - 1
            lastRole = msg.role

            return (
              <motion.div
                key={`${msg.role}-${i}`}
                initial={isLive ? { opacity: 0, y: 10, scale: 0.97 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                ref={isActive ? activeRef : undefined}
                className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} ${sameAsLast ? 'mt-1' : 'mt-3'}`}
              >
                {!sameAsLast && (
                  <p className={`text-[11px] mb-1 ${isAgent ? 'mr-1 text-right' : 'ml-1'}`} style={{ color: "var(--color-text-3)" }}>
                    {isAgent ? agentName : 'Caller'}
                    {msg.startTime != null && !isLive && (
                      <span className="ml-1.5 font-mono" style={{ color: "var(--color-text-3)" }}>{fmtTime(msg.startTime)}</span>
                    )}
                  </p>
                )}
                <div
                  className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed transition-all ${
                    isAgent
                      ? `rounded-tr-sm ${isActive ? 'ring-1 ring-blue-300/50' : ''} ${isLive && isLatest ? 'ring-1 ring-green-400/50' : ''}`
                      : `rounded-tl-sm ${isActive ? 'ring-1 ring-blue-400/40' : ''}`
                  } ${!isLive && msg.startTime != null ? 'cursor-pointer hover:opacity-90' : ''}`}
                  style={{
                    backgroundColor: isAgent ? "var(--color-primary)" : "var(--color-bg-raised)",
                    color: "var(--color-text-1)",
                  }}
                  onClick={() => !isLive && msg.startTime != null && onSeek?.(msg.startTime)}
                  title={!isLive && msg.startTime != null ? `Jump to ${fmtTime(msg.startTime)}` : undefined}
                >
                  {msg.text}
                  {isLive && isLatest && isAgent && <BlinkingCursor />}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
