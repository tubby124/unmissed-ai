'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

interface CallLog {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  call_status: 'processing' | 'HOT' | 'WARM' | 'COLD' | 'JUNK' | null
  ai_summary: string | null
  service_type: string | null
  duration_seconds: number | null
  started_at: string
  ended_at: string | null
}

const STATUS_STYLES: Record<string, string> = {
  HOT: 'bg-red-100 text-red-700 border border-red-200',
  WARM: 'bg-amber-100 text-amber-700 border border-amber-200',
  COLD: 'bg-blue-100 text-blue-700 border border-blue-200',
  JUNK: 'bg-gray-100 text-gray-500 border border-gray-200',
  processing: 'bg-slate-100 text-slate-500 border border-slate-200',
}

const STATUS_EMOJI: Record<string, string> = {
  HOT: '🔥',
  WARM: '🟡',
  COLD: '❄️',
  JUNK: '🗑️',
  processing: '⏳',
}

function formatDuration(secs: number | null): string {
  if (!secs) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const supabase = createBrowserClient()

  async function fetchCalls() {
    const { data } = await supabase
      .from('call_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50)
    setCalls(data || [])
    setLastUpdated(new Date())
    setLoading(false)
  }

  useEffect(() => {
    fetchCalls()

    // Realtime subscription
    const channel = supabase
      .channel('call_logs_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_logs' },
        () => fetchCalls()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Call Log</h1>
          <p className="text-sm text-gray-400">unmissed.ai — Hasan Sharif</p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
          <button
            onClick={fetchCalls}
            className="text-xs px-3 py-1.5 rounded border border-white/20 hover:bg-white/10 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && calls.length > 0 && (
        <div className="flex gap-6 px-6 py-3 border-b border-white/10 text-sm">
          {(['HOT', 'WARM', 'COLD', 'JUNK'] as const).map(s => {
            const count = calls.filter(c => c.call_status === s).length
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span>{STATUS_EMOJI[s]}</span>
                <span className="text-gray-400">{s}</span>
                <span className="font-semibold">{count}</span>
              </div>
            )
          })}
          <div className="flex items-center gap-1.5 ml-auto text-gray-500">
            Total: <span className="text-white font-semibold">{calls.length}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500">Loading calls...</div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-2">
            <span className="text-4xl">📞</span>
            <p>No calls yet. Make a test call to +15877421507</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-3 font-medium">Time</th>
                <th className="text-left px-6 py-3 font-medium">Caller</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-left px-6 py-3 font-medium">Type</th>
                <th className="text-left px-6 py-3 font-medium">Duration</th>
                <th className="text-left px-6 py-3 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {calls.map(call => (
                <tr key={call.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-gray-300 whitespace-nowrap">
                    {formatTime(call.started_at)}
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-200 whitespace-nowrap">
                    {call.caller_phone || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[call.call_status || 'processing']}`}>
                      {STATUS_EMOJI[call.call_status || 'processing']}
                      {call.call_status || 'processing'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 capitalize">
                    {call.service_type?.replace(/_/g, ' ') || '—'}
                  </td>
                  <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                    {formatDuration(call.duration_seconds)}
                  </td>
                  <td className="px-6 py-4 text-gray-300 max-w-md">
                    <p className="line-clamp-2">{call.ai_summary || '—'}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
