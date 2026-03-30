'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, ChevronUp, ExternalLink, X, Plus } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Chunk {
  id: string
  content: string
  source: string
  chunk_type: string
  status: string
  created_at: string
}

// ── Source definitions ────────────────────────────────────────────────────────

interface SourceDef {
  id: string
  label: string
  sources: string[]           // all source values that map here
  primarySource: string       // used for single-source fetch
  addHref: string
  manageHref: string
  canAdd: boolean             // show "Add" CTA inline
  icon: React.ReactNode
}

const SOURCE_DEFS: SourceDef[] = [
  {
    id: 'website',
    label: 'Website',
    sources: ['website_scrape'],
    primarySource: 'website_scrape',
    addHref: '/dashboard/settings?tab=knowledge',
    manageHref: '/dashboard/settings?tab=knowledge',
    canAdd: true,
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'manual',
    label: 'Facts & Q&A',
    sources: ['settings_edit'],
    primarySource: 'settings_edit',
    addHref: '/dashboard/knowledge?tab=add&source=manual',
    manageHref: '/dashboard/knowledge',
    canAdd: true,
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text Imports',
    sources: ['bulk_import', 'dashboard_manual', 'manual', 'manual_text'],
    primarySource: 'dashboard_manual',
    addHref: '/dashboard/knowledge?tab=add&source=text',
    manageHref: '/dashboard/knowledge',
    canAdd: true,
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M9 12h6M9 16h6M9 8h6M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'ai_compiler',
    label: 'AI Compiler',
    sources: ['compiled_import'],
    primarySource: 'compiled_import',
    addHref: '/dashboard/knowledge?tab=add',
    manageHref: '/dashboard/knowledge',
    canAdd: false,
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'docs',
    label: 'Documents',
    sources: ['knowledge_doc'],
    primarySource: 'knowledge_doc',
    addHref: '/dashboard/knowledge',
    manageHref: '/dashboard/knowledge',
    canAdd: false,
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'gbp',
    label: 'Google Profile',
    sources: ['gbp'],
    primarySource: 'gbp',
    addHref: '/dashboard/knowledge',
    manageHref: '/dashboard/knowledge',
    canAdd: false,
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 10-16 0c0 3 2.7 6.9 8 11.7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

// ── Chunk row ─────────────────────────────────────────────────────────────────

function ChunkRow({
  chunk,
  onRemove,
  removing,
}: {
  chunk: Chunk
  onRemove: (id: string) => void
  removing: boolean
}) {
  const preview = chunk.content.length > 120 ? chunk.content.slice(0, 120) + '…' : chunk.content
  return (
    <div
      className={`flex items-start gap-2 group/chunk py-1.5 border-b last:border-0 transition-opacity ${removing ? 'opacity-40' : ''}`}
      style={{ borderColor: 'var(--color-hover)' }}
    >
      <span className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ backgroundColor: 'var(--color-text-3)' }} />
      <p className="flex-1 text-[11px] t2 leading-relaxed">{preview}</p>
      <button
        onClick={() => onRemove(chunk.id)}
        disabled={removing}
        className="opacity-0 group-hover/chunk:opacity-100 transition-opacity shrink-0 t3 hover:text-red-400 p-0.5 rounded"
        title="Remove chunk"
      >
        <X width={11} height={11} />
      </button>
    </div>
  )
}

// ── Expanded panel ────────────────────────────────────────────────────────────

