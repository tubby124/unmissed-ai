'use client'

import { useState } from 'react'

interface TestResult {
  content: string
  chunk_type: string
  source: string
  similarity: number
  rrf_score: number
  trust_tier: string
}

interface TestQuerySectionProps {
  clientId: string
  previewMode?: boolean
}

export default function TestQuerySection({ clientId, previewMode }: TestQuerySectionProps) {
  const [testQuery, setTestQuery] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[] | null>(null)
  const [testError, setTestError] = useState('')

  async function handleTestQuery() {
    if (!testQuery.trim()) return
    setTestLoading(true)
    setTestError('')
    setTestResults(null)
    try {
      const res = await fetch('/api/dashboard/knowledge/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, query: testQuery.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Query failed' }))
        throw new Error(err.error ?? 'Query failed')
      }
      const data = await res.json()
      setTestResults(data.results ?? [])
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Query failed')
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="rounded-xl border b-theme p-3 space-y-2">
      <p className="text-[10px] font-semibold t3">Quick Test</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={testQuery}
          onChange={e => setTestQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleTestQuery()}
          placeholder="Ask a question..."
          className="flex-1 bg-transparent border b-theme rounded-lg px-2.5 py-1.5 text-xs t1 placeholder:t3 focus:outline-none focus:border-blue-500/50"
        />
        <button
          onClick={handleTestQuery}
          disabled={testLoading || !testQuery.trim() || previewMode}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-50 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          {testLoading ? '...' : 'Search'}
        </button>
      </div>

      {testError && (
        <p className="text-[10px] text-red-400">{testError}</p>
      )}

      {testResults !== null && (
        <div className="space-y-1.5">
          {testResults.length === 0 ? (
            <p className="text-[10px] t3">No matching chunks. Agent would say it&apos;s not sure.</p>
          ) : (
            testResults.slice(0, 3).map((result) => (
              <div key={`${result.source}-${result.chunk_type}-${(result.similarity * 10000).toFixed(0)}`} className="rounded-lg border b-theme p-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                    result.trust_tier === 'high' ? 'bg-green-400/10 text-green-400'
                      : result.trust_tier === 'low' ? 'bg-red-400/10 text-red-400'
                      : 'bg-amber-400/10 text-amber-400'
                  }`}>
                    {result.trust_tier}
                  </span>
                  <span className={`text-[9px] font-mono ${
                    result.similarity >= 0.7 ? 'text-green-400' : result.similarity >= 0.4 ? 'text-amber-400' : 'text-zinc-500'
                  }`}>
                    {(result.similarity * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-[11px] t2 leading-relaxed line-clamp-2">{result.content}</p>
              </div>
            ))
          )}
          {testResults.length > 3 && (
            <p className="text-[10px] t3">+{testResults.length - 3} more — see full results in Knowledge tab.</p>
          )}
        </div>
      )}
    </div>
  )
}
