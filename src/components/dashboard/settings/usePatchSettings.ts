'use client'

import { useState, useCallback, useRef } from 'react'

/** Card display mode — settings (full) vs onboarding (simplified copy/fields). */
export type CardMode = 'settings' | 'onboarding'

/** Sync status from the API response. */
export type SyncStatus = 'synced' | 'not-needed' | 'failed' | null

export interface UsePatchSettingsOptions {
  onSave?: () => void
  onPromptChange?: (prompt: string) => void
}

// SET-12: Serialize PATCH requests per client to prevent prompt race conditions.
// When two cards save simultaneously (e.g. voice style + section edit), the second
// waits for the first to complete. Since the server re-reads the latest prompt from
// DB for each patch operation, serialization ensures no stale-read overwrites.
const inflightPatches = new Map<string, Promise<unknown>>()

function serializeForClient<T>(clientId: string, fn: () => Promise<T>): Promise<T> {
  const prev = inflightPatches.get(clientId) ?? Promise.resolve()
  const next = prev.then(fn, fn) // Run fn even if prev rejected
  inflightPatches.set(clientId, next)
  // Clean up when the chain settles to avoid memory leak
  next.then(
    () => { if (inflightPatches.get(clientId) === next) inflightPatches.delete(clientId) },
    () => { if (inflightPatches.get(clientId) === next) inflightPatches.delete(clientId) },
  )
  return next
}

/**
 * Shared hook for PATCH /api/dashboard/settings.
 * Handles loading/saved/error state, admin client_id injection,
 * and surfaces Ultravox sync status + warnings from the API response.
 *
 * SET-12: All requests for the same client are serialized — concurrent saves
 * queue instead of racing. This prevents last-writer-wins prompt corruption.
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
  const [syncError, setSyncError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  // SET-14: Store last payload that triggered a sync failure for retry
  const lastFailedPayload = useRef<Record<string, unknown> | null>(null)

  const patch = useCallback(async (body: Record<string, unknown>) => {
    setSaving(true)
    setSaved(false)
    setError(null)
    setSyncStatus(null)
    setSyncError(null)
    setWarnings([])

    const res = await serializeForClient(clientId, async () => {
      const payload = { ...body, ...(isAdmin ? { client_id: clientId } : {}) }
      return fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    })

    setSaving(false)
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      setSaved(true)
      // Surface sync details from the API response
      if (data.ultravox_synced === true) {
        setSyncStatus('synced')
        // SET-14: Clear failed payload on successful sync
        lastFailedPayload.current = null
        setSyncError(null)
      } else if (data.ultravox_synced === false && data.ultravox_error) {
        setSyncStatus('failed')
        setSyncError(data.ultravox_error)
        // SET-14: Store payload for retry
        lastFailedPayload.current = body
      } else {
        // No ultravox_synced field = call-time injection, no agent sync needed
        setSyncStatus('not-needed')
      }
      if (Array.isArray(data.warnings)) {
        setWarnings(data.warnings.map((w: { message?: string }) => w.message || String(w)))
      }
      if (typeof data.system_prompt === 'string') {
        options?.onPromptChange?.(data.system_prompt)
      }
      options?.onSave?.()
      setTimeout(() => { setSaved(false); setSyncStatus(null); setWarnings([]) }, 5000)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || `Save failed (${res.status})`)
    }
    return res
  }, [clientId, isAdmin, options])

  // SET-14: Re-send the last failed payload to retry Ultravox sync
  const retrySyncFailed = useCallback(async () => {
    const payload = lastFailedPayload.current
    if (!payload) return null
    return patch(payload)
  }, [patch])

  const clearError = useCallback(() => setError(null), [])

  return { saving, saved, error, syncStatus, syncError, warnings, patch, clearError, retrySyncFailed }
}
