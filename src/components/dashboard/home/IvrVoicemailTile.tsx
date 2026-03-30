'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

interface Props {
  clientId: string
  isAdmin?: boolean
  ivrEnabled: boolean
  ivrPrompt: string | null
  voicemailGreetingText: string | null
  businessName?: string | null
  agentName?: string | null
}

const DEFAULT_IVR = (name: string) =>
  `Hi, you've reached ${name}. Press 1 for voicemail, or stay on the line to speak with our AI assistant.`

const DEFAULT_VOICEMAIL = (name: string) =>
  `Hi, you've reached ${name}. We're unavailable right now. Please leave your name and number and we'll get back to you shortly.`

export default function IvrVoicemailTile({
  clientId,
  isAdmin = false,
  ivrEnabled,
  ivrPrompt,
  voicemailGreetingText,
  businessName,
  agentName,
}: Props) {
  const { patch, saving } = usePatchSettings(clientId, isAdmin)

  const biz = businessName ?? agentName ?? 'the business'

  const [ivr, setIvr] = useState(ivrEnabled)
  const [ivrText, setIvrText] = useState(ivrPrompt ?? DEFAULT_IVR(biz))
  const [ivrOpen, setIvrOpen] = useState(false)

  const [vmText, setVmText] = useState(voicemailGreetingText ?? DEFAULT_VOICEMAIL(biz))
  const [vmOpen, setVmOpen] = useState(false)

  const [ivrDirty, setIvrDirty] = useState(false)
  const [vmDirty, setVmDirty] = useState(false)

  async function toggleIvr() {
    const next = !ivr
    setIvr(next)
    await patch({ ivr_enabled: next })
  }

  async function saveIvr() {
    await patch({ ivr_prompt: ivrText })
    setIvrDirty(false)
  }

  async function saveVm() {
    await patch({ voicemail_greeting_text: vmText })
    setVmDirty(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(99,102,241,0.12)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(129,140,248)' }}>
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.71 8.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012.62 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 9.91a16 16 0 006.88 6.88l1.27-.96a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-semibold t1 leading-tight">Call Routing</p>
            <p className="text-[11px] t3 leading-tight mt-0.5">IVR menu + voicemail</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full leading-none"
            style={{
              backgroundColor: ivr ? 'rgba(34,197,94,0.12)' : 'var(--color-hover)',
              color: ivr ? 'rgb(74,222,128)' : 'var(--color-text-3)',
            }}
          >
            IVR {ivr ? 'on' : 'off'}
          </span>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />

      {/* ── IVR Section ── */}
      <div>
        <button
          onClick={() => setIvrOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-hover transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            {/* Toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleIvr() }}
              disabled={saving}
              className="relative w-8 h-4.5 rounded-full transition-colors focus-visible:outline-none shrink-0"
              style={{
                backgroundColor: ivr ? 'rgb(99,102,241)' : 'var(--color-hover)',
                height: '18px',
                width: '32px',
              }}
              aria-label={ivr ? 'Disable IVR' : 'Enable IVR'}
            >
              <span
                className="absolute top-0.5 rounded-full transition-all duration-200"
                style={{
                  width: '14px',
                  height: '14px',
                  backgroundColor: ivr ? '#fff' : 'var(--color-text-3)',
                  left: ivr ? '15px' : '2px',
                }}
              />
            </button>
            <div>
              <p className="text-[12px] font-medium t1">Pre-call menu</p>
              <p className="text-[11px] t3">Route callers before connecting</p>
            </div>
          </div>
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            className={`shrink-0 transition-transform duration-200 ${ivrOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--color-text-3)' }}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <AnimatePresence initial={false}>
          {ivrOpen && (
            <motion.div
              key="ivr-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 space-y-2">
                <p className="text-[11px] t3 leading-relaxed">
                  Callers hear this before reaching your agent. Press 1 = voicemail, any key = agent.
                </p>
                <textarea
                  value={ivrText}
                  onChange={(e) => { setIvrText(e.target.value); setIvrDirty(true) }}
                  rows={3}
                  className="w-full text-[12px] rounded-lg px-3 py-2 resize-none transition-colors focus:outline-none focus:ring-1"
                  style={{
                    backgroundColor: 'var(--color-hover)',
                    color: 'var(--color-text-1)',
                    border: '1px solid var(--color-border)',
                    lineHeight: '1.5',
                  }}
                  placeholder={DEFAULT_IVR(biz)}
                />
                <AnimatePresence>
                  {ivrDirty && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex justify-end"
                    >
                      <button
                        onClick={saveIvr}
                        disabled={saving}
                        className="text-[11px] font-semibold px-3 py-1 rounded-lg transition-opacity hover:opacity-75 disabled:opacity-40"
                        style={{ backgroundColor: 'rgb(99,102,241)', color: '#fff' }}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t mx-4" style={{ borderColor: 'var(--color-border)' }} />

      {/* ── Voicemail Section ── */}
      <div>
        <button
          onClick={() => setVmOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-hover transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(245,158,11,0.12)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(251,191,36)' }}>
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-[12px] font-medium t1">Voicemail greeting</p>
              <p className="text-[11px] t3">
                {voicemailGreetingText ? `${voicemailGreetingText.slice(0, 40)}…` : 'Default greeting'}
              </p>
            </div>
          </div>
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            className={`shrink-0 transition-transform duration-200 ${vmOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--color-text-3)' }}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <AnimatePresence initial={false}>
          {vmOpen && (
            <motion.div
              key="vm-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                <p className="text-[11px] t3 leading-relaxed">
                  Played when your agent is unavailable or when IVR routes to voicemail.
                </p>
                <textarea
                  value={vmText}
                  onChange={(e) => { setVmText(e.target.value); setVmDirty(true) }}
                  rows={3}
                  className="w-full text-[12px] rounded-lg px-3 py-2 resize-none transition-colors focus:outline-none focus:ring-1"
                  style={{
                    backgroundColor: 'var(--color-hover)',
                    color: 'var(--color-text-1)',
                    border: '1px solid var(--color-border)',
                    lineHeight: '1.5',
                  }}
                  placeholder={DEFAULT_VOICEMAIL(biz)}
                />
                <AnimatePresence>
                  {vmDirty && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex justify-end"
                    >
                      <button
                        onClick={saveVm}
                        disabled={saving}
                        className="text-[11px] font-semibold px-3 py-1 rounded-lg transition-opacity hover:opacity-75 disabled:opacity-40"
                        style={{ backgroundColor: 'rgb(99,102,241)', color: '#fff' }}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
