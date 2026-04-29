'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAdminClient } from '@/contexts/AdminClientContext'
import { isAdminRedesignEnabledClient } from '@/lib/feature-flags'

// Phase 0.5.2 — "Acting as" persistent banner.
// Shows whenever an admin has scoped the dashboard into another client via
// the AdminClientContext (URL ?client_id=...). Provides the explicit edit
// gate required by Phase 0.5.3.
//
// State lifecycle:
//   - sessionStorage key: `admin-edit-mode:<targetClientId>` (auto-clears on tab close)
//   - Cleared on switcher change (selectedClientId flips)
//   - Cleared when the banner unmounts (admin returns to "all")
//
// Plan: 2026-04-28-admin-dashboard-redesign-plan.md (Phase 0.5)

const SS_PREFIX = 'admin-edit-mode:'

function readEditMode(targetId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(SS_PREFIX + targetId) === '1'
  } catch {
    return false
  }
}

function writeEditMode(targetId: string, on: boolean) {
  if (typeof window === 'undefined') return
  try {
    if (on) sessionStorage.setItem(SS_PREFIX + targetId, '1')
    else sessionStorage.removeItem(SS_PREFIX + targetId)
  } catch {
    // sessionStorage unavailable — the server-side guard still rejects writes
  }
}

// Cross-tab broadcast so other components can react to edit mode changes.
const EDIT_MODE_EVENT = 'admin:edit-mode-changed'

export function getAdminEditModeHeader(targetClientId: string | null): Record<string, string> {
  if (!targetClientId) return {}
  return readEditMode(targetClientId) ? { 'x-admin-edit-mode': '1' } : {}
}

export default function ActingAsBanner() {
  const { isAdmin, selectedClient, selectedClientId } = useAdminClient()
  const [editEnabled, setEditEnabled] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Hydrate edit-mode state from sessionStorage when the target changes.
  useEffect(() => {
    setMounted(true)
    if (!selectedClient) {
      setEditEnabled(false)
      return
    }
    setEditEnabled(readEditMode(selectedClient.id))
  }, [selectedClient])

  // Listen for cross-tab edit-mode events (multi-tab safety).
  useEffect(() => {
    function onChange(e: Event) {
      const detail = (e as CustomEvent<{ targetId: string; on: boolean }>).detail
      if (selectedClient && detail.targetId === selectedClient.id) {
        setEditEnabled(detail.on)
      }
    }
    window.addEventListener(EDIT_MODE_EVENT, onChange as EventListener)
    return () => window.removeEventListener(EDIT_MODE_EVENT, onChange as EventListener)
  }, [selectedClient])

  const toggle = useCallback(() => {
    if (!selectedClient) return
    const next = !editEnabled
    writeEditMode(selectedClient.id, next)
    setEditEnabled(next)
    window.dispatchEvent(
      new CustomEvent(EDIT_MODE_EVENT, { detail: { targetId: selectedClient.id, on: next } })
    )
  }, [editEnabled, selectedClient])

  // Visibility gates:
  //  - Feature flag must be on (otherwise we don't enforce the new edit gate)
  //  - Admin role required
  //  - Must have scoped into a specific client (selectedClientId !== 'all')
  if (!mounted) return null
  if (!isAdminRedesignEnabledClient()) return null
  if (!isAdmin) return null
  if (!selectedClient || selectedClientId === 'all') return null

  const label = `${selectedClient.business_name}${selectedClient.slug ? ` — ${selectedClient.slug}` : ''}`

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-acting-as-banner"
      className="w-full px-4 py-2 flex items-center justify-between gap-3 border-b"
      style={{
        backgroundColor: editEnabled ? 'rgba(220, 38, 38, 0.12)' : 'rgba(245, 158, 11, 0.12)',
        borderColor: editEnabled ? 'rgba(220, 38, 38, 0.3)' : 'rgba(245, 158, 11, 0.3)',
        color: editEnabled ? 'rgb(153, 27, 27)' : 'rgb(146, 64, 14)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span aria-hidden className="text-base leading-none">⚠</span>
        <span className="text-sm font-medium truncate">
          Acting as <span className="font-semibold">{label}</span>.{' '}
          {editEnabled
            ? 'Edits write to their account.'
            : 'View-only. Click "Enable edits" to make changes.'}
        </span>
      </div>
      <button
        type="button"
        onClick={toggle}
        className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border cursor-pointer transition-colors"
        style={{
          backgroundColor: editEnabled ? 'rgb(220, 38, 38)' : 'rgb(245, 158, 11)',
          borderColor: editEnabled ? 'rgb(185, 28, 28)' : 'rgb(217, 119, 6)',
          color: 'white',
        }}
      >
        {editEnabled ? 'Disable edits' : 'Enable edits'}
      </button>
    </div>
  )
}
