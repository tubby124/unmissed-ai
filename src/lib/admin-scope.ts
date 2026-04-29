'use client'

// Phase 1 — Shared scope primitive.
// Wraps AdminClientContext (Phase 0 plumbing) with two additions every Phase 3
// page will rely on:
//   1. localStorage persistence — admin lands on /dashboard with no ?client_id=
//      and gets back to the last client they were inspecting. URL stays
//      authoritative; localStorage is a "where did I leave off" hint only.
//   2. push-history setScope — back button restores the prior scope, which is
//      the documented Phase 1 UX requirement. AdminClientContext.setSelectedClientId
//      uses replace() (legacy behavior); we keep that path untouched and expose
//      our own setter here.
//
// Plan: 2026-04-28-admin-dashboard-redesign-plan.md (Phase 1)

import { useCallback, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAdminClient, type AdminClient } from '@/contexts/AdminClientContext'

const LS_KEY = 'admin-scope:last-client-id'

interface MinimalStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function getStorage(): MinimalStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readLastClientId(): string | null {
  const s = getStorage()
  if (!s) return null
  try {
    return s.getItem(LS_KEY)
  } catch {
    return null
  }
}

export function writeLastClientId(id: string | null): void {
  const s = getStorage()
  if (!s) return
  try {
    if (id && id !== 'all') s.setItem(LS_KEY, id)
    else s.removeItem(LS_KEY)
  } catch {
    // localStorage write blocked (private mode etc.) — non-fatal
  }
}

export interface ClientScope {
  /** True when the current user has admin role. */
  isAdmin: boolean
  /** 'all' or a client UUID — URL-canonical (?client_id=). */
  scopedClientId: string
  /** Resolved client object for the scoped ID, or null when 'all'. */
  scopedClient: AdminClient | null
  /** Full admin-visible client list. Empty for non-admin. */
  clients: AdminClient[]
  /**
   * Updates ?client_id= in URL (push-history so the back button restores prior
   * scope) and persists last-selected to localStorage. No-op for non-admin.
   */
  setScope: (id: string) => void
  /** Convenience: setScope('all'). */
  clearScope: () => void
  /**
   * Returns `client_id=<id>` (no leading '?') when scoped, else ''. Useful for
   * building admin-aware fetch URLs that match the existing target_client_id
   * convention on dashboard API routes.
   */
  scopeQueryString: () => string
}

export function useClientScope(): ClientScope {
  const { isAdmin, selectedClientId, selectedClient, clients } = useAdminClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Persist on every URL-confirmed scope change.
  useEffect(() => {
    if (!isAdmin) return
    writeLastClientId(selectedClientId === 'all' ? null : selectedClientId)
  }, [isAdmin, selectedClientId])

  const setScope = useCallback((id: string) => {
    if (!isAdmin) return
    const params = new URLSearchParams(searchParams.toString())
    if (id === 'all') {
      params.delete('client_id')
      params.delete('preview')
    } else {
      params.set('client_id', id)
    }
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [isAdmin, searchParams, router, pathname])

  const clearScope = useCallback(() => setScope('all'), [setScope])

  const scopeQueryString = useCallback((): string => {
    if (!isAdmin || selectedClientId === 'all') return ''
    return `client_id=${encodeURIComponent(selectedClientId)}`
  }, [isAdmin, selectedClientId])

  return {
    isAdmin,
    scopedClientId: selectedClientId,
    scopedClient: selectedClient,
    clients,
    setScope,
    clearScope,
    scopeQueryString,
  }
}
