'use client'

import { useState } from 'react'
import ContactsView from './ContactsView'

interface Props {
  clientId: string
  callLogSection: React.ReactNode
}

const TABS = [
  { id: 'log', label: 'Call Log' },
  { id: 'contacts', label: 'Contacts' },
] as const

type Tab = typeof TABS[number]['id']

export default function CallsPageTabs({ clientId, callLogSection }: Props) {
  const [tab, setTab] = useState<Tab>('log')

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-hover)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
            style={
              tab === t.id
                ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-1)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }
                : { color: 'var(--color-text-3)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'log' ? (
        callLogSection
      ) : (
        <ContactsView clientId={clientId} />
      )}
    </div>
  )
}
