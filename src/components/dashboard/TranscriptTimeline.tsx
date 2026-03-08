'use client'

import { useEffect, useRef } from 'react'

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
}

function fmtTime(s?: number) {
  if (s == null || !isFinite(s)) return ''
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function TranscriptTimeline({ messages, currentTime = 0, onSeek, agentName = 'Agent' }: TranscriptTimelineProps) {
  const activeRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to active bubble
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [currentTime])

  if (!messages.length) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-4">Transcript</p>
        <p className="text-zinc-600 text-sm">No transcript available.</p>
      </div>
    )
  }

  let lastRole: string | null = null

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-4">Transcript</p>
      <div className="space-y-3">
        {messages.map((msg, i) => {
          const isAgent = msg.role === 'agent'
          const isActive = msg.startTime != null && msg.endTime != null
            && currentTime >= msg.startTime && currentTime <= msg.endTime
          const sameAsLast = msg.role === lastRole
          lastRole = msg.role

          return (
            <div
              key={i}
              ref={isActive ? activeRef : undefined}
              className={`flex flex-col ${isAgent ? 'items-start' : 'items-end'} ${sameAsLast ? 'mt-1' : 'mt-3'}`}
            >
              {!sameAsLast && (
                <p className={`text-xs text-zinc-600 mb-1 ${isAgent ? 'ml-1' : 'mr-1'}`}>
                  {isAgent ? agentName : 'Caller'}
                  {msg.startTime != null && (
                    <span className="ml-1.5 font-mono">{fmtTime(msg.startTime)}</span>
                  )}
                </p>
              )}
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed cursor-pointer transition-all ${
                  isAgent
                    ? `bg-white/[0.06] text-zinc-200 rounded-bl-sm ${isActive ? 'border-l-2 border-blue-500' : ''}`
                    : `bg-blue-500/15 text-blue-100 border border-blue-500/20 rounded-br-sm ${isActive ? 'border-l-2 border-blue-400' : ''}`
                }`}
                onClick={() => msg.startTime != null && onSeek?.(msg.startTime)}
                title={msg.startTime != null ? `Jump to ${fmtTime(msg.startTime)}` : undefined}
              >
                {msg.text}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
