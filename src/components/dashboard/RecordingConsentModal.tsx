'use client'

/**
 * Wave 1.5 — Backfill modal for clients that predate the consent migration.
 *
 * Renders ONLY when clients.recording_consent_acknowledged_at IS NULL.
 * Required acknowledgment — modal cannot be dismissed until checkbox is checked
 * AND the user clicks "Acknowledge". Does NOT auto-enable in-call disclosure for
 * grandfathered clients (they opt-in separately via Settings).
 */

import { useState } from 'react'
import { toast } from 'sonner'

interface Props {
  clientId: string
  onAcknowledged: () => void
}

export default function RecordingConsentModal({ clientId, onAcknowledged }: Props) {
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAcknowledge() {
    if (!checked || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/dashboard/recording-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to save' }))
        throw new Error(data.error ?? 'Failed to save')
      }
      toast.success('Acknowledged — thanks!')
      onAcknowledged()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div
        className="rounded-2xl border w-full max-w-md p-6 space-y-4"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="space-y-1">
          <p
            id="consent-title"
            className="text-sm font-semibold tracking-[0.12em] uppercase"
            style={{ color: 'var(--color-primary)' }}
          >
            One-time confirmation needed
          </p>
          <h2 className="text-base font-bold t1">Recording authorization</h2>
        </div>

        <p className="text-xs t2 leading-relaxed">
          Your AI agent records every call for quality and review. To keep using your dashboard,
          please confirm you have authorization to record callers in your jurisdiction.
        </p>

        <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors hover:bg-hover" style={{ borderColor: 'var(--color-border)' }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <span className="text-xs t1 leading-snug">
            <strong className="font-semibold">I confirm I have authorization to record incoming calls</strong> on
            behalf of this business and accept responsibility for caller-consent compliance in my jurisdiction.
          </span>
        </label>

        <p className="text-[11px] t3 leading-snug">
          This does not change your agent&apos;s greeting. To turn on a spoken disclosure
          (&ldquo;heads up — this call&apos;s being recorded for quality&rdquo;), enable it
          from your Settings after acknowledging.
        </p>

        <button
          type="button"
          disabled={!checked || saving}
          onClick={handleAcknowledge}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
          }}
        >
          {saving ? 'Saving…' : 'Acknowledge and continue'}
        </button>
      </div>
    </div>
  )
}