function ChunkPanel({
  def,
  count,
}: {
  def: SourceDef
  count: number
}) {
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [loading, setLoading] = useState(true)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())

  const fetchChunks = useCallback(async () => {
    setLoading(true)
    try {
      // For multi-source types, fetch by primary source — full management is in /knowledge
      const res = await fetch(
        `/api/dashboard/knowledge/chunks?source=${def.primarySource}&status=approved&limit=8`
      )
      if (!res.ok) return
      const json = await res.json()
      setChunks(json.chunks ?? [])
    } finally {
      setLoading(false)
    }
  }, [def.primarySource])

  useEffect(() => {
    fetchChunks()
  }, [fetchChunks])

  async function handleRemove(chunkId: string) {
    setRemovingIds(prev => new Set(prev).add(chunkId))
    try {
      const res = await fetch(`/api/dashboard/knowledge/chunks?id=${chunkId}`, { method: 'DELETE' })
      if (res.ok) {
        setChunks(prev => prev.filter(c => c.id !== chunkId))
      }
    } finally {
      setRemovingIds(prev => {
        const next = new Set(prev)
        next.delete(chunkId)
        return next
      })
    }
  }

  return (
    <div className="px-4 pb-3 pt-1">
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div
            className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : chunks.length === 0 ? (
        <div className="py-3 flex flex-col items-center gap-1.5 text-center">
          <p className="text-[11px] t3">No approved chunks yet</p>
          {def.canAdd && (
            <Link
              href={def.addHref}
              className="text-[11px] font-semibold hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-primary)' }}
            >
              Add content →
            </Link>
          )}
        </div>
      ) : (
        <div>
          <div className="space-y-0">
            {chunks.map(chunk => (
              <ChunkRow
                key={chunk.id}
                chunk={chunk}
                onRemove={handleRemove}
                removing={removingIds.has(chunk.id)}
              />
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 mt-1">
            {count > 8 && (
              <p className="text-[10px] t3">Showing 8 of {count}</p>
            )}
            <div className="flex items-center gap-3 ml-auto">
              {def.canAdd && (
                <Link
                  href={def.addHref}
                  className="flex items-center gap-1 text-[11px] font-semibold hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <Plus width={10} height={10} />
                  Add
                </Link>
              )}
              <Link
                href={def.manageHref}
                className="flex items-center gap-1 text-[11px] t3 hover:t2 transition-colors"
              >
                Manage
                <ExternalLink width={9} height={9} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main tile ─────────────────────────────────────────────────────────────────

interface Props {
  knowledgeStats: {
    approved_chunk_count: number
    source_types: string[]
  }
}

export default function KnowledgeInlineTile({ knowledgeStats }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const activeSourceTypes = new Set(knowledgeStats.source_types)

  const entries = SOURCE_DEFS.map(def => {
    const isActive = def.sources.some(s => activeSourceTypes.has(s))
    return { ...def, count: isActive ? 1 : 0 }
  })

  const totalApproved = knowledgeStats.approved_chunk_count

  function toggle(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <motion.div
      className="rounded-2xl border b-theme bg-surface overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b b-theme">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[12px] font-semibold t1">Knowledge Base</span>
          {totalApproved > 0 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--color-primary-10)', color: 'var(--color-primary)' }}
            >
              {totalApproved}
            </span>
          )}
        </div>
        <Link
          href="/dashboard/knowledge"
          className="flex items-center gap-1 text-[11px] t3 hover:t2 transition-colors"
        >
          View all
          <ExternalLink width={10} height={10} />
        </Link>
      </div>

      {/* Source list */}
      <div className="divide-y" style={{ borderColor: 'var(--color-hover)' }}>
        {entries.map(entry => {
          const isActive = entry.count > 0
          const isOpen = expandedId === entry.id

          return (
            <div key={entry.id}>
              {/* Source row — click to expand */}
              <button
                onClick={() => toggle(entry.id)}
                className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-[var(--color-hover)] transition-colors text-left"
              >
                <span className={`shrink-0 ${isActive ? 'text-green-400' : 't3'}`}>
                  {entry.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${isActive ? 't1' : 't2'}`}>
                    {entry.label}
                  </p>
                </div>
                {isActive ? (
                  <span className="text-[10px] font-mono text-green-400/80 shrink-0">
                    {entry.count}
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400/60 shrink-0">empty</span>
                )}
                <span className="t3 shrink-0 ml-1">
                  {isOpen
                    ? <ChevronUp width={12} height={12} />
                    : <ChevronDown width={12} height={12} />
                  }
                </span>
              </button>

              {/* Inline expanded chunk panel */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div
                      className="mx-4 mb-3 rounded-xl border overflow-hidden"
                      style={{ borderColor: 'var(--color-hover)', backgroundColor: 'var(--color-surface)' }}
                    >
                      <ChunkPanel def={entry} count={entry.count} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {totalApproved === 0 && (
        <div className="px-5 py-6 text-center">
          <p className="text-[12px] t3">No knowledge added yet</p>
          <Link
            href="/dashboard/knowledge?tab=add"
            className="mt-1.5 inline-block text-[11px] font-semibold hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-primary)' }}
          >
            Add your first source →
          </Link>
        </div>
      )}
    </motion.div>
  )
}
