'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

interface CallLog {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  call_status: 'live' | 'processing' | 'HOT' | 'WARM' | 'COLD' | 'JUNK' | null
  ai_summary: string | null
  service_type: string | null
  duration_seconds: number | null
  transcript: Array<{ role: string; text: string }> | null
  started_at: string
  ended_at: string | null
  end_reason: string | null
  twilio_call_sid: string | null
}

interface TranscriptMsg {
  role: 'agent' | 'user'
  text: string
}

const STATUS_BADGE: Record<string, string> = {
  live: 'bg-green-500/20 text-green-300 border border-green-500/40',
  processing: 'bg-slate-500/20 text-slate-400 border border-slate-500/40',
  HOT: 'bg-red-500/20 text-red-300 border border-red-500/40',
  WARM: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  COLD: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
  JUNK: 'bg-gray-500/20 text-gray-400 border border-gray-500/40',
}

const STATUS_LABEL: Record<string, string> = {
  live: '● LIVE',
  processing: '⏳ processing',
  HOT: '🔥 HOT',
  WARM: '🟡 WARM',
  COLD: '❄️ COLD',
  JUNK: '🗑️ JUNK',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-CA', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function fmtDur(secs: number | null) {
  if (!secs) return '—'
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

function isStale(call: CallLog) {
  return call.call_status === 'live' &&
    Date.now() - new Date(call.started_at).getTime() > 15 * 60 * 1000
}

// ── Live call panel ──────────────────────────────────────────────────────────
function LiveCallPanel({ call, onRecover }: { call: CallLog; onRecover: () => void }) {
  const [transcript, setTranscript] = useState<TranscriptMsg[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [recovering, setRecovering] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const stale = isStale(call)

  useEffect(() => {
    const start = new Date(call.started_at).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [call.started_at])

  useEffect(() => {
    let active = true
    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/transcript?callId=${call.ultravox_call_id}`)
        if (res.ok) {
          const data = await res.json()
          if (active) setTranscript(data)
        }
      } catch { /* silent */ }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => { active = false; clearInterval(id) }
  }, [call.ultravox_call_id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  async function recover() {
    setRecovering(true)
    await fetch('/api/admin/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId: call.ultravox_call_id }),
    })
    onRecover()
    setRecovering(false)
  }

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60

  return (
    <div className={`border rounded-lg mx-6 mt-6 overflow-hidden ${stale ? 'border-amber-500/30 bg-amber-950/10' : 'border-green-500/30 bg-green-950/20'}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b ${stale ? 'border-amber-500/20' : 'border-green-500/20'}`}>
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${stale ? 'bg-amber-400' : 'bg-green-400 animate-pulse'}`} />
          <span className={`font-semibold text-sm ${stale ? 'text-amber-300' : 'text-green-300'}`}>
            {stale ? 'STALE CALL' : 'LIVE CALL'}
          </span>
          <span className="text-gray-400 text-sm font-mono">{call.caller_phone}</span>
        </div>
        <div className="flex items-center gap-3">
          {stale && (
            <button
              onClick={recover}
              disabled={recovering}
              className="text-xs px-3 py-1 rounded border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 disabled:opacity-50 transition-colors"
            >
              {recovering ? 'Recovering...' : 'Recover call'}
            </button>
          )}
          <span className={`font-mono text-sm tabular-nums ${stale ? 'text-amber-400' : 'text-green-400'}`}>
            {mins}:{String(secs).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="h-64 overflow-y-auto px-4 py-3 space-y-2 font-mono text-sm">
        {transcript.length === 0 ? (
          <p className="text-gray-600 italic">
            {stale
              ? 'Call ended — use "Recover call" to fetch transcript.'
              : 'Waiting for conversation to begin...'}
          </p>
        ) : (
          transcript.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'agent' ? 'text-blue-300' : 'text-gray-200'}`}>
              <span className="shrink-0 text-gray-600 w-10">
                {msg.role === 'agent' ? 'AI' : 'caller'}
              </span>
              <span>{msg.text}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── Recording cell ────────────────────────────────────────────────────────────
function RecordingCell({ callId, callStatus }: { callId: string; callStatus: string | null }) {
  const [state, setState] = useState<'checking' | 'ready' | 'processing'>('checking')

  useEffect(() => {
    if (callStatus === 'live' || callStatus === 'processing') {
      setState('processing')
      return
    }
    fetch(`/api/admin/recording?callId=${callId}`, { method: 'HEAD' })
      .then(r => setState(r.ok ? 'ready' : 'processing'))
      .catch(() => setState('processing'))
  }, [callId, callStatus])

  if (state === 'checking' || state === 'processing') {
    return <span className="text-xs text-gray-600 italic">Processing...</span>
  }

  return (
    <audio
      controls
      className="h-7 w-40"
      src={`/api/admin/recording?callId=${callId}`}
      onClick={e => e.stopPropagation()}
    />
  )
}

// ── Past call row ────────────────────────────────────────────────────────────
function CallRow({ call }: { call: CallLog }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <td className="px-6 py-4 text-gray-400 whitespace-nowrap text-sm">{fmt(call.started_at)}</td>
        <td className="px-6 py-4 font-mono text-gray-200 text-sm whitespace-nowrap">
          {call.caller_phone || '—'}
        </td>
        <td className="px-6 py-4">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[call.call_status || 'processing']}`}>
            {STATUS_LABEL[call.call_status || 'processing']}
          </span>
        </td>
        <td className="px-6 py-4 text-gray-500 text-sm capitalize">
          {call.service_type?.replace(/_/g, ' ') || '—'}
        </td>
        <td className="px-6 py-4 text-gray-500 text-sm whitespace-nowrap">
          {fmtDur(call.duration_seconds)}
        </td>
        <td className="px-6 py-4 text-gray-400 text-sm max-w-xs">
          <p className="line-clamp-1">{call.ai_summary || '—'}</p>
        </td>
        <td className="px-6 py-4">
          {call.call_status !== 'live' && (
            <RecordingCell callId={call.ultravox_call_id} callStatus={call.call_status} />
          )}
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && (
        <tr className="border-b border-white/5 bg-gray-900/40">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Transcript */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Transcript</p>
                {call.transcript?.length ? (
                  <div className="space-y-1.5 font-mono text-sm max-h-64 overflow-y-auto">
                    {call.transcript.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'agent' ? 'text-blue-300' : 'text-gray-200'}`}>
                        <span className="shrink-0 w-12 text-gray-600">{msg.role === 'agent' ? 'AI' : 'caller'}</span>
                        <span>{msg.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-sm italic">No transcript saved.</p>
                )}
              </div>
              {/* Metadata */}
              <div className="space-y-2 text-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Details</p>
                {call.ended_at && (
                  <div className="flex gap-2">
                    <span className="text-gray-600 w-24 shrink-0">Ended</span>
                    <span className="text-gray-300">{fmt(call.ended_at)}</span>
                  </div>
                )}
                {call.end_reason && (
                  <div className="flex gap-2">
                    <span className="text-gray-600 w-24 shrink-0">End reason</span>
                    <span className="text-gray-300">{call.end_reason}</span>
                  </div>
                )}
                {call.twilio_call_sid && (
                  <div className="flex gap-2">
                    <span className="text-gray-600 w-24 shrink-0">Twilio SID</span>
                    <span className="text-gray-400 font-mono text-xs break-all">{call.twilio_call_sid}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-gray-600 w-24 shrink-0">Ultravox ID</span>
                  <span className="text-gray-400 font-mono text-xs break-all">{call.ultravox_call_id}</span>
                </div>
                {call.ai_summary && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Summary</p>
                    <p className="text-gray-300 text-sm">{call.ai_summary}</p>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function CallsPage() {
  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  async function fetchCalls() {
    const { data } = await supabase
      .from('call_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100)
    setCalls(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchCalls()
    const channel = supabase
      .channel('call_logs_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs' }, fetchCalls)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-recover calls stuck as 'live' for >15min on every reload
  useEffect(() => {
    if (!calls.length) return
    const staleCalls = calls.filter(isStale)
    if (!staleCalls.length) return
    staleCalls.forEach(c => {
      fetch('/api/admin/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: c.ultravox_call_id }),
      }).then(() => fetchCalls()).catch(() => {/* silent */})
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calls.length])

  const liveCall = calls.find(c => c.call_status === 'live')
  const pastCalls = calls.filter(c => c.call_status !== 'live')
  const completedCalls = pastCalls.filter(c => c.call_status !== 'processing')

  const avgDur = completedCalls.length
    ? Math.round(completedCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / completedCalls.length)
    : 0

  return (
    <div>
      {liveCall && <LiveCallPanel call={liveCall} onRecover={fetchCalls} />}

      <div className="px-6 py-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-sm font-semibold text-gray-300">
            Call Log
            <span className="ml-2 text-gray-600 font-normal">{pastCalls.length} calls</span>
          </h1>
          <button
            onClick={fetchCalls}
            className="text-xs px-3 py-1.5 rounded border border-white/20 hover:bg-white/10 transition-colors text-gray-400"
          >
            Refresh
          </button>
        </div>

        {!loading && completedCalls.length > 0 && (
          <div className="flex gap-5 text-xs text-gray-500 flex-wrap">
            {(['HOT', 'WARM', 'COLD', 'JUNK'] as const).map(s => (
              <span key={s}>
                {STATUS_LABEL[s]} <b className="text-gray-300">{completedCalls.filter(c => c.call_status === s).length}</b>
              </span>
            ))}
            <span className="ml-auto text-gray-600">avg {fmtDur(avgDur)}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-600 text-sm">Loading...</div>
      ) : pastCalls.length === 0 && !liveCall ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-600 gap-2 text-sm">
          <span>No calls yet — make a test call to +15877421507</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-2 font-medium">Time</th>
                <th className="text-left px-6 py-2 font-medium">Caller</th>
                <th className="text-left px-6 py-2 font-medium">Status</th>
                <th className="text-left px-6 py-2 font-medium">Type</th>
                <th className="text-left px-6 py-2 font-medium">Duration</th>
                <th className="text-left px-6 py-2 font-medium">Summary</th>
                <th className="text-left px-6 py-2 font-medium">Recording</th>
              </tr>
            </thead>
            <tbody>
              {pastCalls.map(call => <CallRow key={call.id} call={call} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
