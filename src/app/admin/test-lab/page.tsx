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

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Test Lab</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Simulate calls and verify the full pipeline end-to-end</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Client switcher */}
          {clients.length > 1 && (
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40 cursor-pointer"
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
            <div className="text-sm font-medium text-white">{lastRun.failed === 0 ? 'All scenarios passed' : `${lastRun.failed} scenario${lastRun.failed > 1 ? 's' : ''} failed`}</div>
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
          <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Name *</label>
                <input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40"
                  placeholder="HOT — Urgent callback" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Expected Status *</label>
                <select value={addForm.expected_status} onChange={e => setAddForm(p => ({ ...p, expected_status: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40">
                  {['HOT','WARM','COLD','JUNK','UNKNOWN'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Description</label>
              <input value={addForm.description} onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40"
                placeholder="What this scenario tests" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Transcript (JSON array) *</label>
              <textarea value={addForm.transcript} onChange={e => setAddForm(p => ({ ...p, transcript: e.target.value }))}
                rows={4}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40 resize-none"
                placeholder='[{"role":"agent","text":"..."},{"role":"user","text":"..."}]' />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Tags (comma-separated)</label>
              <input value={addForm.tags} onChange={e => setAddForm(p => ({ ...p, tags: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40"
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
          <div className="rounded-xl border border-dashed border-white/[0.08] py-10 text-center text-zinc-600 text-sm">
            No scenarios yet. Add your first one above.
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
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
                    <tr key={s.id} className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                      <td className="px-4 py-3 text-white font-medium">
                        {s.name}
                        {s.description && <div className="text-xs text-zinc-600 mt-0.5">{s.description}</div>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={s.expected_status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(s.tags || []).map(t => (
                            <span key={t} className="text-[10px] text-zinc-500 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">{t}</span>
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
              <div key={run.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <span className={`text-sm font-semibold ${run.failed === 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {run.passed}/{run.total}
                  </span>
                  <span className="text-sm text-zinc-400">{new Date(run.ran_at).toLocaleString()}</span>
                  <span className="text-xs text-zinc-600">{run.triggered_by}</span>
                  <span className="ml-auto text-zinc-600 text-xs">{expandedRun === run.id ? '▲' : '▼'}</span>
                </button>
                {expandedRun === run.id && run.results && (
                  <div className="border-t border-white/[0.06] px-4 pb-3">
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
