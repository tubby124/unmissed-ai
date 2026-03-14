'use client'

import { useState, useEffect } from 'react'

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
  auto_glass: 'Auto Glass (Mark)',
  property_mgmt: 'Property Mgmt (Alisha)',
  voicemail: 'Real Estate (Aisha)',
  hasan_sharif_live: 'Hasan Live Test',
}

export default function DemoStats() {
  const [data, setData] = useState<DemoStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/demo-stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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
        className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors mb-3"
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

          {/* Most popular */}
          {stats.popularAgent && (
            <p className="text-xs text-gray-500 mb-3">
              Most tried: <span className="text-gray-300">{AGENT_LABELS[stats.popularAgent] || stats.popularAgent}</span>
            </p>
          )}

          {/* Recent demos table */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f1f1f' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs" style={{ backgroundColor: '#111' }}>
                  <th className="px-3 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Caller</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">Source</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">Duration</th>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Conv</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.slice(0, 20).map(call => (
                  <tr key={call.id} className="border-t" style={{ borderColor: '#1a1a1a' }}>
                    <td className="px-3 py-2 text-gray-300">
                      {AGENT_LABELS[call.demoId] || call.demoId}
                    </td>
                    <td className="px-3 py-2 text-gray-400">{call.callerName}</td>
                    <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${call.source === 'phone' ? 'bg-violet-500/10 text-violet-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {call.source}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">
                      {call.durationSeconds ? formatDuration(call.durationSeconds) : '--'}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{formatTime(call.startedAt)}</td>
                    <td className="px-3 py-2">
                      {call.converted ? (
                        <span className="text-green-400 text-xs">Yes</span>
                      ) : (
                        <span className="text-gray-600 text-xs">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: '#111', border: '1px solid #1f1f1f' }}>
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className="text-white text-xl font-bold">{value}</p>
      {sub && <p className="text-gray-600 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}
