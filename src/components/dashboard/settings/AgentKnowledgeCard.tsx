'use client'

import { useState } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { usePatchSettings } from './usePatchSettings'

interface AgentKnowledgeCardProps {
  client: ClientConfig
  clientId?: string
  isAdmin?: boolean
}

export default function AgentKnowledgeCard({ client, clientId, isAdmin = false }: AgentKnowledgeCardProps) {
  const id = clientId ?? client.id
  const [qa, setQa] = useState<{ q: string; a: string }[]>(client.extra_qa ?? [])
  const [adding, setAdding] = useState(false)
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const { saving, patch } = usePatchSettings(id, isAdmin)

  const factCount = client.business_facts?.split('\n').filter(l => l.trim()).length ?? 0
  const faqCount = qa.filter(p => p.q?.trim() && p.a?.trim()).length
  const hoursSet = !!client.business_hours_weekday
  const bookingConnected = !!(client.booking_enabled && client.calendar_auth_status === 'connected')
  const voiceStyle = client.voice_style_preset ?? 'default'
  const knowledgeActive = client.knowledge_backend === 'pgvector'

  async function saveNewQa() {
    const trimQ = newQ.trim()
    const trimA = newA.trim()
    if (!trimQ || !trimA) return
    const updated = [...qa, { q: trimQ, a: trimA }]
    await patch({ extra_qa: updated })
    setQa(updated)
    setNewQ('')
    setNewA('')
    setAdding(false)
  }

  function cancelAdd() {
    setNewQ('')
    setNewA('')
    setAdding(false)
  }

  const stats = [
    {
      label: 'Business Facts',
      value: factCount > 0 ? `${factCount}` : '0',
      active: factCount > 0,
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Q&A Pairs',
      value: `${faqCount}`,
      active: faqCount > 0,
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M9 9a3 3 0 015.12 2.13c0 1.5-2.12 2-2.12 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="0.5"/>
        </svg>
      ),
    },
    {
      label: 'Hours',
      value: hoursSet ? 'Set' : 'Not set',
      active: hoursSet,
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Booking',
      value: bookingConnected ? 'Connected' : 'Off',
      active: bookingConnected,
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Voice Style',
      value: formatPreset(voiceStyle),
      active: voiceStyle !== 'default',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Knowledge Docs',
      value: knowledgeActive ? 'Active' : 'Off',
      active: knowledgeActive,
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="flex items-center gap-2 mb-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3">
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">What Your Agent Knows</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map(stat => (
          <div
            key={stat.label}
            className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border transition-colors ${
              stat.active
                ? 'border-green-500/20 bg-green-500/[0.04]'
                : 'b-theme bg-hover'
            }`}
          >
            <span className={stat.active ? 'text-green-400' : 't3'}>{stat.icon}</span>
            <span className={`text-sm font-semibold ${stat.active ? 't1' : 't3'}`}>{stat.value}</span>
            <span className="text-[9px] t3 text-center leading-tight">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/[0.04] border border-blue-500/15 mt-3">
        <span className="w-2 h-2 rounded-full bg-blue-400/80 shrink-0" />
        <p className="text-[10px] t2 leading-relaxed">
          <span className="font-semibold text-blue-400/90">Always knows</span>
          {' '}&mdash; business facts and Q&A are available on every call.
        </p>
      </div>

      {/* Quick add Q&A */}
      {adding ? (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={newQ}
            onChange={e => setNewQ(e.target.value)}
            placeholder="Question your agent should know..."
            autoFocus
            className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
          />
          <textarea
            value={newA}
            onChange={e => setNewA(e.target.value)}
            placeholder="Answer..."
            rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNewQa() }}
            className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={saveNewQa}
              disabled={saving || !newQ.trim() || !newA.trim()}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white transition-all disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Add Q&A'}
            </button>
            <button
              onClick={cancelAdd}
              className="px-3 py-1.5 rounded-xl text-xs t3 hover:t2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border b-theme bg-hover hover:bg-surface text-xs t3 hover:t2 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Quick add Q&A
        </button>
      )}
    </div>
  )
}

function formatPreset(preset: string): string {
  return preset
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
