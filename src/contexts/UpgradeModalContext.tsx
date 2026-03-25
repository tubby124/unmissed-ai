'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { trackEvent } from '@/lib/analytics'

interface UpgradeModalState {
  isOpen: boolean
  source: string
  clientId: string | null
  daysRemaining: number | undefined
}

interface UpgradeModalContextValue extends UpgradeModalState {
  openUpgradeModal: (source: string, clientId?: string | null, daysRemaining?: number) => void
  closeUpgradeModal: () => void
}

const UpgradeModalContext = createContext<UpgradeModalContextValue | null>(null)

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UpgradeModalState>({
    isOpen: false,
    source: '',
    clientId: null,
    daysRemaining: undefined,
  })

  function openUpgradeModal(source: string, clientId?: string | null, daysRemaining?: number) {
    trackEvent('upgrade_modal_opened', { source })
    setState({ isOpen: true, source, clientId: clientId ?? null, daysRemaining })
  }

  function closeUpgradeModal() {
    setState(s => ({ ...s, isOpen: false }))
  }

  return (
    <UpgradeModalContext.Provider value={{ ...state, openUpgradeModal, closeUpgradeModal }}>
      {children}
    </UpgradeModalContext.Provider>
  )
}

export function useUpgradeModal() {
  const ctx = useContext(UpgradeModalContext)
  if (!ctx) throw new Error('useUpgradeModal must be used within UpgradeModalProvider')
  return ctx
}
