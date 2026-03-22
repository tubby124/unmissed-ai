'use client'

import { useState, useCallback } from 'react'

/** Card display mode — settings (full) vs onboarding (simplified copy/fields). */
export type CardMode = 'settings' | 'onboarding'

/** Sync status from the API response. */
export type SyncStatus = 'synced' | 'not-needed' | 'failed' | null

export interface UsePatchSettingsOptions {
  onSave?: () => void
}

/**
 * Shared hook for PATCH /api/dashboard/settings.
 * Handles loading/saved/error state, admin client_id injection,
 * and surfaces Ultravox sync status + warnings from the API response.
 */
export function usePatchSettings(
  clientId: string,
  isAdmin: boolean,
  options?: UsePatchSettingsOptions,
) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const patch = useCallback(async (body: Record<string, unknown>) => {
    setSaving(true)
    setSaved(false)
    setError(null)
    setSyncStatus(null)
    setWarnings([])
    const payload = { ...body, ...(isAdmin ? { client_id: clientId } : {}) }
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      setSaved(true)
      // Surface sync details from the API response
      if (data.ultravox_synced === true) {
        setSyncStatus('synced')
      } else if (data.ultravox_synced === false && data.ultravox_error) {
        setSyncStatus('failed')
      } else {
        // No ultravox_synced field = call-time injection, no agent sync needed
        setSyncStatus('not-needed')
      }
      if (Array.isArray(data.warnings)) {
        setWarnings(data.warnings.map((w: { message?: string }) => w.message || String(w)))
      }
      options?.onSave?.()
      setTimeout(() => { setSaved(false); setSyncStatus(null); setWarnings([]) }, 5000)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || `Save failed (${res.status})`)
    }
    return res
  }, [clientId, isAdmin, options])

  const clearError = useCallback(() => setError(null), [])

  return { saving, saved, error, syncStatus, warnings, patch, clearError }
}
