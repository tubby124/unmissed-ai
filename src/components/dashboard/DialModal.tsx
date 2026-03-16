'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface Client {
  id: string
  slug: string
  business_name: string
}

interface DialModalProps {
  clients: Client[]
  defaultSlug?: string
  defaultPhone?: string
  onClose: () => void
  onDialed: (callId: string, phone: string) => void
}

export default function DialModal({ clients, defaultSlug, defaultPhone, onClose, onDialed }: DialModalProps) {
  const [phone, setPhone] = useState(() => {
    if (!defaultPhone) return ''
    const digits = defaultPhone.replace(/\D/g, '').slice(-10)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  })
  const [slug, setSlug] = useState(defaultSlug ?? clients[0]?.slug ?? '')
  const [status, setStatus] = useState<'idle' | 'dialing' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  const handleDial = async (e: React.FormEvent) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) { setErrorMsg('Enter a valid 10-digit number'); return }
    if (!slug) { setErrorMsg('Select a client'); return }

    setStatus('dialing')
    setErrorMsg('')

    try {
      const res = await fetch('/api/dashboard/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, phone: `+1${digits}` }),
      })
      const data = await res.json()
      if (!res.ok) { setStatus('error'); setErrorMsg(data.error ?? 'Dial failed'); return }
      setStatus('success')
      onDialed(data.callId, `+1${digits}`)
    } catch {
      setStatus('error')
      setErrorMsg('Network error — try again')
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-sm rounded-2xl border p-6 space-y-5 shadow-2xl"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-raised)" }}
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: "var(--color-text-3)" }}>Outbound Dial</p>
              <p className="text-base font-semibold mt-0.5" style={{ color: "var(--color-text-1)" }}>Place a call</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-hover)] transition-all"
              style={{ color: "var(--color-text-3)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {status === 'success' ? (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 py-4"
            >
              <div className="relative flex items-center justify-center w-16 h-16">
                <motion.div
                  className="absolute rounded-full bg-green-500/20"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ width: '100%', height: '100%' }}
                />
                <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-green-400">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.77 9.84 19.79 19.79 0 01.7 1.23a2 2 0 012-2.18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 6.54a16 16 0 006.29 6.29l.86-.86a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-green-300">Dialing…</p>
              <p className="text-xs" style={{ color: "var(--color-text-3)" }}>Watch the live banner for the call</p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 rounded-lg text-xs font-medium border hover:bg-[var(--color-hover)] transition-all"
                style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text-2)", borderColor: "var(--color-border)" }}
              >
                Close
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleDial} className="space-y-4">
              {/* Client selector */}
              {clients.length > 1 && (
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-text-3)" }}>Agent</label>
                  <select
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/30 transition-colors appearance-none"
                    style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-2)" }}
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.slug}>{c.business_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Phone input */}
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-text-3)" }}>Phone number</label>
                <div className="flex items-center gap-2 border rounded-xl px-3 py-2.5 focus-within:border-blue-500/30 transition-colors" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                  <span className="text-sm font-mono shrink-0" style={{ color: "var(--color-text-3)" }}>+1</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(formatPhone(e.target.value))}
                    placeholder="(555) 000-0000"
                    autoFocus
                    className="flex-1 bg-transparent text-sm placeholder-zinc-700 focus:outline-none font-mono"
                    style={{ color: "var(--color-text-1)" }}
                  />
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs text-red-400">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === 'dialing'}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-green-500/15 text-green-300 border border-green-500/25 hover:bg-green-500/25 hover:border-green-500/40 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {status === 'dialing' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Connecting…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.77 9.84 19.79 19.79 0 01.7 1.23a2 2 0 012-2.18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 6.54a16 16 0 006.29 6.29l.86-.86a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Place Call
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
