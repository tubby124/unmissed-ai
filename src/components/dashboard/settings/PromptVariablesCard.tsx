'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import type { PromptVariable } from '@/lib/prompt-variable-registry'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ResolvedVar {
  value: string
  meta: PromptVariable
}

type ResolvedVars = Record<string, ResolvedVar>

// ── Which variables to show, in order ──────────────────────────────────────────

interface VarGroup {
  id: string
  label: string
  desc: string
  keys: string[]
  icon: React.ReactNode
}

const EDITABLE_GROUPS: VarGroup[] = [
  {
    id: 'identity',
    label: 'Identity',
    desc: 'Who your agent is',
    keys: ['AGENT_NAME', 'BUSINESS_NAME', 'CLOSE_PERSON', 'CITY'],
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    id: 'greeting',
    label: 'Opening & closing',
    desc: 'First and last thing callers hear',
    keys: ['GREETING_LINE', 'CLOSING_LINE'],
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    id: 'services',
    label: 'Services & knowledge',
    desc: 'What your business offers',
    keys: ['SERVICES_OFFERED', 'SERVICES_NOT_OFFERED', 'FAQ_PAIRS'],
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    id: 'routing',
    label: 'Call routing',
    desc: 'How callers get triaged',
    keys: ['TRIAGE_DEEP', 'URGENCY_KEYWORDS'],
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M16 3h5v5M4 20L20.5 3.5M21 16v5h-5M15 15l6 6M4 4l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    id: 'safety',
    label: 'Guardrails',
    desc: 'What your agent must never do',
    keys: ['FORBIDDEN_EXTRA'],
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
]

// Variables that are edited via a dedicated settings card — show read-only + link
const DEDICATED_CARD_KEYS = new Set([
  'TONE_STYLE_BLOCK', 'FILLER_STYLE', 'HOURS_WEEKDAY',
  'TRANSFER_ENABLED', 'AFTER_HOURS_BLOCK', 'PRICING_POLICY',
  'UNKNOWN_ANSWER_BEHAVIOR', 'PRIMARY_GOAL',
])

// ── Variable row (inline editable) ─────────────────────────────────────────────

function VariableRow({
  varKey,
  resolved,
  onSave,
}: {
  varKey: string
  resolved: ResolvedVar | undefined
  onSave: (key: string, value: string) => Promise<boolean>
}) {
  const meta = resolved?.meta
  const currentValue = resolved?.value ?? ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(currentValue)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Reset draft when currentValue changes from outside
  useEffect(() => {
    if (!editing) setDraft(currentValue)
  }, [currentValue, editing])

  const isMultiline = currentValue.length > 80 || currentValue.includes('\n')
  const isDirty = draft !== currentValue

  async function handleSave() {
    if (!isDirty) { setEditing(false); return }
    setSaving(true)
    const ok = await onSave(varKey, draft)
    setSaving(false)
    if (ok) {
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  if (!meta) return null

  // Read-only display for dedicated card variables
  if (DEDICATED_CARD_KEYS.has(varKey)) {
    return (
      <div className="flex items-start gap-2 py-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium t2">{meta.label}</p>
          <p className="text-[10px] t3 mt-0.5 truncate">{currentValue || '(not set)'}</p>
        </div>
        {meta.editPath && (
          <span className="text-[9px] t3 shrink-0 mt-0.5">via Settings</span>
        )}
      </div>
    )
  }

  return (
    <div className="py-2.5 group/var">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold t1">{meta.label}</p>
            {saved && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-[9px] text-green-400 font-medium"
              >
                Saved
              </motion.span>
            )}
          </div>
          {!editing && meta.description && (
            <p className="text-[10px] t3 mt-0.5">{meta.description}</p>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => { setDraft(currentValue); setEditing(true) }}
            className="text-[10px] font-medium shrink-0 opacity-0 group-hover/var:opacity-100 transition-opacity px-2 py-0.5 rounded-md"
            style={{ color: 'var(--color-primary)' }}
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2">
          {isMultiline ? (
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={Math.min(8, Math.max(3, draft.split('\n').length + 1))}
              className="w-full text-[11px] t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50 resize-y font-mono leading-relaxed"
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="w-full text-[11px] t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            />
          )}
          <div className="flex items-center justify-end gap-2 mt-1.5">
            <button
              onClick={() => { setDraft(currentValue); setEditing(false) }}
              className="text-[10px] t3 hover:t2 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="text-[10px] font-semibold px-3 py-1 rounded-md transition-all disabled:opacity-40 bg-blue-500 hover:bg-blue-400 text-white"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1">
          {currentValue ? (
            isMultiline ? (
              <pre className="text-[11px] t2 leading-relaxed whitespace-pre-wrap font-mono bg-hover rounded-lg px-3 py-2 max-h-32 overflow-y-auto">
                {currentValue}
              </pre>
            ) : (
              <p className="text-[11px] t2 bg-hover rounded-lg px-3 py-2 truncate">
                {currentValue}
              </p>
            )
          ) : (
            <p className="text-[11px] t3 italic bg-hover rounded-lg px-3 py-2">
              Not set — click Edit to add
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main card ──────────────────────────────────────────────────────────────────

interface PromptVariablesCardProps {
  client: ClientConfig
  isAdmin: boolean
  onPromptChange?: (prompt: string) => void
}

export default function PromptVariablesCard({
  client,
  isAdmin,
  onPromptChange,
}: PromptVariablesCardProps) {
  const [vars, setVars] = useState<ResolvedVars | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<string | null>('identity')

  const fetchVars = useCallback(async () => {
    try {
      const url = isAdmin ? `/api/dashboard/variables?client_id=${client.id}` : '/api/dashboard/variables'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load variables')
      const data = await res.json()
      setVars(data.variables)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load error')
    } finally {
      setLoading(false)
    }
  }, [client.id, isAdmin])

  useEffect(() => { fetchVars() }, [fetchVars])

  async function handleSave(key: string, value: string): Promise<boolean> {
    try {
      const body: Record<string, unknown> = { variableKey: key, value, includeDiff: true }
      if (isAdmin) body.client_id = client.id

      const res = await fetch('/api/dashboard/variables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) return false
      const data = await res.json()

      // Update local state
      if (vars) {
        setVars(prev => prev ? {
          ...prev,
          [key]: { ...prev[key], value },
        } : prev)
      }

      // Notify parent if prompt changed
      if (data.promptChanged && data.newPrompt && onPromptChange) {
        onPromptChange(data.newPrompt)
      }

      return true
    } catch {
      return false
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
          <span className="text-[11px] t3">Loading agent variables...</span>
        </div>
      </div>
    )
  }

  if (error || !vars) {
    return (
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <p className="text-[11px] text-red-400">{error || 'Failed to load variables'}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b b-theme">
        <div className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-indigo-400 shrink-0">
            <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <div>
            <p className="text-[12px] font-semibold t1">Agent Variables</p>
            <p className="text-[10px] t3">Edit the building blocks that shape your agent&apos;s personality and behavior</p>
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="divide-y" style={{ borderColor: 'var(--color-hover)' }}>
        {EDITABLE_GROUPS.map(group => {
          const isOpen = expandedGroup === group.id
          const groupVars = group.keys.filter(k => vars[k])
          const filledCount = groupVars.filter(k => vars[k]?.value?.trim()).length

          return (
            <div key={group.id}>
              <button
                onClick={() => setExpandedGroup(isOpen ? null : group.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-hover)] transition-colors text-left"
              >
                <span className="t3 shrink-0">{group.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium t1">{group.label}</p>
                  <p className="text-[10px] t3">{group.desc}</p>
                </div>
                <span className="text-[10px] font-mono t3 shrink-0">
                  {filledCount}/{groupVars.length}
                </span>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  className={`t3 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="px-5 pb-3 divide-y" style={{ borderColor: 'var(--color-hover)' }}>
                      {groupVars.map(key => (
                        <VariableRow
                          key={key}
                          varKey={key}
                          resolved={vars[key]}
                          onSave={handleSave}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
