'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { trackEvent } from '@/lib/analytics'
import { RotateCcw, Check, X, ArrowRight } from 'lucide-react'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'

type Action = 'hours' | 'faq' | 'forwarding'

interface PostCallImprovementPanelProps {
  hasHours: boolean
  hasFaqs: boolean
  hasForwardingNumber: boolean
  onDismiss: () => void
  onRetest: () => void
  clientId?: string | null
  daysRemaining?: number
}

async function patchSettings(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    return res.ok
  } catch {
    return false
  }
}

export default function PostCallImprovementPanel({
  hasHours,
  hasFaqs,
  hasForwardingNumber,
  onDismiss,
  onRetest,
  clientId,
  daysRemaining,
}: PostCallImprovementPanelProps) {
  const { openUpgradeModal } = useUpgradeModal()
  const [activeAction, setActiveAction] = useState<Action | null>(null)
  const [savedAction, setSavedAction] = useState<Action | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Hours form
  const [weekday, setWeekday] = useState('')
  const [weekend, setWeekend] = useState('')

  // FAQ form
  const [faqQ, setFaqQ] = useState('')
  const [faqA, setFaqA] = useState('')

  // Forwarding form
  const [forwarding, setForwarding] = useState('')

  useEffect(() => {
    trackEvent('post_call_improvement_shown')
  }, [])

  const availableActions: { action: Action; label: string; desc: string }[] = []
  if (!hasHours) availableActions.push({
    action: 'hours',
    label: 'Set your business hours',
    desc: "Tell your agent when you're open",
  })
  if (!hasFaqs) availableActions.push({
    action: 'faq',
    label: 'Add your first FAQ',
    desc: 'A question your agent will answer automatically',
  })
  if (!hasForwardingNumber) availableActions.push({
    action: 'forwarding',
    label: 'Add a forwarding number',
    desc: 'Route callers to you or your team',
  })

  function selectAction(action: Action) {
    setActiveAction(action)
    setSaveError(null)
    trackEvent('post_call_improvement_selected', { action_type: action })
  }

  function cancelAction() {
    setActiveAction(null)
    setSaveError(null)
  }

  async function saveHours() {
    if (!weekday.trim()) return
    setSaving(true)
    setSaveError(null)
    const ok = await patchSettings({
      business_hours_weekday: weekday.trim(),
      business_hours_weekend: weekend.trim() || null,
    })
    setSaving(false)
    if (ok) {
      setSavedAction('hours')
      setActiveAction(null)
      trackEvent('hours_updated_from_post_call')
    } else {
      setSaveError('Could not save. Try again.')
    }
  }

  async function saveFaq() {
    if (!faqQ.trim() || !faqA.trim()) return
    setSaving(true)
    setSaveError(null)
    const ok = await patchSettings({ extra_qa: [{ q: faqQ.trim(), a: faqA.trim() }] })
    setSaving(false)
    if (ok) {
      setSavedAction('faq')
      setActiveAction(null)
      trackEvent('faq_updated_from_post_call')
    } else {
      setSaveError('Could not save. Try again.')
    }
  }

  async function saveForwarding() {
    if (!forwarding.trim()) return
    setSaving(true)
    setSaveError(null)
    const ok = await patchSettings({ forwarding_number: forwarding.trim() })
    setSaving(false)
    if (ok) {
      setSavedAction('forwarding')
      setActiveAction(null)
      trackEvent('forwarding_updated_from_post_call')
    } else {
      setSaveError('Could not save. Try again.')
    }
  }

  const hasSaved = savedAction !== null
  const allConfigured = availableActions.length === 0

  const savedLabel =
    savedAction === 'hours' ? 'Business hours updated' :
    savedAction === 'faq' ? 'FAQ added to your agent' :
    savedAction === 'forwarding' ? 'Forwarding number set' : ''

  const inputClass = 'w-full px-3 py-2 rounded-xl text-sm t1 placeholder:t3 outline-none focus:ring-2 focus:ring-[var(--color-primary)]'
  const inputStyle = { background: 'var(--color-hover)', border: '1px solid var(--color-border)' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 card-surface relative"
    >
      {/* Dismiss */}
      <button
        onClick={() => { trackEvent('post_call_improvement_dismissed'); onDismiss() }}
        className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5 t3" />
      </button>

      {/* Heading */}
      <h3 className="font-semibold text-sm t1 mb-0.5 pr-8">
        {allConfigured ? 'Your agent is well configured' : 'How did that feel?'}
      </h3>
      <p className="text-xs t3 mb-4">
        {hasSaved
          ? 'Nice. Run another test to hear the difference.'
          : allConfigured
          ? 'Run another test to confirm everything sounds right.'
          : 'Make one quick improvement before your next test.'}
      </p>

      {/* Save confirmation */}
      {hasSaved && (
        <div className="flex items-center gap-2 text-xs mb-4" style={{ color: 'var(--color-success)' }}>
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>{savedLabel}</span>
        </div>
      )}

      {/* Action list — shown when no action is selected and nothing saved yet */}
      {!hasSaved && activeAction === null && availableActions.length > 0 && (
        <div className="space-y-2 mb-4">
          {availableActions.map(({ action, label, desc }) => (
            <button
              key={action}
              onClick={() => selectAction(action)}
              className="w-full text-left px-3.5 py-3 rounded-xl transition-colors hover:bg-hover cursor-pointer"
              style={{ border: '1px solid var(--color-border)' }}
            >
              <span className="text-[13px] font-medium t1 block">{label}</span>
              <span className="text-[11px] t3">{desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Hours form */}
      {activeAction === 'hours' && (
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-[11px] font-medium t3 mb-1 block">Weekday hours</label>
            <input
              type="text"
              value={weekday}
              onChange={e => setWeekday(e.target.value)}
              placeholder="e.g. Mon–Fri 9am–5pm"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium t3 mb-1 block">
              Weekend hours <span className="font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={weekend}
              onChange={e => setWeekend(e.target.value)}
              placeholder="e.g. Sat 10am–2pm, Sun closed"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          {saveError && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{saveError}</p>}
          <div className="flex gap-2">
            <button onClick={cancelAction} className="text-xs t3 px-3 py-2 rounded-xl hover:bg-hover transition-colors cursor-pointer">
              Cancel
            </button>
            <button
              onClick={saveHours}
              disabled={!weekday.trim() || saving}
              className="flex-1 py-2 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {saving ? 'Saving…' : 'Save Hours'}
            </button>
          </div>
        </div>
      )}

      {/* FAQ form */}
      {activeAction === 'faq' && (
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-[11px] font-medium t3 mb-1 block">Question callers ask</label>
            <input
              type="text"
              value={faqQ}
              onChange={e => setFaqQ(e.target.value)}
              placeholder="e.g. What are your prices?"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium t3 mb-1 block">Your agent&apos;s answer</label>
            <textarea
              value={faqA}
              onChange={e => setFaqA(e.target.value)}
              placeholder="e.g. Our services start at $99. Call us for a custom quote."
              rows={2}
              className={`${inputClass} resize-none`}
              style={inputStyle}
            />
          </div>
          {saveError && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{saveError}</p>}
          <div className="flex gap-2">
            <button onClick={cancelAction} className="text-xs t3 px-3 py-2 rounded-xl hover:bg-hover transition-colors cursor-pointer">
              Cancel
            </button>
            <button
              onClick={saveFaq}
              disabled={!faqQ.trim() || !faqA.trim() || saving}
              className="flex-1 py-2 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {saving ? 'Saving…' : 'Save FAQ'}
            </button>
          </div>
        </div>
      )}

      {/* Forwarding form */}
      {activeAction === 'forwarding' && (
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-[11px] font-medium t3 mb-1 block">Forwarding number</label>
            <input
              type="tel"
              value={forwarding}
              onChange={e => setForwarding(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className={inputClass}
              style={inputStyle}
            />
            <p className="text-[11px] t3 mt-1">Your agent will offer to transfer callers to this number</p>
          </div>
          {saveError && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{saveError}</p>}
          <div className="flex gap-2">
            <button onClick={cancelAction} className="text-xs t3 px-3 py-2 rounded-xl hover:bg-hover transition-colors cursor-pointer">
              Cancel
            </button>
            <button
              onClick={saveForwarding}
              disabled={!forwarding.trim() || saving}
              className="flex-1 py-2 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {saving ? 'Saving…' : 'Save Number'}
            </button>
          </div>
        </div>
      )}

      {/* Go Live CTA — shown when all configured */}
      {allConfigured && (
        <button
          onClick={() => openUpgradeModal('post_call_all_configured', clientId, daysRemaining)}
          className="w-full py-2.5 rounded-xl font-medium text-sm cursor-pointer inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90 text-white mb-2"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          Get Your Phone Number
          <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {/* Retest CTA */}
      <button
        onClick={() => { trackEvent('retest_started_after_improvement'); onRetest() }}
        className="w-full py-2.5 rounded-xl font-medium text-sm cursor-pointer inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
        style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-2)' }}
      >
        <RotateCcw className="w-4 h-4" />
        Run another test
      </button>
    </motion.div>
  )
}
