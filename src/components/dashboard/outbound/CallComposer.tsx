'use client'

import { useState } from 'react'
import { Phone, X, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

interface Template {
  id: string
  name: string
  tone: string
  goal: string
  opening: string | null
  is_default: boolean
}

interface CallComposerProps {
  clientId: string
  templates: Template[]
  onClose: () => void
  onCallPlaced?: () => void
}

type CallStatus = 'idle' | 'creating' | 'dialing' | 'live' | 'failed'

export default function CallComposer({ clientId, templates, onClose, onCallPlaced }: CallComposerProps) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<CallStatus>('idle')
  const [error, setError] = useState('')
  const [callId, setCallId] = useState('')
  const [twilioSid, setTwilioSid] = useState('')

  const defaultTpl = templates.find(t => t.is_default)
  const selectedTpl = templates.find(t => t.id === selectedTemplateId)

  async function dial() {
    if (!phone || !name) return
    setStatus('creating')
    setError('')

    // First get or create a campaign lead
    const supabase = createBrowserClient()
    const { data: lead } = await supabase
      .from('campaign_leads')
      .insert({
        client_id: clientId,
        phone: phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`,
        name,
        notes: notes || null,
        status: 'queued',
      })
      .select('id')
      .single()

    if (!lead) {
      setError('Failed to create lead')
      setStatus('failed')
      return
    }

    setStatus('dialing')
    const res = await fetch('/api/dashboard/leads/dial-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      setError(err.error || 'Call failed')
      setStatus('failed')
      return
    }

    const data = await res.json()
    setCallId(data.callId || '')
    setTwilioSid(data.twilio_sid || '')
    setStatus('live')
    onCallPlaced?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl p-6 space-y-5"
        style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-1)' }}>Call Composer</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-3)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Template selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-3)' }}>
            Personality Template
          </label>
          <select
            value={selectedTemplateId}
            onChange={e => setSelectedTemplateId(e.target.value)}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
          >
            <option value="">{defaultTpl ? `Default: ${defaultTpl.name}` : 'Select a template...'}</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} {t.is_default ? '(Default)' : ''}</option>
            ))}
          </select>
          {selectedTpl && (
            <p className="text-[10px] px-1" style={{ color: 'var(--color-text-3)' }}>
              {selectedTpl.goal} · {selectedTpl.tone} tone
            </p>
          )}
        </div>

        {/* Contact name */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-3)' }}>
            Contact Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Ryan Parry"
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-3)' }}>
            Phone Number
          </label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(403) 796-9038"
            className="w-full border rounded-xl px-3 py-2.5 text-sm font-mono"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-3)' }}>
            Call Notes <span className="font-normal lowercase">(agent reads this)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Context for the agent, e.g. 'Met at open house, interested in 3-bedroom'"
            className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
          />
        </div>

        {/* Status */}
        {error && (
          <div className="flex items-center gap-2 text-xs p-3 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {status === 'live' && (
          <div className="flex items-center gap-2 text-xs p-3 rounded-xl" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
            <CheckCircle className="h-4 w-4 shrink-0" />
            Call connected! Check the Calls tab for live status.
          </div>
        )}

        {/* Dial button */}
        <button
          onClick={dial}
          disabled={status === 'creating' || status === 'dialing' || !phone || !name}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {status === 'creating' || status === 'dialing' ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Dialing...</>
          ) : status === 'live' ? (
            <><CheckCircle className="h-4 w-4" /> Call Live</>
          ) : (
            <><Phone className="h-4 w-4" /> Dial Now</>
          )}
        </button>
      </div>
    </div>
  )
}