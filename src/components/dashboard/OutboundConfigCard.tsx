'use client'

import { useState } from 'react'
import { Settings2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const STARTER_TEMPLATE = `You are {{AGENT_NAME}}, calling on behalf of {{BUSINESS_NAME}}.

You're reaching out to {{LEAD_NAME}} to follow up{{LEAD_NOTES ? " regarding: " + LEAD_NOTES : ""}}.

Your goal is to have a helpful, friendly conversation. Be concise — this is a cold call.

OUTBOUND CALL GUIDELINES:
1. Open with your name and business immediately: "Hi, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}."
2. Keep the intro under 20 seconds before asking if they have a moment.
3. If it's a bad time, offer to call back later and say goodbye warmly.
4. If no one answers, leave a brief voicemail with your name, business, and one reason to call back.
5. Never pressure or repeat the same point more than once.
6. End the call with hangUp once the conversation is complete.`

const PLACEHOLDER_DOCS = [
  { key: '{{LEAD_NAME}}', desc: "Contact's name (or 'there' if unknown)" },
  { key: '{{LEAD_PHONE}}', desc: "Contact's phone number" },
  { key: '{{LEAD_NOTES}}', desc: 'Notes you added when creating the contact' },
  { key: '{{BUSINESS_NAME}}', desc: 'Your business name' },
  { key: '{{AGENT_NAME}}', desc: "Your agent's name" },
]

interface OutboundConfigCardProps {
  outboundPrompt: string | null
  hasPhoneNumber: boolean
  onSaved: (newPrompt: string | null) => void
}

export default function OutboundConfigCard({
  outboundPrompt,
  hasPhoneNumber,
  onSaved,
}: OutboundConfigCardProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(outboundPrompt ?? STARTER_TEMPLATE)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showPlaceholders, setShowPlaceholders] = useState(false)

  const isConfigured = !!outboundPrompt

  function openEditor() {
    setDraft(outboundPrompt ?? STARTER_TEMPLATE)
    setSaveError('')
    setOpen(true)
  }

  async function save() {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outbound_prompt: draft.trim() || null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSaveError(body?.error ?? 'Save failed')
        return
      }
      onSaved(draft.trim() || null)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const preview = outboundPrompt
    ? outboundPrompt.slice(0, 120) + (outboundPrompt.length > 120 ? '…' : '')
    : null

  return (
    <>
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div
          className="mt-0.5 p-1.5 rounded-lg flex-shrink-0"
          style={{ backgroundColor: isConfigured ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)' }}
        >
          {isConfigured
            ? <CheckCircle2 className="h-4 w-4 text-green-400" />
            : <AlertCircle className="h-4 w-4 text-yellow-400" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>
              Outbound Agent Prompt
            </p>
            {isConfigured
              ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Configured</span>
              : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Not configured</span>
            }
          </div>

          {preview
            ? (
              <p
                className="text-xs mt-1 leading-relaxed line-clamp-2"
                style={{ color: 'var(--color-text-3)' }}
              >
                {preview}
              </p>
            )
            : (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-3)' }}>
                {hasPhoneNumber
                  ? 'Configure what your agent says when dialing contacts.'
                  : 'Upgrade to a paid plan to get a calling number and enable outbound calls.'
                }
              </p>
            )
          }
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={openEditor}
          className="flex-shrink-0 gap-1.5"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {isConfigured ? 'Edit Prompt' : 'Configure'}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={o => { if (!o && !saving) setOpen(false) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Outbound Agent Prompt</DialogTitle>
            <DialogDescription>
              What your agent says when calling contacts in your queue. This prompt is different from your inbound receptionist — it&apos;s crafted for outbound introductions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-1">
            {/* Placeholder reference */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--color-border)' }}
            >
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

            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={16}
              className="w-full border rounded-xl px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none resize-y transition-colors"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-1)',
                minHeight: '240px',
              }}
              placeholder="Describe what your agent should say when calling contacts…"
              spellCheck={false}
            />

            <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--color-text-3)' }}>
              <span>{draft.length.toLocaleString()} chars</span>
              <button
                type="button"
                onClick={() => setDraft(STARTER_TEMPLATE)}
                className="hover:opacity-70 transition-opacity"
                style={{ color: 'var(--color-primary)' }}
              >
                Reset to starter template
              </button>
            </div>

            {saveError && <p className="text-xs text-red-400">{saveError}</p>}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Prompt'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
