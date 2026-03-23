'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { PremiumToggle } from '@/components/ui/bouncy-toggle'

interface SmsTabProps {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
  smsEnabled: boolean
  setSmsEnabled: (val: boolean) => void
  smsTemplate: string
  setSmsTemplate: (val: string) => void
}

export default function SmsTab({
  client,
  isAdmin,
  previewMode,
  smsEnabled,
  setSmsEnabled,
  smsTemplate,
  setSmsTemplate,
}: SmsTabProps) {
  const [smsSaving, setSmsSaving] = useState(false)
  const [smsSaved, setSmsSaved] = useState(false)
  const [testSmsPhone, setTestSmsPhone] = useState('')
  const [testSmsState, setTestSmsState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [testSmsError, setTestSmsError] = useState('')

  async function saveSms() {
    setSmsSaving(true)
    setSmsSaved(false)
    const body: Record<string, unknown> = {
      sms_enabled: smsEnabled,
      sms_template: smsTemplate,
    }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSmsSaving(false)
    if (res.ok) {
      setSmsSaved(true)
      setTimeout(() => setSmsSaved(false), 3000)
    }
  }

  async function fireTestSms() {
    if (!testSmsPhone.trim()) return
    setTestSmsState('sending')
    setTestSmsError('')
    const body: Record<string, unknown> = { to_phone: testSmsPhone.trim() }
    if (isAdmin) body.client_id = client.id
    try {
      const res = await fetch('/api/dashboard/settings/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setTestSmsState('done')
        setTimeout(() => setTestSmsState('idle'), 4000)
      } else {
        setTestSmsState('error')
        setTestSmsError(data.error || 'Send failed — check Twilio config.')
      }
    } catch {
      setTestSmsState('error')
      setTestSmsError('Network error')
    }
  }

  return (<>
    {!isAdmin && (
      <p className="text-[11px] t3 mb-3">Send a follow-up text after calls.</p>
    )}
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
    >
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">SMS Follow-up</p>
          <p className="text-[11px] t3 mt-0.5">Sent to the caller after each call ends.</p>
        </div>
        <button
          onClick={saveSms}
          disabled={smsSaving || !client.twilio_number || previewMode}
          className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            smsSaved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-blue-500 hover:bg-blue-400 text-white'
          } disabled:opacity-40`}
        >
          {smsSaving ? 'Saving…' : smsSaved ? '✓ Saved' : 'Save SMS Config'}
        </button>
      </div>

      {/* No Twilio number warning */}
      {!client.twilio_number && (
        <div className="flex items-center gap-2.5 mt-3 px-3.5 py-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/20">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[11px] text-amber-400/90">SMS requires a phone number. Contact support to add one.</span>
        </div>
      )}

      {/* Toggle */}
      <div className="flex items-center gap-3 py-3 border-b b-theme">
        <PremiumToggle
          checked={smsEnabled}
          onChange={() => setSmsEnabled(!smsEnabled)}
          disabled={!client.twilio_number || previewMode}
        />
        <span className="text-xs t2">
          {!client.twilio_number
            ? 'SMS unavailable — no phone number assigned'
            : smsEnabled ? 'Auto-send SMS after each call' : 'SMS disabled — callers will not receive a follow-up text'}
        </span>
      </div>

      {/* Template editor */}
      <div className="mt-3">
        <label className="text-[11px] t3 block mb-1.5">Message Template</label>
        <textarea
          value={smsTemplate}
          onChange={e => setSmsTemplate(e.target.value)}
          disabled={!smsEnabled || !client.twilio_number}
          rows={3}
          className="w-full bg-black/20 border b-theme rounded-xl p-3 text-sm t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          placeholder="Thanks for calling {{business}}! We'll follow up shortly."
        />
        <p className="text-[10px] t3 mt-1">
          Placeholders: <span className="font-mono t3">{'{{business}}'}</span> = business name &nbsp;·&nbsp; <span className="font-mono t3">{'{{summary}}'}</span> = call summary excerpt
        </p>
      </div>

      {/* Live preview */}
      {smsTemplate && (
        <div className="mt-3 px-3 py-2.5 rounded-xl bg-surface border b-theme">
          <p className="text-[10px] font-semibold t3 uppercase tracking-wider mb-1">Preview</p>
          <p className="text-xs t2 leading-relaxed whitespace-pre-wrap">
            {smsTemplate
              .replace(/\{\{business\}\}/g, client.business_name || '')
              .replace(/\{\{summary\}\}/g, '[call summary]')}
          </p>
        </div>
      )}

      {/* Test SMS */}
      <div className="mt-4 pt-4 border-t b-theme">
        <p className="text-[11px] t3 mb-2">Send a test SMS to verify delivery</p>
        <div className="flex items-center gap-2">
          <input
            type="tel"
            value={testSmsPhone}
            onChange={e => setTestSmsPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fireTestSms()}
            placeholder="+14031234567"
            disabled={testSmsState === 'sending'}
            className="flex-1 bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 font-mono focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40"
          />
          <button
            onClick={fireTestSms}
            disabled={!testSmsPhone.trim() || testSmsState === 'sending' || !smsTemplate || !client.twilio_number || previewMode}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 t1 transition-all disabled:opacity-40 shrink-0"
          >
            {testSmsState === 'sending' ? 'Sending…' : 'Send Test'}
          </button>
        </div>

        {testSmsState === 'done' && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/[0.07] border border-green-500/20">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[11px] text-green-400/90">SMS sent to {testSmsPhone}</span>
          </div>
        )}

        {testSmsState === 'error' && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/[0.07] border border-red-500/20">
            <span className="text-[11px] text-red-400/90 flex-1">{testSmsError}</span>
            <button
              onClick={() => setTestSmsState('idle')}
              className="text-[10px] t3 hover:t2"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
    </motion.div>
  </>)
}
