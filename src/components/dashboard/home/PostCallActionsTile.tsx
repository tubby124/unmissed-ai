'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

interface Props {
  clientId: string
  isAdmin?: boolean
  smsEnabled: boolean
  smsTemplate: string | null
  hasSms: boolean        // capability flag — true only when twilio_number is set
  agentName?: string | null
}

const DEFAULT_TEMPLATE = (name: string) =>
  `Hi, this is ${name}! Thanks for calling — here's a quick follow-up with any details we discussed. Feel free to reply with any questions.`

const CHAR_LIMIT = 320

export default function PostCallActionsTile({
  clientId,
  isAdmin = false,
  smsEnabled,
  smsTemplate,
  hasSms,
  agentName,
}: Props) {
  const { patch, saving } = usePatchSettings(clientId, isAdmin)

  const name = agentName ?? 'your agent'

  const [smsOn, setSmsOn] = useState(smsEnabled)
  const [template, setTemplate] = useState(smsTemplate ?? DEFAULT_TEMPLATE(name))
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateDirty, setTemplateDirty] = useState(false)

  async function toggleSms() {
    if (!hasSms) return
    const next = !smsOn
    setSmsOn(next)
    await patch({ sms_enabled: next })
  }

  async function saveTemplate() {
    await patch({ sms_template: template })
    setTemplateDirty(false)
  }

  const charsLeft = CHAR_LIMIT - template.length
  const overLimit = charsLeft < 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.04 }}
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(74,222,128)' }}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 10h8M8 14h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-semibold t1 leading-tight">After Calls</p>
            <p className="text-[11px] t3 leading-tight mt-0.5">SMS follow-ups</p>
          </div>
        </div>
        <div className="shrink-0 mt-0.5">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full leading-none"
            style={{
              backgroundColor: (smsOn && hasSms) ? 'rgba(34,197,94,0.12)' : 'var(--color-hover)',
              color: (smsOn && hasSms) ? 'rgb(74,222,128)' : 'var(--color-text-3)',
            }}
          >
            {(smsOn && hasSms) ? 'active' : 'off'}
          </span>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />

      {/* ── SMS toggle row ── */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={toggleSms}
            disabled={saving || !hasSms}
            className="relative rounded-full transition-colors focus-visible:outline-none shrink-0 disabled:opacity-50"
            style={{
              backgroundColor: (smsOn && hasSms) ? 'rgb(34,197,94)' : 'var(--color-hover)',
              height: '18px',
              width: '32px',
            }}
            aria-label={smsOn ? 'Disable SMS follow-up' : 'Enable SMS follow-up'}
          >
            <span
              className="absolute top-0.5 rounded-full transition-all duration-200"
              style={{
                width: '14px',
                height: '14px',
                backgroundColor: (smsOn && hasSms) ? '#fff' : 'var(--color-text-3)',
                left: (smsOn && hasSms) ? '15px' : '2px',
              }}
            />
          </button>
          <div className="min-w-0">
            <p className="text-[12px] font-medium t1">Auto-send text after call</p>
            {!hasSms && (
              <p className="text-[11px] t3">Requires a phone number — upgrade to activate</p>
            )}
            {hasSms && !smsOn && (
              <p className="text-[11px] t3">Callers receive a follow-up text after hanging up</p>
            )}
            {hasSms && smsOn && (
              <p className="text-[11px] leading-tight" style={{ color: 'rgb(74,222,128)' }}>
                On — template below is what gets sent
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t mx-4" style={{ borderColor: 'var(--color-border)' }} />

      {/* ── Template section ── */}
      <div>
        <button
          onClick={() => setTemplateOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-hover transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(129,140,248)' }}>
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-[12px] font-medium t1">Message template</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] t3">{template.length}/{CHAR_LIMIT}</span>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              className={`transition-transform duration-200 ${templateOpen ? 'rotate-180' : ''}`}
              style={{ color: 'var(--color-text-3)' }}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {templateOpen && (
            <motion.div
              key="template-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                <textarea
                  value={template}
                  onChange={(e) => { setTemplate(e.target.value); setTemplateDirty(true) }}
                  rows={4}
                  className="w-full text-[12px] rounded-lg px-3 py-2 resize-none transition-colors focus:outline-none focus:ring-1"
                  style={{
                    backgroundColor: 'var(--color-hover)',
                    color: 'var(--color-text-1)',
                    border: `1px solid ${overLimit ? 'rgba(239,68,68,0.5)' : 'var(--color-border)'}`,
                    lineHeight: '1.55',
                  }}
                />
                <div className="flex items-center justify-between">
                  {overLimit ? (
                    <span className="text-[11px]" style={{ color: 'rgb(239,68,68)' }}>
                      {Math.abs(charsLeft)} chars over limit
                    </span>
                  ) : (
                    <span className="text-[11px] t3">{charsLeft} remaining</span>
                  )}
                  <AnimatePresence>
                    {templateDirty && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={saveTemplate}
                        disabled={saving || overLimit}
                        className="text-[11px] font-semibold px-3 py-1 rounded-lg transition-opacity hover:opacity-75 disabled:opacity-40"
                        style={{ backgroundColor: 'rgb(99,102,241)', color: '#fff' }}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
