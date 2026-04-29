'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

// Sentinels — kept as JS string consts so we can use them safely in JSX text
const EMDASH = '—'
const ELLIPSIS = '…'
const ARROW = '→'

// ── Types ────────────────────────────────────────────────────────────────────

interface Lesson {
  id: string
  client_id: string | null
  call_id: string | null
  observation_type: string | null
  what_happened: string | null
  recommended_change: string | null
  severity: string | null
  status: string | null
  source: string | null
  created_at: string
  reviewed_at: string | null
  // joined
  clients?: { slug?: string | null; business_name?: string | null } | null
  call_logs?: { duration_seconds?: number | null; started_at?: string | null } | null
}

interface Pattern {
  id: string
  name: string
  category: string
  verbatim_line: string
  rationale: string
  niche_applicability: string[] | null
  source_slug: string | null
  source_call_id: string | null
  status: string
  score: number | null
  promoted_at: string | null
  added_at?: string | null
  notes: string | null
}

interface ApplicationLogRow {
  id: string
  applied_at: string
  pattern_id: string | null
  applied_to_slug: string | null
  prompt_version_before: number | string | null
  prompt_version_after: number | string | null
  before_metrics: unknown
  after_metrics: unknown
  // joined
  prompt_patterns?: { name?: string | null } | null
}

type Tab = 'lessons' | 'patterns' | 'log'

// ── UI primitives ────────────────────────────────────────────────────────────

function Badge({ tone, children }: { tone: 'red' | 'amber' | 'green' | 'blue' | 'slate'; children: React.ReactNode }) {
  const palette: Record<string, string> = {
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    blue: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    slate: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${palette[tone]}`}>
      {children}
    </span>
  )
}

function severityTone(sev: string | null): 'red' | 'amber' | 'blue' | 'slate' {
  if (sev === 'high') return 'red'
  if (sev === 'medium') return 'amber'
  if (sev === 'low') return 'blue'
  return 'slate'
}

function obsTypeTone(t: string | null): 'red' | 'amber' | 'green' | 'blue' | 'slate' {
  if (t === 'failure') return 'red'
  if (t === 'edge_case') return 'amber'
  if (t === 'success') return 'green'
  if (t === 'knowledge_gap') return 'blue'
  return 'slate'
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return ''
  if (s.length <= n) return s
  return s.slice(0, n - 1) + ELLIPSIS
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      year: '2-digit', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ── Promote modal ────────────────────────────────────────────────────────────

function PromoteDialog({
  lesson,
  onClose,
  onPromoted,
}: {
  lesson: Lesson
  onClose: () => void
  onPromoted: () => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('voice')
  const [verbatim, setVerbatim] = useState(lesson.recommended_change ?? '')
  const [rationale, setRationale] = useState(lesson.what_happened ?? '')
  const [niches, setNiches] = useState('all')
  const [score, setScore] = useState('0')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const nicheArr = niches.split(',').map(s => s.trim()).filter(Boolean)
      const r = await fetch('/api/admin/learning-bank/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_id: lesson.id,
          pattern: {
            name: name.trim(),
            category: category.trim(),
            verbatim_line: verbatim.trim(),
            rationale: rationale.trim(),
            niche_applicability: nicheArr.length > 0 ? nicheArr : ['all'],
            score: Number.isFinite(parseFloat(score)) ? parseFloat(score) : 0,
            notes: notes.trim() || undefined,
          },
        }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) {
        throw new Error(j?.error ?? `HTTP ${r.status}`)
      }
      onPromoted()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const lessonMeta = `${lesson.clients?.slug ?? EMDASH} · ${lesson.observation_type ?? EMDASH} · ${formatDate(lesson.created_at)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-white/10 bg-zinc-900 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold t1">Promote lesson to pattern</h2>
          <button onClick={onClose} className="text-xs t3 hover:t1">Close</button>
        </div>

        <p className="text-[11px] t3">From {lessonMeta}</p>

        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] t2 space-y-1 col-span-2">
            <span>Name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Soft confirm before transfer"
              className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] t1"
            />
          </label>
          <label className="text-[11px] t2 space-y-1">
            <span>Category</span>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] t1"
            >
              <option value="voice">voice</option>
              <option value="conversation_flow">conversation_flow</option>
              <option value="transfer">transfer</option>
              <option value="booking">booking</option>
              <option value="objection">objection</option>
              <option value="closing">closing</option>
              <option value="knowledge">knowledge</option>
              <option value="safety">safety</option>
              <option value="other">other</option>
            </select>
          </label>
          <label className="text-[11px] t2 space-y-1">
            <span>Score</span>
            <input
              type="number"
              step="0.1"
              value={score}
              onChange={e => setScore(e.target.value)}
              className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] t1"
            />
          </label>
          <label className="text-[11px] t2 space-y-1 col-span-2">
            <span>Verbatim line (what the prompt should say)</span>
            <textarea
              value={verbatim}
              onChange={e => setVerbatim(e.target.value)}
              rows={3}
              className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] t1 font-mono"
            />
          </label>
          <label className="text-[11px] t2 space-y-1 col-span-2">
            <span>Rationale (why this works)</span>
            <textarea
              value={rationale}
              onChange={e => setRationale(e.target.value)}
              rows={2}
              className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] t1"
            />
          </label>
          <label className="text-[11px] t2 space-y-1 col-span-2">
            <span>Niche applicability (comma-separated, use &quot;all&quot; for global)</span>
            <input
              value={niches}
              onChange={e => setNiches(e.target.value)}
              placeholder="all"
              className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] t1"
            />
          </label>
          <label className="text-[11px] t2 space-y-1 col-span-2">
            <span>Notes (optional)</span>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] t1"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded border border-white/10 px-3 py-1.5 text-[11px] t2 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !name.trim() || !verbatim.trim() || !rationale.trim()}
            className="rounded bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {submitting ? `Promoting${ELLIPSIS}` : 'Promote'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Open Lessons ────────────────────────────────────────────────────────

