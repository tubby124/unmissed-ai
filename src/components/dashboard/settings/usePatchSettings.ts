'use client'

import { useState, useCallback } from 'react'

/**
 * Shared hook for PATCH /api/dashboard/settings.
 * Handles loading/saved/error state and admin client_id injection.
 */
export function usePatchSettings(clientId: string, isAdmin: boolean) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const patch = useCallback(async (body: Record<string, unknown>) => {
    setSaving(true)
    setSaved(false)
    const payload = { ...body, ...(isAdmin ? { client_id: clientId } : {}) }
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    return res
  }, [clientId, isAdmin])

  return { saving, saved, patch }
}
