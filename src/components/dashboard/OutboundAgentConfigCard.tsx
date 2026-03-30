'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, Phone } from 'lucide-react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'
import { assembleOutboundPrompt, DEFAULT_OUTBOUND_FIELDS, type OutboundTone } from '@/lib/outbound-prompt-builder'

const TONE_OPTIONS: { value: OutboundTone; label: string; desc: string }[] = [
  { value: 'warm', label: 'Warm', desc: 'Friendly and conversational — builds rapport first' },
  { value: 'professional', label: 'Professional', desc: 'Polished and efficient — friendly but concise' },
  { value: 'direct', label: 'Direct', desc: 'Get to the point — short sentences, clear ask' },
]

const PLACEHOLDER_DOCS = [
  { key: '{{LEAD_NAME}}', desc: "Contact's name" },
  { key: '{{LEAD_PHONE}}', desc: "Contact's phone number" },
  { key: '{{LEAD_NOTES}}', desc: 'Notes you added when creating the contact' },
  { key: '{{BUSINESS_NAME}}', desc: 'Your business name' },
  { key: '{{AGENT_NAME}}', desc: "Your agent's name" },
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
  onSaved,
}: OutboundAgentConfigCardProps) {
  // Derive initial values — fall back to defaults if no structured fields saved yet
  const hasStructured = !!(initialGoal || initialOpening || initialVmScript)

  const [goal, setGoal] = useState(initialGoal ?? DEFAULT_OUTBOUND_FIELDS.goal)
  const [tone, setTone] = useState<OutboundTone>(initialTone ?? DEFAULT_OUTBOUND_FIELDS.tone)
  const [opening, setOpening] = useState(initialOpening ?? DEFAULT_OUTBOUND_FIELDS.opening)
  const [vmScript, setVmScript] = useState(initialVmScript ?? DEFAULT_OUTBOUND_FIELDS.vmScript)
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [showPlaceholders, setShowPlaceholders] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showSpecial, setShowSpecial] = useState(false)

  const { saving, saved, error, patch } = usePatchSettings(clientId, isAdmin, {
    onSave: () => {
      const assembled = assembleOutboundPrompt({ goal, tone, opening, vmScript, specialInstructions: specialInstructions || null })
      onSaved?.(assembled)
    },
  })

  function getAssembled(): string {
    return assembleOutboundPrompt({ goal, tone, opening, vmScript, specialInstructions: specialInstructions || null })
  }

  async function save() {
    const assembled = getAssembled()
    await patch({
      outbound_prompt: assembled,
      outbound_goal: goal.trim() || null,
      outbound_opening: opening.trim() || null,
      outbound_vm_script: vmScript.trim() || null,
      outbound_tone: tone,
    })
  }

  const isConfigured = !!(initialOutboundPrompt || hasStructured)

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
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>Outbound Agent</p>
          {isConfigured
            ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Configured</span>
            : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Not configured</span>
          }
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
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
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

        {/* Opening Line */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>
            Opening Line
          </label>
          <textarea
            value={opening}
            onChange={e => setOpening(e.target.value)}
            rows={2}
            placeholder="Hi, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. I'm trying to reach {{LEAD_NAME}} — do you have a quick minute?"
            className="w-full border rounded-xl px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none resize-y transition-colors"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)', minHeight: '60px' }}
          />
          <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
            The exact first sentence the agent speaks. Use placeholders from the list below.
          </p>
        </div>

        {/* Voicemail Script */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>
            Voicemail Script
          </label>
          <textarea
            value={vmScript}
            onChange={e => setVmScript(e.target.value)}
            rows={2}
            placeholder="Hi {{LEAD_NAME}}, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. Just reaching out to connect — give us a call back when you get a chance. Thanks!"
            className="w-full border rounded-xl px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none resize-y transition-colors"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)', minHeight: '60px' }}
          />
          <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
            What the agent leaves on voicemail. Keep it under 20 seconds (~45 words).
          </p>
        </div>

        {/* Special Instructions — collapsible */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <button
            type="button"
            onClick={() => setShowSpecial(p => !p)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--color-text-2)', backgroundColor: 'var(--color-hover)' }}
          >
            <span>Special Instructions (optional)</span>
            {showSpecial ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showSpecial && (
            <div className="p-3">
              <textarea
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                rows={3}
                placeholder="e.g. If they mention pricing, direct them to schedule a call. Never discuss competitors."
                className="w-full border rounded-xl px-3 py-2 text-sm leading-relaxed focus:outline-none resize-y transition-colors"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
              />
            </div>
          )}
        </div>

        {/* Placeholder Reference — collapsible */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <button
            type="button"
            onClick={() => setShowPlaceholders(p => !p)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--color-text-2)', backgroundColor: 'var(--color-hover)' }}
          >
            <span>Available placeholders</span>
            {showPlaceholders ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showPlaceholders && (
            <div className="px-3 pb-3 pt-2 grid grid-cols-1 gap-1.5">
              {PLACEHOLDER_DOCS.map(p => (
                <div key={p.key} className="flex items-start gap-2">
                  <code
                    className="text-[11px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-primary)' }}
                  >
                    {p.key}
                  </code>
                  <span className="text-[11px] pt-0.5" style={{ color: 'var(--color-text-3)' }}>{p.desc}</span>
                </div>
              ))}
            </div>
          )}
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
