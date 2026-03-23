'use client'

import { useEffect, useState, useCallback } from 'react'

type Client = { id: string; slug: string; business_name: string }

type Scenario = {
  id: string
  name: string
  description: string | null
  expected_status: string
  tags: string[] | null
  created_at: string
}

type ScenarioResult = {
  scenario_id: string
  name: string
  expected: string
  got: string
  passed: boolean
  confidence: number
  summary?: string
}

type LoopState = 'idle' | 'loading' | 'done' | 'error'
type LoopChange = { type: string; section: string; what: string; why: string; confidence: 'high' | 'medium' | 'low' }
type LoopResult = {
  improved_prompt: string | null
  changes: LoopChange[]
  no_changes_needed: boolean
  call_count: number
  has_enough_data: boolean
}

type TestRun = {
  id: string
  ran_at: string
  triggered_by: string
  total: number
  passed: number
  failed: number
  results: ScenarioResult[]
}

const STATUS_COLORS: Record<string, string> = {
  HOT: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  WARM: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  COLD: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  JUNK: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
  UNKNOWN: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[status] ?? 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'}`}>
      {status}
    </span>
  )
}

function PassFailBadge({ passed }: { passed: boolean }) {
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${passed ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
      {passed ? 'PASS' : 'FAIL'}
    </span>
  )
}

