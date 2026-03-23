'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import TranscriptTimeline from './TranscriptTimeline'
import AudioWaveformPlayer from './AudioWaveformPlayer'

interface TranscriptMessage {
  role: 'agent' | 'user'
  text: string
  startTime?: number
  endTime?: number
}

interface AgentBreakdown {
  calls: number
  avgDuration: number
  converted: number
}

interface DemoStatsData {
  stats: {
    totalDemos: number
    todayDemos: number
    converted: number
    conversionRate: number
    popularAgent: string | null
    avgDuration: number
    browserCount: number
    phoneCount: number
    agentBreakdown?: Record<string, AgentBreakdown>
  }
  recentCalls: {
    id: string
    demoId: string
    callerName: string
    source: string
    durationSeconds: number | null
    converted: boolean
    startedAt: string
  }[]
}

const AGENT_LABELS: Record<string, string> = {
  auto_glass: 'Auto Glass (Tyler)',
  property_mgmt: 'Property Mgmt (Nicole)',
  real_estate: 'Real Estate (Aisha)',
}

const AGENT_NAMES: Record<string, string> = {
  auto_glass: 'Tyler',
  property_mgmt: 'Nicole',
  real_estate: 'Aisha',
}

export default function DemoStats() {
  const [data, setData] = useState<DemoStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [transcriptCache, setTranscriptCache] = useState<Record<string, TranscriptMessage[]>>({})
  const [transcriptLoading, setTranscriptLoading] = useState<string | null>(null)
  const [audioTime, setAudioTime] = useState(0)

  useEffect(() => {
    fetch('/api/dashboard/demo-stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleTranscript = useCallback(async (callId: string) => {
    if (expandedId === callId) {
      setExpandedId(null)
      return
    }

    setExpandedId(callId)

    // Already cached
    if (transcriptCache[callId]) return

    setTranscriptLoading(callId)
    try {
      const res = await fetch(`/api/dashboard/demo-calls/${callId}/transcript`)
      if (res.ok) {
        const { messages } = await res.json()
        setTranscriptCache(prev => ({ ...prev, [callId]: messages || [] }))
      } else {
        setTranscriptCache(prev => ({ ...prev, [callId]: [] }))
      }
    } catch {
      setTranscriptCache(prev => ({ ...prev, [callId]: [] }))
    } finally {
      setTranscriptLoading(null)
    }
  }, [expandedId, transcriptCache])

  if (loading) return null
  if (!data || data.stats.totalDemos === 0) return null

  const { stats, recentCalls } = data

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 text-sm font-semibold transition-colors mb-3"
        style={{ color: 'var(--color-text-2)' }}
      >
        <svg
          className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Demo Analytics (30d)
      </button>

      {!collapsed && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard label="Total Demos" value={String(stats.totalDemos)} />
            <StatCard label="Today" value={String(stats.todayDemos)} />
            <StatCard label="Conversion" value={`${stats.conversionRate}%`} sub={`${stats.converted} signups`} />
            <StatCard label="Avg Duration" value={formatDuration(stats.avgDuration)} sub={`${stats.browserCount} browser / ${stats.phoneCount} phone`} />
          </div>

          {/* Per-agent breakdown */}
          {stats.agentBreakdown && Object.keys(stats.agentBreakdown).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {Object.entries(stats.agentBreakdown)
                .sort((a, b) => b[1].calls - a[1].calls)
                .map(([agentId, ab]) => (
                  <div
                    key={agentId}
                    className="rounded-xl px-4 py-3 flex items-center justify-between"
                    style={{ backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>
                        {AGENT_NAMES[agentId] || agentId}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
                        {AGENT_LABELS[agentId] || agentId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-text-1)' }}>{ab.calls}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
                        {formatDuration(ab.avgDuration)} avg
                        {ab.converted > 0 && <span className="text-green-400 ml-1.5">{ab.converted} conv</span>}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Recent demos table */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ backgroundColor: 'var(--color-bg-raised)', color: 'var(--color-text-3)' }}>
                  <th className="px-3 py-2 font-medium w-5"></th>
                  <th className="px-3 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Caller</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">Source</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">Duration</th>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Conv</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.slice(0, 20).map(call => {
                  const isExpanded = expandedId === call.id
                  const isLoading = transcriptLoading === call.id
                  const transcript = transcriptCache[call.id]

                  return (
                    <DemoRow
                      key={call.id}
                      call={call}
                      isExpanded={isExpanded}
                      isLoading={isLoading}
                      transcript={transcript}
                      audioTime={audioTime}
                      onAudioTimeUpdate={setAudioTime}
                      onToggle={() => toggleTranscript(call.id)}
                      formatDuration={formatDuration}
                      formatTime={formatTime}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

interface DemoRowProps {
  call: DemoStatsData['recentCalls'][number]
  isExpanded: boolean
  isLoading: boolean
  transcript: TranscriptMessage[] | undefined
  audioTime: number
  onAudioTimeUpdate: (time: number) => void
  onToggle: () => void
  formatDuration: (s: number) => string
  formatTime: (iso: string) => string
}

function DemoRow({ call, isExpanded, isLoading, transcript, audioTime, onAudioTimeUpdate, onToggle, formatDuration, formatTime }: DemoRowProps) {
  const handleSeek = useCallback((time: number) => {
    document.dispatchEvent(new CustomEvent('audio-seek', { detail: { time } }))
  }, [])
  return (
    <>
      <tr
        className="border-t cursor-pointer transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50"
        style={{ borderColor: 'var(--color-border)', backgroundColor: isExpanded ? 'var(--color-bg-raised)' : undefined }}
        onClick={onToggle}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        aria-label={`View transcript for ${AGENT_LABELS[call.demoId] || call.demoId} demo by ${call.callerName}`}
      >
        <td className="pl-3 py-2 w-5">
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ color: 'var(--color-text-3)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </td>
        <td className="px-3 py-2" style={{ color: 'var(--color-text-2)' }}>
          {AGENT_LABELS[call.demoId] || call.demoId}
        </td>
        <td className="px-3 py-2" style={{ color: 'var(--color-text-2)' }}>{call.callerName}</td>
        <td className="px-3 py-2 hidden sm:table-cell" style={{ color: 'var(--color-text-3)' }}>
          <span className={`text-xs px-1.5 py-0.5 rounded ${call.source === 'phone' ? 'bg-violet-500/10 text-violet-400' : 'bg-blue-500/10 text-blue-400'}`}>
            {call.source}
          </span>
        </td>
        <td className="px-3 py-2 hidden sm:table-cell" style={{ color: 'var(--color-text-3)' }}>
          {call.durationSeconds ? formatDuration(call.durationSeconds) : '--'}
        </td>
        <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-3)' }}>{formatTime(call.startedAt)}</td>
        <td className="px-3 py-2">
          {call.converted ? (
            <span className="text-green-400 text-xs">Yes</span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>--</span>
          )}
        </td>
      </tr>

      {/* Expanded transcript row */}
      <AnimatePresence>
        {isExpanded && (
          <tr>
            <td colSpan={7} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-4 py-3" style={{ backgroundColor: 'var(--color-bg)' }}>
                  {isLoading && (
                    <div className="flex items-center gap-2 py-4 justify-center">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>Loading transcript...</span>
                    </div>
                  )}
                  {!isLoading && transcript && transcript.length > 0 && (
                    <div className="space-y-3">
                      <AudioWaveformPlayer
                        callId={call.id}
                        recordingUrl={`/api/dashboard/demo-calls/${call.id}/recording`}
                        onTimeUpdate={onAudioTimeUpdate}
                      />
                      <TranscriptTimeline
                        messages={transcript}
                        currentTime={audioTime}
                        onSeek={handleSeek}
                        agentName={AGENT_NAMES[call.demoId] || 'Agent'}
                      />
                    </div>
                  )}
                  {!isLoading && transcript && transcript.length === 0 && (
                    <p className="text-xs py-4 text-center" style={{ color: 'var(--color-text-3)' }}>
                      No transcript available for this demo call.
                    </p>
                  )}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--color-text-3)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: 'var(--color-text-1)' }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>{sub}</p>}
    </div>
  )
}
