'use client'

/**
 * D130 — Share your number card
 * Shows when client has a Twilio number AND total live call count < 5.
 * Helps owners forward their existing number and tell customers about the agent.
 * Dismissible for the session (auto-hides once calls start flowing).
 */

import { useState } from 'react'

interface Props {
  twilioNumber: string
}

function formatDisplayNumber(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return e164
}

const CARRIER_CODES = [
  {
    carriers: 'Rogers / Fido / Chatr',
    forward: (n: string) => `*21*${n}#`,
    cancel: '##21#',
  },
  {
    carriers: 'Bell / Virgin / Lucky',
    forward: (n: string) => `*21*${n}#`,
    cancel: '#21#',
  },
  {
    carriers: 'Telus / Koodo / Public Mobile',
    forward: (n: string) => `*72${n}`,
    cancel: '*73',
  },
]

export default function ShareNumberCard({ twilioNumber }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [codesOpen, setCodesOpen] = useState(false)

  if (dismissed) return null

  const displayNumber = formatDisplayNumber(twilioNumber)
  // Strip to digits only for carrier codes (no + prefix)
  const dialNumber = twilioNumber.replace(/\D/g, '')

  function handleCopy() {
    navigator.clipboard.writeText(twilioNumber).catch(() => {
      // fallback: select and copy
      const el = document.createElement('textarea')
      el.value = twilioNumber
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.78 10.5 19.79 19.79 0 01.69 1.88 2 2 0 012.68 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.76a16 16 0 006.29 6.29l1.12-1.12a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-[12px] font-semibold t1">Your agent's number is ready</p>
            <p className="text-[11px] t3 leading-snug">Let your customers know.</p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 hover:opacity-60 transition-opacity leading-none mt-0.5"
          style={{ color: 'var(--color-text-3)', fontSize: '18px' }}
        >
          ×
        </button>
      </div>

      {/* Number display + copy */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl mb-3"
        style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)' }}
      >
        <span className="text-[15px] font-mono font-semibold t1 tracking-wide">{displayNumber}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all shrink-0"
          style={{
            backgroundColor: copied ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)',
            color: copied ? 'rgb(34,197,94)' : 'var(--color-primary)',
            border: `1px solid ${copied ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.2)'}`,
          }}
        >
          {copied ? (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Carrier forwarding toggle */}
      <button
        onClick={() => setCodesOpen(o => !o)}
        className="flex items-center gap-1.5 text-[11px] font-medium t3 hover:t2 transition-colors w-full text-left"
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          className={`shrink-0 transition-transform duration-150 ${codesOpen ? 'rotate-90' : ''}`}
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        Forward your existing number to this one
      </button>

      {codesOpen && (
        <div className="mt-3 space-y-1">
          <p className="text-[10px] t3 mb-2">Dial these codes from your business phone to forward all calls:</p>
          {CARRIER_CODES.map(row => (
            <div
              key={row.carriers}
              className="rounded-xl px-3 py-2"
              style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[11px] font-semibold t2 mb-1">{row.carriers}</p>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-[11px] t3">
                  Forward: <code className="font-mono text-[11px] t1 ml-1">{row.forward(dialNumber)}</code>
                </span>
                <span className="text-[11px] t3">
                  Cancel: <code className="font-mono text-[11px] t1 ml-1">{row.cancel}</code>
                </span>
              </div>
            </div>
          ))}
          <p className="text-[10px] t3 mt-2 leading-relaxed">
            Dial the forward code, wait for confirmation tone, then hang up. Your existing number will route to your agent.
          </p>
        </div>
      )}
    </div>
  )
}