export default function TestLabPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [runs, setRuns] = useState<TestRun[]>([])
  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState<TestRun | null>(null)
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const [loopState, setLoopState] = useState<LoopState>('idle')
  const [loopResult, setLoopResult] = useState<LoopResult | null>(null)
  const [loopError, setLoopError] = useState('')
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', description: '', expected_status: 'HOT', transcript: '', tags: '' })
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // Load clients on mount
  useEffect(() => {
    fetch('/api/dashboard/clients').then(r => r.json()).then(d => {
      const list: Client[] = d.clients || []
      setClients(list)
      if (list.length > 0) setSelectedClientId(list[0].id)
    })
  }, [])

  const load = useCallback(async (clientId: string) => {
    if (!clientId) return
    const [sRes, rRes] = await Promise.all([
      fetch(`/api/dashboard/test-scenarios?client_id=${clientId}`),
      fetch(`/api/dashboard/test-runs?client_id=${clientId}`),
    ])
    if (sRes.ok) setScenarios((await sRes.json()).scenarios || [])
    if (rRes.ok) setRuns((await rRes.json()).runs || [])
  }, [])

  useEffect(() => {
    if (selectedClientId) {
      setLastRun(null)
      load(selectedClientId)
    }
  }, [selectedClientId, load])

  // Pre-load pending loop suggestion from cron (if available) — avoids redundant OpenRouter call
  useEffect(() => {
    if (!selectedClientId) return
    setLoopState('idle')
    setLoopResult(null)
    setLoopError('')
    setApplied(false)
    fetch(`/api/dashboard/settings/learning-status?client_id=${selectedClientId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.loop_suggestion) return
        const s = data.loop_suggestion as { improved_prompt: string; changes: LoopChange[]; calls_analyzed: number }
        if (s.improved_prompt) {
          setLoopResult({
            improved_prompt: s.improved_prompt,
            changes: s.changes ?? [],
            no_changes_needed: false,
            call_count: s.calls_analyzed ?? 0,
            has_enough_data: true,
          })
          setLoopState('done')
        }
      })
      .catch(() => { /* silent — non-critical */ })
  }, [selectedClientId])

  const selectedClient = clients.find(c => c.id === selectedClientId)

  async function runSuite() {
    if (!selectedClient) return
    setRunning(true)
    setLastRun(null)
    try {
      const res = await fetch('/api/dashboard/run-test-suite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: selectedClient.slug }),
      })
      const data = await res.json()
      setLastRun(data)
      await load(selectedClientId)
    } finally {
      setRunning(false)
    }
  }

  async function deleteScenario(id: string) {
    await fetch(`/api/dashboard/test-scenarios/${id}`, { method: 'DELETE' })
    setScenarios(prev => prev.filter(s => s.id !== id))
  }

  async function addScenario() {
    setAddError('')
    if (!selectedClientId) { setAddError('No client selected'); return }
    let transcript: unknown
    try {
      transcript = JSON.parse(addForm.transcript)
    } catch {
      setAddError('Transcript must be valid JSON array')
      return
    }
    setAddLoading(true)
    const tags = addForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    const res = await fetch('/api/dashboard/test-scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addForm, transcript, tags, client_id: selectedClientId }),
    })
    const data = await res.json()
    setAddLoading(false)
    if (!res.ok) { setAddError(data.error || 'Failed'); return }
    setScenarios(prev => [...prev, data.scenario])
    setShowAddForm(false)
    setAddForm({ name: '', description: '', expected_status: 'HOT', transcript: '', tags: '' })
  }

  async function analyzeLoop() {
    if (!selectedClientId) return
    setLoopState('loading')
    setLoopResult(null)
    setLoopError('')
    setApplied(false)
    try {
      const res = await fetch('/api/dashboard/settings/improve-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: selectedClientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setLoopResult(data)
      setLoopState('done')
    } catch (e) {
      setLoopError(e instanceof Error ? e.message : String(e))
      setLoopState('error')
    }
  }

  async function applyLoop() {
    if (!loopResult?.improved_prompt) return
    setApplying(true)
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_prompt: loopResult.improved_prompt, client_id: selectedClientId }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Save failed') }
      // Clear the pending suggestion so the next cron run can generate a fresh one
      await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending_loop_suggestion: null, client_id: selectedClientId }),
      }).catch(() => { /* non-critical */ })
      setApplied(true)
      setLoopState('idle')
      setLoopResult(null)
    } catch (e) {
      setLoopError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold t1">Test Lab</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Simulate calls and verify the full pipeline end-to-end</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Client switcher */}
          {clients.length > 1 && (
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="bg-hover border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 cursor-pointer"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.business_name}</option>
              ))}
            </select>
          )}

          <button
            onClick={runSuite}
            disabled={running || scenarios.length === 0 || !selectedClientId}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {running ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="currentColor"/></svg>
                Run All ({scenarios.length})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Last run result banner */}
      {lastRun && (
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-4 ${lastRun.failed === 0 ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
          <span className={`text-2xl font-bold ${lastRun.failed === 0 ? 'text-green-400' : 'text-red-400'}`}>
            {lastRun.passed}/{lastRun.total}
          </span>
          <div>
            <div className="text-sm font-medium t1">{lastRun.failed === 0 ? 'All scenarios passed' : `${lastRun.failed} scenario${lastRun.failed > 1 ? 's' : ''} failed`}</div>
            <div className="text-xs text-zinc-500 mt-0.5">Just ran · {new Date().toLocaleTimeString()}</div>
          </div>
          {lastRun.results?.length > 0 && (
            <div className="ml-auto flex flex-wrap gap-1.5">
              {lastRun.results.map(r => (
                <span key={r.scenario_id} title={`${r.name}: expected ${r.expected}, got ${r.got}`}>
                  <PassFailBadge passed={r.passed} />
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Learning Loop */}
      <section className="rounded-xl border b-theme bg-hover p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold t1">Learning Loop</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Analyze real conversations and apply targeted prompt improvements. Auto-runs via cron + Telegram when 5+ new calls arrive.
            </p>
          </div>
          <button
            onClick={analyzeLoop}
            disabled={loopState === 'loading' || !selectedClientId}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shrink-0"
          >
            {loopState === 'loading' ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing…
              </>
            ) : 'Analyze Now'}
          </button>
        </div>

        {loopState === 'error' && loopError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{loopError}</p>
        )}

        {applied && (
          <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
            Prompt updated and synced to Ultravox agent.
          </div>
        )}

        {loopState === 'done' && loopResult && (
          <div className="space-y-4">
            <div className="text-xs text-zinc-500">
              Based on{' '}
              <span className="text-zinc-300 font-medium">{loopResult.call_count} real conversations</span>
              {!loopResult.has_enough_data && (
                <span className="text-yellow-500 ml-2">(fewer than 3 conversations — limited signal)</span>
              )}
            </div>

            {loopResult.no_changes_needed && (
              <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
                Prompt is handling calls well — no changes needed.
              </div>
            )}

            {!loopResult.no_changes_needed && loopResult.changes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                  {loopResult.changes.length} suggested change{loopResult.changes.length > 1 ? 's' : ''}
                </p>
                {loopResult.changes.map((c, i) => (
                  <div key={i} className="rounded-lg border b-theme bg-hover px-4 py-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        c.confidence === 'high'
                          ? 'text-green-400 bg-green-500/10 border-green-500/20'
                          : c.confidence === 'medium'
                          ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                          : 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'
                      }`}>{c.confidence}</span>
                      <span className="text-[10px] font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full uppercase">
                        {c.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-zinc-500">§ {c.section}</span>
                    </div>
                    <p className="text-sm t1">{c.what}</p>
                    <p className="text-xs text-zinc-500 italic">{c.why}</p>
                  </div>
                ))}
              </div>
            )}

            {!loopResult.no_changes_needed && loopResult.improved_prompt && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={applyLoop}
                  disabled={applying}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  {applying ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : 'Apply & Deploy'}
                </button>
                <button
                  onClick={() => { setLoopState('idle'); setLoopResult(null) }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Scenario Library */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-300">
            Scenario Library
            {selectedClient && <span className="text-zinc-600 font-normal ml-2">— {selectedClient.business_name}</span>}
          </h2>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-400/40 px-3 py-1 rounded-lg transition-colors"
          >
            + Add Scenario
          </button>
        </div>

        {showAddForm && (
          <div className="mb-4 rounded-xl border b-theme bg-hover p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Name *</label>
                <input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40"
                  placeholder="HOT — Urgent callback" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Expected Status *</label>
                <select value={addForm.expected_status} onChange={e => setAddForm(p => ({ ...p, expected_status: e.target.value }))}
                  className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40">
                  {['HOT','WARM','COLD','JUNK','UNKNOWN'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Description</label>
              <input value={addForm.description} onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))}
                className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40"
                placeholder="What this scenario tests" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Transcript (JSON array) *</label>
              <textarea value={addForm.transcript} onChange={e => setAddForm(p => ({ ...p, transcript: e.target.value }))}
                rows={4}
                className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40 resize-none"
                placeholder='[{"role":"agent","text":"..."},{"role":"user","text":"..."}]' />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Tags (comma-separated)</label>
              <input value={addForm.tags} onChange={e => setAddForm(p => ({ ...p, tags: e.target.value }))}
                className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40"
                placeholder="regression, real-estate, edge-case" />
            </div>
            {addError && <p className="text-xs text-red-400">{addError}</p>}
            <div className="flex gap-2">
              <button onClick={addScenario} disabled={addLoading}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white text-sm rounded-lg font-medium transition-colors">
                {addLoading ? 'Saving…' : 'Save Scenario'}
              </button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {scenarios.length === 0 ? (
          <div className="rounded-xl border border-dashed b-theme py-10 text-center text-zinc-600 text-sm">
            No scenarios yet. Add your first one above.
          </div>
        ) : (
          <div className="rounded-xl border b-theme overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b b-theme text-left">
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500">Expected</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500">Tags</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500">Last Result</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s, i) => {
                  const runResult = lastRun?.results?.find(r => r.scenario_id === s.id)
                  return (
                    <tr key={s.id} className={`border-b border-[var(--color-border)] last:border-0 hover:bg-hover ${i % 2 === 0 ? '' : 'bg-page'}`}>
                      <td className="px-4 py-3 t1 font-medium">
                        {s.name}
                        {s.description && <div className="text-xs text-zinc-600 mt-0.5">{s.description}</div>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={s.expected_status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(s.tags || []).map(t => (
                            <span key={t} className="text-[10px] text-zinc-500 bg-hover border b-theme rounded px-1.5 py-0.5">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {runResult ? (
                          <div className="flex items-center gap-2">
                            <PassFailBadge passed={runResult.passed} />
                            {!runResult.passed && <span className="text-xs text-zinc-500">got {runResult.got}</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteScenario(s.id)}
                          className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Run History */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">Run History</h2>
        {runs.length === 0 ? (
          <div className="text-sm text-zinc-600">No runs yet. Click &quot;Run All&quot; to start.</div>
        ) : (
          <div className="space-y-2">
            {runs.slice(0, 10).map(run => (
              <div key={run.id} className="rounded-xl border b-theme bg-hover overflow-hidden">
                <button
                  onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-hover transition-colors text-left"
                >
                  <span className={`text-sm font-semibold ${run.failed === 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {run.passed}/{run.total}
                  </span>
                  <span className="text-sm text-zinc-400">{new Date(run.ran_at).toLocaleString()}</span>
                  <span className="text-xs text-zinc-600">{run.triggered_by}</span>
                  <span className="ml-auto text-zinc-600 text-xs">{expandedRun === run.id ? '▲' : '▼'}</span>
                </button>
                {expandedRun === run.id && run.results && (
                  <div className="border-t b-theme px-4 pb-3">
                    <div className="space-y-1.5 mt-3">
                      {run.results.map(r => (
                        <div key={r.scenario_id} className="flex items-center gap-3 text-sm">
                          <PassFailBadge passed={r.passed} />
                          <span className="text-zinc-300 flex-1">{r.name}</span>
                          <span className="text-xs text-zinc-600">expected <StatusBadge status={r.expected} /></span>
                          {!r.passed && <span className="text-xs text-zinc-600">got <StatusBadge status={r.got} /></span>}
                          <span className="text-xs text-zinc-600">{r.confidence}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
