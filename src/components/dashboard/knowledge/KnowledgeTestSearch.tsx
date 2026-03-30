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

interface KnowledgeTestSearchProps {
  clientId: string
  isAdmin: boolean
  previewMode?: boolean
}

export default function KnowledgeTestSearch({ clientId, previewMode }: KnowledgeTestSearchProps) {
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
        const err = await res.json().catch(() => ({ error: 'Test query failed' }))
        throw new Error(err.error ?? 'Test query failed')
      }
      const data = await res.json()
      setTestResults(data.results ?? [])
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Test query failed')
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="rounded-xl border b-theme overflow-hidden">
      <div className="px-4 py-3 border-b b-theme flex items-center gap-2">
        <p className="text-xs font-semibold t2">Test Query</p>
        <span className="text-[9px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">pgvector</span>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs t3">
          Ask a question to see what your agent would find in the knowledge base. Only approved chunks are searched.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={testQuery}
            onChange={e => setTestQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTestQuery()}
            placeholder="e.g. What areas do you cover?"
            className="flex-1 bg-transparent border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-blue-500/50"
          />
          <button
            onClick={handleTestQuery}
            disabled={testLoading || !testQuery.trim() || previewMode}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {testLoading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : 'Search'}
          </button>
        </div>

        {testError && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 text-xs text-red-400">
            {testError}
          </div>
        )}

        {testResults !== null && (
          <div className="space-y-2">
            {testResults.length === 0 ? (
              <p className="text-xs t3 py-2">No matching chunks found. The agent would say it&apos;s not sure and offer to follow up.</p>
            ) : (
              <>
                <p className="text-[10px] t3">{testResults.length} chunk{testResults.length !== 1 ? 's' : ''} matched</p>
                {testResults.map((result, i) => (
                  <div key={i} className="rounded-lg border b-theme p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                          result.trust_tier === 'high' ? 'bg-green-400/10 text-green-400'
                            : result.trust_tier === 'low' ? 'bg-red-400/10 text-red-400'
                            : 'bg-amber-400/10 text-amber-400'
                        }`}>
                          {result.trust_tier}
                        </span>
                        <span className="text-[10px] font-medium t3 truncate">{result.source}</span>
                      </div>
                      <span className={`text-[10px] font-mono shrink-0 ${
                        result.similarity >= 0.7 ? 'text-green-400' : result.similarity >= 0.4 ? 'text-amber-400' : 't3'
                      }`}>
                        {(result.similarity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs t2 leading-relaxed whitespace-pre-wrap">{result.content}</p>
                    <div className="flex items-center gap-3 text-[10px] t3">
                      <span>type: {result.chunk_type}</span>
                      <span>rrf: {result.rrf_score.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
