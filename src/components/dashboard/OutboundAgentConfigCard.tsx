'use client'

import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Eye, Phone } from 'lucide-react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'
import { assembleOutboundPrompt, DEFAULT_OUTBOUND_FIELDS, type OutboundTone } from '@/lib/outbound-prompt-builder'

const TONE_OPTIONS: { value: OutboundTone; label: string; desc: string }[] = [
  { value: 'warm', label: 'Warm', desc: 'Friendly, builds rapport' },
  { value: 'professional', label: 'Professional', desc: 'Polished but concise' },
  { value: 'direct', label: 'Direct', desc: 'Short, clear ask' },
]

// Placeholders available to insert into opening line and voicemail script
const VARIABLES = [
  { key: '{{AGENT_NAME}}', label: 'Agent name' },
  { key: '{{LEAD_NAME}}', label: 'Lead name' },
  { key: '{{BUSINESS_NAME}}', label: 'Business name' },
  { key: '{{LEAD_NOTES}}', label: 'Lead notes' },
  { key: '{{LEAD_PHONE}}', label: 'Lead phone' },
]

interface OutboundAgentConfigCardProps {
  clientId: string
  isAdmin?: boolean
  hasPhoneNumber: boolean
  initialOutboundPrompt: string | null
  initialGoal: string | null
  initialOpening: string | null
  initialVmScript: string | null
  initialTone: OutboundTone
  initialNotes: string | null
  onSaved?: (prompt: string | null) => void
}

