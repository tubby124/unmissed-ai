'use client'

import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

export interface AdminClient {
  id: string
  slug: string
  business_name: string
  niche: string | null
  status: string | null
  twilio_number: string | null
}

interface AdminClientContextValue {
  /** 'all' or a client UUID */
  selectedClientId: string
  /** The full client object for the selected ID, or null if 'all' */
  selectedClient: AdminClient | null
  /** All clients available for admin selection */
  clients: AdminClient[]
  /** Updates URL ?client_id= param (no-op for non-admin) */
  setSelectedClientId: (id: string) => void
  isAdmin: boolean
  /** True when admin is viewing dashboard as a specific client (read-only) */
  previewMode: boolean
  /** Exits preview mode — removes preview param, keeps client_id */
  exitPreview: () => void
}

const AdminClientContext = createContext<AdminClientContextValue>({
  selectedClientId: 'all',
  selectedClient: null,
  clients: [],
  setSelectedClientId: () => {},
  isAdmin: false,
  previewMode: false,
  exitPreview: () => {},
})

export function useAdminClient() {
  return useContext(AdminClientContext)
}

export function AdminClientProvider({
  children,
  isAdmin,
  clients = [],
}: {
  children: ReactNode
  isAdmin: boolean
  clients?: AdminClient[]
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const selectedClientId = (isAdmin ? searchParams.get('client_id') : null) ?? 'all'
  const previewMode = isAdmin && searchParams.get('preview') === 'true' && selectedClientId !== 'all'
  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  )

  const setSelectedClientId = useCallback((id: string) => {
    if (!isAdmin) return
    const params = new URLSearchParams(searchParams.toString())
    if (id === 'all') {
      params.delete('client_id')
      params.delete('preview')
    } else {
      params.set('client_id', id)
    }
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [searchParams, router, pathname, isAdmin])

  const exitPreview = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('preview')
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [searchParams, router, pathname])

  return (
    <AdminClientContext.Provider value={{ selectedClientId, selectedClient, clients, setSelectedClientId, isAdmin, previewMode, exitPreview }}>
      {children}
    </AdminClientContext.Provider>
  )
}
