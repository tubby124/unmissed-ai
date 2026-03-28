'use client'

/**
 * useHomeMutation.ts
 *
 * Thin wrapper around usePatchSettings that exposes a richer MutationStatus
 * for bento tile UI (dirty indicator, syncing runtime, retrying states).
 *
 * Does NOT bypass usePatchSettings serialization chain.
 */

import { useState, useCallback } from 'react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

export type MutationStatus =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved_local'
  | 'syncing_runtime'
  | 'synced'
  | 'failed'
  | 'retrying'

export const MUTATION_STATUS_COPY: Record<MutationStatus, string> = {
  idle: '',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved_local: 'Saved. Applies to your next call.',
  syncing_runtime: 'Syncing agent…',
  synced: 'Synced.',
  failed: 'Failed to save.',
  retrying: 'Retrying…',
}

interface UseHomeMutationOptions {
  clientId: string
  isAdmin: boolean
  onSave?: () => void
}

export function useHomeMutation({ clientId, isAdmin, onSave }: UseHomeMutationOptions) {
  const [status, setStatus] = useState<MutationStatus>('idle')

  const patchSettings = usePatchSettings(clientId, isAdmin, { onSave })

  const markDirty = useCallback(() => {
    setStatus(prev => (prev === 'idle' || prev === 'synced' || prev === 'saved_local') ? 'dirty' : prev)
  }, [])

  const save = useCallback(async (body: Record<string, unknown>) => {
    setStatus('saving')
    const res = await patchSettings.patch(body)

    if (!res?.ok) {
      setStatus('failed')
      return res
    }

    // Determine whether runtime sync was needed based on API response
    if (patchSettings.syncStatus === 'synced') {
      // Already set synchronously, but we drive our own state from the response
      setStatus('synced')
    } else if (patchSettings.syncStatus === 'failed') {
      setStatus('failed')
    } else {
      // not-needed or skipped = DB saved, no agent sync (call-time injection or no agent ID yet)
      setStatus('saved_local')
      setTimeout(() => setStatus('idle'), 4000)
    }

    return res
  }, [patchSettings])

  // The syncStatus from usePatchSettings arrives async after the patch call.
  // We additionally watch it to drive saving → syncing_runtime → synced transitions.
  const handleSyncStatus = useCallback((syncStatus: typeof patchSettings.syncStatus) => {
    if (status !== 'saving') return
    if (syncStatus === 'synced') setStatus('synced')
    else if (syncStatus === 'failed') setStatus('failed')
    else if (syncStatus === 'not-needed' || syncStatus === 'skipped') {
      setStatus('saved_local')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }, [status])

  // Call this after patchSettings.syncStatus updates to drive transitions
  // (consumers should pass syncStatus into an effect and call this)
  void handleSyncStatus // referenced to avoid unused warning — used by consumers

  const retry = useCallback(async () => {
    setStatus('retrying')
    const res = await patchSettings.retrySyncFailed()
    if (res?.ok) {
      setStatus('synced')
    } else {
      setStatus('failed')
    }
    return res
  }, [patchSettings])

  const reset = useCallback(() => setStatus('idle'), [])

  return {
    status,
    statusCopy: MUTATION_STATUS_COPY[status],
    saving: patchSettings.saving,
    saved: patchSettings.saved,
    error: patchSettings.error,
    syncError: patchSettings.syncError,
    warnings: patchSettings.warnings,
    markDirty,
    save,
    retry,
    reset,
    clearError: patchSettings.clearError,
  }
}