export default function OutboundAgentConfigCard({
  clientId,
  isAdmin = false,
  hasPhoneNumber,
  initialOutboundPrompt,
  initialGoal,
  initialOpening,
  initialVmScript,
  initialTone,
  initialNotes,
  onSaved,
}: OutboundAgentConfigCardProps) {
  const hasStructured = !!(initialGoal || initialOpening || initialVmScript)

  const [currentPrompt, setCurrentPrompt] = useState(initialOutboundPrompt)
  const [goal, setGoal] = useState(initialGoal ?? DEFAULT_OUTBOUND_FIELDS.goal)
  const [tone, setTone] = useState<OutboundTone>(initialTone ?? DEFAULT_OUTBOUND_FIELDS.tone)
  const [opening, setOpening] = useState(initialOpening ?? DEFAULT_OUTBOUND_FIELDS.opening)
  const [vmScript, setVmScript] = useState(initialVmScript ?? DEFAULT_OUTBOUND_FIELDS.vmScript)
  const [callNotes, setCallNotes] = useState(initialNotes ?? '')
  const [showPreview, setShowPreview] = useState(false)

  // Refs for cursor-position insertion
  const openingRef = useRef<HTMLTextAreaElement>(null)
  const vmRef = useRef<HTMLTextAreaElement>(null)

  const { saving, saved, error, patch } = usePatchSettings(clientId, isAdmin, {
    onSave: () => {
      const assembled = assembleOutboundPrompt({ goal, tone, opening, vmScript, callNotes: callNotes || null })
      setCurrentPrompt(assembled)
      onSaved?.(assembled)
    },
  })

  function getAssembled(): string {
    return assembleOutboundPrompt({ goal, tone, opening, vmScript, callNotes: callNotes || null })
  }

  async function save() {
    const assembled = getAssembled()
    await patch({
      outbound_prompt: assembled,
      outbound_goal: goal.trim() || null,
      outbound_opening: opening.trim() || null,
      outbound_vm_script: vmScript.trim() || null,
      outbound_tone: tone,
      outbound_notes: callNotes.trim() || null,
    })
  }

  /** Insert a variable placeholder at the current cursor position in a textarea */
  function insertVariable(
    ref: React.RefObject<HTMLTextAreaElement | null>,
    value: string,
    setter: (v: string) => void
  ) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = el.value.slice(0, start) + value + el.value.slice(end)
    setter(next)
    // Restore focus + set cursor after inserted text
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + value.length, start + value.length)
    })
  }

  const isConfigured = !!(currentPrompt || hasStructured)

  if (!hasPhoneNumber) {
    return (
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="mt-0.5 p-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(234,179,8,0.1)' }}>
          <Phone className="h-4 w-4 text-yellow-400" />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>Outbound Agent</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-3)' }}>
            Upgrade to a paid plan to get a calling number and enable outbound calls.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>Agent Configuration</p>
          <div className="flex gap-1.5 ml-1">
            <button
              className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)', backgroundColor: 'var(--color-hover)' }}
            >
              Inbound
            </button>
            <button
              className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
              style={{ borderColor: 'rgba(59,130,246,0.4)', color: '#93c5fd', backgroundColor: 'rgba(59,130,246,0.1)' }}
            >
              Outbound
            </button>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className={`px-3 py-1 text-[11px] font-medium rounded-lg transition-colors ${
            saved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'border hover:opacity-80'
          }`}
          style={!saved ? { borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-hover)' } : undefined}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save outbound settings'}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Tone */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>
            Tone
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TONE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTone(opt.value)}
                className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                  tone === opt.value
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                    : 'hover:border-blue-500/20 hover:bg-blue-500/5'
                }`}
                style={tone !== opt.value ? { borderColor: 'var(--color-border)', color: 'var(--color-text-2)' } : undefined}
              >
                <span className="font-semibold block">{opt.label}</span>
                <span className="text-[10px] leading-snug mt-0.5 block opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Call Goal */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>
            Call Goal
          </label>
          <input
            type="text"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="e.g. Schedule a free consultation"
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
          />
          <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
            What should the agent try to accomplish on this call?
          </p>
        </div>

        {/* Call Notes */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>
              Call Notes
            </label>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(168,85,247,0.1)', color: '#c084fc' }}>
              agent reads this
            </span>
          </div>
          <textarea
            value={callNotes}
            onChange={e => setCallNotes(e.target.value)}
            rows={3}
            placeholder={`Write notes here to guide the agent — it will read these before each call.\n\ne.g. "These leads responded to our spring offer. Focus on the limited-time discount and push for a Thursday callback."`}
            className="w-full border rounded-xl px-3 py-2 text-sm leading-relaxed focus:outline-none resize-y transition-colors"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)', minHeight: '80px' }}
          />
          <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
            Context, background, or strategy for this batch of calls. Use <code className="px-1 rounded" style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-primary)' }}>{'{{LEAD_NOTES}}'}</code> in your opening line to also reference per-contact notes.
          </p>
        </div>

        {/* Opening Line with variable inserter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>
              Opening Line
            </label>
          </div>
          <textarea
            ref={openingRef}
            value={opening}
            onChange={e => setOpening(e.target.value)}
            rows={2}
            placeholder="Hi, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. I'm trying to reach {{LEAD_NAME}} — do you have a quick minute?"
            className="w-full border rounded-xl px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none resize-y transition-colors"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)', minHeight: '60px' }}
          />
          {/* Variable chips */}
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(openingRef, v.key, setOpening)}
                title={`Insert ${v.key}`}
                className="text-[10px] font-mono px-2 py-0.5 rounded border transition-colors hover:opacity-80 active:scale-95"
                style={{ backgroundColor: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.25)', color: '#93c5fd' }}
              >
                + {v.key}
              </button>
            ))}
          </div>
          <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
            The exact first sentence the agent speaks. Click a variable to insert it at your cursor.
          </p>
        </div>

        {/* Voicemail Script with variable inserter */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>
            Voicemail Script
          </label>
          <textarea
            ref={vmRef}
            value={vmScript}
            onChange={e => setVmScript(e.target.value)}
            rows={2}
            placeholder="Hi {{LEAD_NAME}}, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. Just reaching out to connect — give us a call back when you get a chance. Thanks!"
            className="w-full border rounded-xl px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none resize-y transition-colors"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)', minHeight: '60px' }}
          />
          {/* Variable chips */}
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(vmRef, v.key, setVmScript)}
                title={`Insert ${v.key}`}
                className="text-[10px] font-mono px-2 py-0.5 rounded border transition-colors hover:opacity-80 active:scale-95"
                style={{ backgroundColor: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.25)', color: '#93c5fd' }}
              >
                + {v.key}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
              What the agent leaves on voicemail. Keep it under 20 seconds (~45 words).
            </p>
            <p className={`text-[10px] shrink-0 ml-2 ${vmScript.length >= 500 ? 'text-red-500' : vmScript.length >= 450 ? 'text-amber-500' : 'text-muted-foreground'}`}>
              {vmScript.length}/500 characters
            </p>
          </div>
        </div>

        {/* Full Prompt Preview — collapsible */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <button
            type="button"
            onClick={() => setShowPreview(p => !p)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--color-text-2)', backgroundColor: 'var(--color-hover)' }}
          >
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Preview assembled prompt
            </span>
            {showPreview ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showPreview && (
            <div className="p-3">
              <pre
                className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed rounded-lg p-3 overflow-x-auto"
                style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-text-2)' }}
              >
                {getAssembled()}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
