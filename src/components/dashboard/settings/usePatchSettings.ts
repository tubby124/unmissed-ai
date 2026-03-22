'use client'

import { useState, useCallback } from 'react'

/** Card display mode — settings (full) vs onboarding (simplified copy/fields). */
export type CardMode = 'settings' | 'onboarding'

export interface UsePatchSettingsOptions {
  onSave?: () => void
}

/**
 * Shared hook for PATCH /api/dashboard/settings.
 * Handles loading/saved/error state and admin client_id injection.
 */
export function usePatchSettings(
  clientId: string,
  isAdmin: boolean,
  options?: UsePatchSettingsOptions,
) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = useCallback(async (body: Record<string, unknown>) => {
    setSaving(true)
    setSaved(false)
    setError(null)
    const payload = { ...body, ...(isAdmin ? { client_id: clientId } : {}) }
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      options?.onSave?.()
      setTimeout(() => setSaved(false), 3000)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || `Save failed (${res.status})`)
    }
    return res
  }, [clientId, isAdmin, options])

  const clearError = useCallback(() => setError(null), [])

  return { saving, saved, error, patch, clearError }
}