function LessonsTab({ onCountsChanged }: { onCountsChanged: () => void }) {
  const [lessons, setLessons] = useState<Lesson[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [severity, setSeverity] = useState('all')
  const [obsType, setObsType] = useState('all')
  const [source, setSource] = useState('all')
  const [promoteTarget, setPromoteTarget] = useState<Lesson | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await fetch('/api/admin/learning-bank/lessons?status=open&limit=200', {
        cache: 'no-store',
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`)
      setLessons(j.lessons ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLessons([])
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!lessons) return []
    return lessons.filter(l => {
      if (severity !== 'all' && l.severity !== severity) return false
      if (obsType !== 'all' && l.observation_type !== obsType) return false
      if (source !== 'all' && l.source !== source) return false
      return true
    })
  }, [lessons, severity, obsType, source])

  const sources = useMemo(() => {
    const s = new Set<string>()
    for (const l of lessons ?? []) {
      if (l.source) s.add(l.source)
    }
    return Array.from(s).sort()
  }, [lessons])

  const reject = async (id: string) => {
    try {
      const r = await fetch('/api/admin/learning-bank/lessons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'rejected' }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j?.error ?? `HTTP ${r.status}`)
      setLessons(prev => (prev ?? []).filter(l => l.id !== id))
      onCountsChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <select value={severity} onChange={e => setSeverity(e.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 t1">
          <option value="all">severity: all</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
        <select value={obsType} onChange={e => setObsType(e.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 t1">
          <option value="all">type: all</option>
          <option value="failure">failure</option>
          <option value="success">success</option>
          <option value="edge_case">edge_case</option>
          <option value="knowledge_gap">knowledge_gap</option>
        </select>
        <select value={source} onChange={e => setSource(e.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 t1">
          <option value="all">source: all</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} className="rounded border border-white/10 px-2 py-1 t2 hover:bg-white/5">Refresh</button>
        <span className="t3">{filtered.length} of {lessons?.length ?? 0}</span>
      </div>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-400">{error}</div>
      )}

      <div className="overflow-x-auto rounded border border-white/10">
        <table className="w-full text-[11px]">
          <thead className="bg-white/5 t3">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium">Created</th>
              <th className="text-left px-2 py-1.5 font-medium">Severity</th>
              <th className="text-left px-2 py-1.5 font-medium">Type</th>
              <th className="text-left px-2 py-1.5 font-medium">What happened</th>
              <th className="text-left px-2 py-1.5 font-medium">Client</th>
              <th className="text-left px-2 py-1.5 font-medium">Call</th>
              <th className="text-right px-2 py-1.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lessons === null && (
              <tr><td colSpan={7} className="px-2 py-3 t3">Loading{ELLIPSIS}</td></tr>
            )}
            {lessons !== null && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-3 t3">No open lessons.</td></tr>
            )}
            {filtered.map(l => (
              <tr key={l.id} className="border-t border-white/5">
                <td className="px-2 py-1.5 t2 whitespace-nowrap">{formatDate(l.created_at)}</td>
                <td className="px-2 py-1.5"><Badge tone={severityTone(l.severity)}>{l.severity ?? EMDASH}</Badge></td>
                <td className="px-2 py-1.5"><Badge tone={obsTypeTone(l.observation_type)}>{l.observation_type ?? EMDASH}</Badge></td>
                <td className="px-2 py-1.5 t1" title={l.what_happened ?? ''}>{truncate(l.what_happened, 100)}</td>
                <td className="px-2 py-1.5 t2 whitespace-nowrap">{l.clients?.slug ?? EMDASH}</td>
                <td className="px-2 py-1.5 t2 whitespace-nowrap">
                  {l.call_id ? (
                    <a className="underline hover:t1" href={`/dashboard/calls/${l.call_id}`}>view</a>
                  ) : EMDASH}
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap space-x-1">
                  <button
                    onClick={() => setPromoteTarget(l)}
                    className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300 hover:bg-emerald-500/20"
                  >
                    Promote
                  </button>
                  <button
                    onClick={() => reject(l.id)}
                    className="rounded border border-white/10 bg-black/40 px-2 py-0.5 t2 hover:bg-white/5"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {promoteTarget && (
        <PromoteDialog
          lesson={promoteTarget}
          onClose={() => setPromoteTarget(null)}
          onPromoted={() => {
            const id = promoteTarget.id
            setPromoteTarget(null)
            setLessons(prev => (prev ?? []).filter(l => l.id !== id))
            onCountsChanged()
          }}
        />
      )}
    </div>
  )
}

// ── Tab: Promoted Patterns ───────────────────────────────────────────────────

function PatternsTab({ onCountsChanged }: { onCountsChanged: () => void }) {
  const [patterns, setPatterns] = useState<Pattern[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [niche, setNiche] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const params = new URLSearchParams({ status: 'promoted' })
      if (category !== 'all') params.set('category', category)
      if (niche.trim()) params.set('niche', niche.trim())
      const r = await fetch(`/api/admin/learning-bank/patterns?${params.toString()}`, {
        cache: 'no-store',
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`)
      setPatterns(j.patterns ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPatterns([])
    }
  }, [category, niche])

  useEffect(() => { load() }, [load])

  const retire = async (id: string) => {
    try {
      const r = await fetch('/api/admin/learning-bank/patterns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'retired' }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j?.error ?? `HTTP ${r.status}`)
      setPatterns(prev => (prev ?? []).filter(p => p.id !== id))
      onCountsChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <select value={category} onChange={e => setCategory(e.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 t1">
          <option value="all">category: all</option>
          <option value="voice">voice</option>
          <option value="conversation_flow">conversation_flow</option>
          <option value="transfer">transfer</option>
          <option value="booking">booking</option>
          <option value="objection">objection</option>
          <option value="closing">closing</option>
          <option value="knowledge">knowledge</option>
          <option value="safety">safety</option>
          <option value="other">other</option>
        </select>
        <input
          value={niche}
          onChange={e => setNiche(e.target.value)}
          placeholder="niche filter (e.g. plumbing)"
          className="rounded border border-white/10 bg-black/40 px-2 py-1 t1"
        />
        <button onClick={load} className="rounded border border-white/10 px-2 py-1 t2 hover:bg-white/5">Apply</button>
        <span className="t3">{patterns?.length ?? 0} pattern(s)</span>
      </div>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {patterns === null && (
          <p className="t3 text-[11px]">Loading{ELLIPSIS}</p>
        )}
        {patterns !== null && patterns.length === 0 && (
          <p className="t3 text-[11px]">No promoted patterns match.</p>
        )}
        {(patterns ?? []).map(p => (
          <div key={p.id} className="rounded border border-white/10 bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[12px] font-semibold t1 truncate">{p.name}</h3>
                  <Badge tone="blue">{p.category}</Badge>
                  <span className="text-[10px] t3">score {p.score ?? 0}</span>
                </div>
                {p.source_slug && (
                  <p className="text-[10px] t3 mt-0.5">
                    from {p.source_slug}{p.promoted_at ? ` · ${formatDate(p.promoted_at)}` : ''}
                  </p>
                )}
              </div>
              <button
                onClick={() => retire(p.id)}
                className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300 hover:bg-amber-500/20 whitespace-nowrap"
              >
                Retire
              </button>
            </div>

            <pre className="text-[11px] font-mono whitespace-pre-wrap break-words rounded bg-black/40 border border-white/5 p-2 t1">{p.verbatim_line}</pre>
            <p className="text-[11px] t2">{p.rationale}</p>

            <div className="flex flex-wrap gap-1">
              {(p.niche_applicability ?? []).map(n => (
                <span key={n} className="text-[10px] rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 t2">{n}</span>
              ))}
            </div>

            {p.notes && <p className="text-[10px] t3 italic">{p.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab: Application Log ─────────────────────────────────────────────────────

function ApplicationLogTab() {
  const [rows, setRows] = useState<ApplicationLogRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      // The dedicated /api/admin/learning-bank/log endpoint may be added later
      // by a separate agent. Probe and gracefully handle absence.
      const r = await fetch('/api/admin/learning-bank/log', { cache: 'no-store' })
      if (r.status === 404) {
        setRows([])
        return
      }
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`)
      setRows(j.rows ?? j.log ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px]">
        <button onClick={load} className="rounded border border-white/10 px-2 py-1 t2 hover:bg-white/5">Refresh</button>
        <span className="t3">{rows?.length ?? 0} row(s)</span>
      </div>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-400">{error}</div>
      )}

      <div className="overflow-x-auto rounded border border-white/10">
        <table className="w-full text-[11px]">
          <thead className="bg-white/5 t3">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium">Applied at</th>
              <th className="text-left px-2 py-1.5 font-medium">Pattern</th>
              <th className="text-left px-2 py-1.5 font-medium">Slug</th>
              <th className="text-left px-2 py-1.5 font-medium">Version</th>
              <th className="text-left px-2 py-1.5 font-medium">Metrics</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr><td colSpan={5} className="px-2 py-3 t3">Loading{ELLIPSIS}</td></tr>
            )}
            {rows !== null && rows.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-3 t3">
                No application log entries yet. (The log endpoint may not be wired in this environment.)
              </td></tr>
            )}
            {(rows ?? []).map(row => {
              const before = typeof row.before_metrics === 'object' && row.before_metrics
                ? JSON.stringify(row.before_metrics)
                : String(row.before_metrics ?? EMDASH)
              const after = typeof row.after_metrics === 'object' && row.after_metrics
                ? JSON.stringify(row.after_metrics)
                : String(row.after_metrics ?? EMDASH)
              const metricsStr = `${before} ${ARROW} ${after}`
              return (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="px-2 py-1.5 t2 whitespace-nowrap">{formatDate(row.applied_at)}</td>
                  <td className="px-2 py-1.5 t1">{row.prompt_patterns?.name ?? row.pattern_id ?? EMDASH}</td>
                  <td className="px-2 py-1.5 t2 whitespace-nowrap">{row.applied_to_slug ?? EMDASH}</td>
                  <td className="px-2 py-1.5 t2 whitespace-nowrap">
                    {row.prompt_version_before ?? EMDASH} {ARROW} {row.prompt_version_after ?? EMDASH}
                  </td>
                  <td className="px-2 py-1.5 t2 font-mono text-[10px] truncate max-w-[280px]" title={metricsStr}>
                    {truncate(metricsStr, 60)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Container ────────────────────────────────────────────────────────────────

export default function LearningBankClient({
  initialOpenLessonCount,
  initialPromotedPatternCount,
}: {
  initialOpenLessonCount: number
  initialPromotedPatternCount: number
}) {
  const [tab, setTab] = useState<Tab>('lessons')
  const [openLessonCount, setOpenLessonCount] = useState(initialOpenLessonCount)
  const [promotedPatternCount, setPromotedPatternCount] = useState(initialPromotedPatternCount)

  const refreshCounts = useCallback(async () => {
    try {
      const [lessonsR, patternsR] = await Promise.all([
        fetch('/api/admin/learning-bank/lessons?status=open&limit=500', { cache: 'no-store' }),
        fetch('/api/admin/learning-bank/patterns?status=promoted', { cache: 'no-store' }),
      ])
      if (lessonsR.ok) {
        const j = await lessonsR.json()
        setOpenLessonCount((j.lessons ?? []).length)
      }
      if (patternsR.ok) {
        const j = await patternsR.json()
        setPromotedPatternCount((j.patterns ?? []).length)
      }
    } catch {
      // silent
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-white/10">
        <TabButton active={tab === 'lessons'} onClick={() => setTab('lessons')}>
          Open Lessons <span className="t3">({openLessonCount})</span>
        </TabButton>
        <TabButton active={tab === 'patterns'} onClick={() => setTab('patterns')}>
          Promoted Patterns <span className="t3">({promotedPatternCount})</span>
        </TabButton>
        <TabButton active={tab === 'log'} onClick={() => setTab('log')}>
          Application Log
        </TabButton>
      </div>

      {tab === 'lessons' && <LessonsTab onCountsChanged={refreshCounts} />}
      {tab === 'patterns' && <PatternsTab onCountsChanged={refreshCounts} />}
      {tab === 'log' && <ApplicationLogTab />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-[11px] font-medium border-b-2 -mb-px ${
        active
          ? 'border-emerald-500 t1'
          : 'border-transparent t2 hover:t1'
      }`}
    >
      {children}
    </button>
  )
}
