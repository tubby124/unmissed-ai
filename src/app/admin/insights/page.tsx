'use client'

import { useEffect, useState, useCallback } from 'react'

type Issue = {
  severity: 'high' | 'medium' | 'low'
  type: string
  description: string
  example_call_id?: string
  frequency?: string
}

type Recommendation = {
  title: string
  rationale: string
  change_type: string
  priority: 'high' | 'medium' | 'low'
  suggested_value: string
}

type Report = {
  id: string
  analyzed_at: string
  calls_analyzed: number
  period_start: string
  period_end: string
  issues: Issue[]
  recommendations: Recommendation[]
  status: 'pending' | 'approved' | 'rejected' | 'applied'
  applied_at?: string
}

const SEVERITY_COLORS: Record<string, string> = {
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  low: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  applied: 'text-green-400 bg-green-500/10 border-green-500/20',
  rejected: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
  approved: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${className}`}>{label}</span>
}

export default function InsightsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { passed: number; total: number }>>({})

  const load = useCallback(async () => {
    const res = await fetch('/api/dashboard/analysis')
    if (res.ok) {
      const d = await res.json()
      setReports(d.reports || [])
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function runAnalysis() {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/cron/analyze-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''}` },
        body: JSON.stringify({}),
      })
      if (res.ok) await load()
    } finally {
      setAnalyzing(false)
    }
  }

  async function runAnalysisViaProxy() {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/dashboard/analyze-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) await load()
    } finally {
      setAnalyzing(false)
    }
  }

  async function approve(reportId: string, recIdx: number) {
    setApproving(`${reportId}-${recIdx}`)
    const res = await fetch(`/api/dashboard/analysis/${reportId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendation_index: recIdx }),
    })
    const data = await res.json()
    setApproving(null)
    if (data.ok) {
      setTestResult(prev => ({
        ...prev,
        [reportId]: { passed: data.test_run?.passed ?? 0, total: data.test_run?.total ?? 0 },
      }))
      await load()
    }
  }

  async function reject(reportId: string) {
    await fetch(`/api/dashboard/analysis/${reportId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    })
    await load()
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Insights</h1>
          <p className="text-sm text-zinc-500 mt-0.5">AI analysis of real calls — issues, recommendations, self-healing</p>
        </div>
        <button
          onClick={runAnalysisViaProxy}
          disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {analyzing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Run Analysis Now
            </>
          )}
        </button>
      </div>

      {/* Reports */}
      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] py-16 text-center">
          <p className="text-zinc-600 text-sm">No analysis reports yet.</p>
          <p className="text-zinc-700 text-xs mt-1">Click &quot;Run Analysis Now&quot; or wait for the nightly CRON (2 AM UTC).</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(report => {
            const isExpanded = expanded === report.id
            const highIssues = report.issues?.filter(i => i.severity === 'high').length ?? 0
            const runResult = testResult[report.id]

            return (
              <div key={report.id} className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
                {/* Report header */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : report.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white">
                        {new Date(report.analyzed_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <Badge label={report.status.toUpperCase()} className={STATUS_COLORS[report.status] ?? STATUS_COLORS.pending} />
                      {highIssues > 0 && (
                        <Badge label={`${highIssues} HIGH`} className={SEVERITY_COLORS.high} />
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {report.calls_analyzed} calls analyzed · {report.issues?.length ?? 0} issues · {report.recommendations?.length ?? 0} recommendations
                    </div>
                  </div>
                  {runResult && (
                    <div className={`text-xs font-semibold ${runResult.passed === runResult.total ? 'text-green-400' : 'text-red-400'}`}>
                      Tests: {runResult.passed}/{runResult.total}
                    </div>
                  )}
                  <span className="text-zinc-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/[0.06] px-5 pb-5 space-y-5">
                    {/* Issues */}
                    {report.issues?.length > 0 && (
                      <div className="pt-4">
                        <h3 className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Issues</h3>
                        <div className="space-y-2">
                          {report.issues.map((issue, i) => (
                            <div key={i} className="flex gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                              <Badge label={issue.severity.toUpperCase()} className={SEVERITY_COLORS[issue.severity] ?? SEVERITY_COLORS.low} />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-zinc-200">{issue.description}</div>
                                {issue.frequency && <div className="text-xs text-zinc-600 mt-0.5">{issue.frequency}</div>}
                                <div className="text-xs text-zinc-600">{issue.type}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {report.recommendations?.length > 0 && report.status === 'pending' && (
                      <div>
                        <h3 className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Recommendations</h3>
                        <div className="space-y-3">
                          {report.recommendations.map((rec, i) => (
                            <div key={i} className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2">
                              <div className="flex items-start gap-3">
                                <Badge label={rec.priority.toUpperCase()} className={SEVERITY_COLORS[rec.priority] ?? SEVERITY_COLORS.low} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-white">{rec.title}</div>
                                  <div className="text-xs text-zinc-500 mt-0.5">{rec.rationale}</div>
                                </div>
                              </div>
                              {rec.suggested_value && (
                                <div className="text-xs text-zinc-400 bg-black/30 rounded-lg p-3 border border-white/[0.04] font-mono whitespace-pre-wrap">
                                  {rec.suggested_value}
                                </div>
                              )}
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => approve(report.id, i)}
                                  disabled={approving === `${report.id}-${i}`}
                                  className="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                  {approving === `${report.id}-${i}` ? (
                                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  ) : '✓'}
                                  Approve &amp; Apply
                                </button>
                                <button
                                  onClick={() => reject(report.id)}
                                  className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {report.status === 'applied' && (
                      <div className="flex items-center gap-2 text-sm text-green-400">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Applied {report.applied_at ? new Date(report.applied_at).toLocaleString() : ''}
                        {runResult && <span className="text-zinc-400">· Test suite: {runResult.passed}/{runResult.total} passed</span>}
                      </div>
                    )}

                    {report.status === 'rejected' && (
                      <div className="text-sm text-zinc-600">Dismissed — no changes applied.</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* CRON info */}
      <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3 flex items-center gap-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-zinc-600 shrink-0"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <span className="text-xs text-zinc-600">Automatic analysis runs daily at 2 AM UTC via Railway CRON. You can also trigger it manually above.</span>
      </div>
    </div>
  )
}
