'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

/** Card display mode — settings (full) vs onboarding (simplified copy/fields). */
export type CardMode = 'settings' | 'onboarding'

/** Sync status from the API response. */
export type SyncStatus = 'synced' | 'not-needed' | 'skipped' | 'failed' | null

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
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [knowledgeReseeded, setKnowledgeReseeded] = useState(false)

  // SET-14: Store last payload that triggered a sync failure for retry
  const lastFailedPayload = useRef<Record<string, unknown> | null>(null)

  // REFACTOR-1: Latest-ref pattern — options callbacks stay current without being useCallback deps.
  // Cards pass inline { onSave, onPromptChange } objects that recreate every render; putting options
  // in the dep array caused patch to also recreate every render.
  const optionsRef = useRef(options)
  optionsRef.current = options

  // REFACTOR-2: Debounce router.refresh() — back-to-back saves can trigger two in-flight refreshes
  // in Next.js 15 App Router which race and cause hydration mismatches.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setKnowledgeReseeded(false)
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
      } else if (data.ultravox_synced === false) {
        // Sync was needed but skipped (e.g. no ultravox_agent_id set yet)
        setSyncStatus('skipped')
      } else {
        // No ultravox_synced field = call-time injection, no agent sync needed
        setSyncStatus('not-needed')
      }
      if (Array.isArray(data.warnings)) {
        setWarnings(data.warnings.map((w: { message?: string }) => w.message || String(w)))
      }
      if (data.knowledge_reseeding === true) {
        setKnowledgeReseeded(true)
      }
      if (typeof data.system_prompt === 'string') {
        optionsRef.current?.onPromptChange?.(data.system_prompt)
      }
      optionsRef.current?.onSave?.()
      // REFACTOR-2: Debounced refresh — coalesces back-to-back saves into a single navigation update.
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = setTimeout(() => { router.refresh() }, 300)
      // REFACTOR-4: Use toast.warning when patcher warnings are present so the user isn't misled
      // by a green ✓ Saved toast while an amber warning banner is also showing.
      // Must check data.warnings (raw response) — React state hasn't re-rendered yet at this point.
      if (data.ultravox_synced === false && data.ultravox_error) {
        toast.warning('Settings saved — agent sync failed. Try saving again.')
      } else if (data.ultravox_synced === false) {
        toast.warning('Saved — agent sync skipped')
      } else if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        toast.warning('Saved — see warning below')
      } else {
        toast.success('Saved ✓')
      }
      // REFACTOR-3: Removed setWarnings([]) — warnings already clear at the start of each new
      // patch() call (line 67), so the 5s auto-dismiss was silently swallowing them.
      setTimeout(() => { setSaved(false); setSyncStatus(null); setKnowledgeReseeded(false) }, 5000)
    } else {
      const data = await res.json().catch(() => ({}))
      const msg = data.error || `Save failed (${res.status})`
      setError(msg)
      toast.error(msg)
    }
    return res
  }, [clientId, isAdmin])  // options removed — read via optionsRef (REFACTOR-1)

  // SET-14: Re-send the last failed payload to retry Ultravox sync
  const retrySyncFailed = useCallback(async () => {
    const payload = lastFailedPayload.current
    if (!payload) return null
    return patch(payload)
  }, [patch])

  const clearError = useCallback(() => setError(null), [])

  return { saving, saved, error, syncStatus, syncError, warnings, knowledgeReseeded, patch, clearError, retrySyncFailed }
}
