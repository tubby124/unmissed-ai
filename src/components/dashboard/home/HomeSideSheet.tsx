'use client'

/**
 * HomeSideSheet — slide-in drawer host for all 6 home sheet types.
 * Renders a right-side drawer overlay; the inner sheet content swaps
 * based on the openSheet ID passed in.
 */

import type { SheetId } from '@/hooks/useHomeSheet'
import IdentitySheet from './sheets/IdentitySheet'
import KnowledgeSheet from './sheets/KnowledgeSheet'
import HoursSheet from './sheets/HoursSheet'
import ForwardingSheet from './sheets/ForwardingSheet'
import NotificationsSheet from './sheets/NotificationsSheet'
import BillingSheet from './sheets/BillingSheet'

interface EditableFields {
  hoursWeekday: string | null
  hoursWeekend: string | null
  faqs: { q: string; a: string }[]
  forwardingNumber: string | null
  websiteUrl: string | null
  businessFacts: string | null
}

interface Props {
  openSheet: SheetId
  onClose: () => void
  markDirty: () => void
  markClean: () => void
  clientId: string | null
  isAdmin: boolean
  agentName: string
  editableFields: EditableFields
  websiteScrapeStatus: string | null
  knowledge: {
    approved_chunk_count: number
    pending_review_count: number
    source_types: string[]
  }
  selectedPlan: string | null
  subscriptionStatus: string | null
  telegramConnected: boolean
  onDataRefresh: () => void
}

const TITLES: Record<NonNullable<SheetId>, string> = {
  identity: 'Agent Identity',
  knowledge: 'Knowledge Base',
  hours: 'Business Hours',
  forwarding: 'Call Transfer',
  notifications: 'Notifications',
  billing: 'Plan & Billing',
}

export default function HomeSideSheet({
  openSheet,
  onClose,
  markDirty,
  markClean,
  clientId,
  isAdmin,
  agentName,
  editableFields,
  websiteScrapeStatus,
  knowledge,
  selectedPlan,
  subscriptionStatus,
  telegramConnected,
  onDataRefresh,
}: Props) {
  const isOpen = openSheet !== null

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] flex flex-col shadow-2xl transition-transform duration-300 ease-out"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderLeft: '1px solid var(--color-border)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
        role="dialog"
        aria-label={openSheet ? TITLES[openSheet] : undefined}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h2 className="text-sm font-semibold t1">
            {openSheet ? TITLES[openSheet] : ''}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-hover transition-colors"
            style={{ color: 'var(--color-text-3)' }}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {openSheet === 'identity' && clientId && (
            <IdentitySheet
              clientId={clientId}
              isAdmin={isAdmin}
              agentName={agentName}
              markDirty={markDirty}
              markClean={markClean}
              onSave={onDataRefresh}
            />
          )}
          {openSheet === 'knowledge' && clientId && (
            <KnowledgeSheet
              clientId={clientId}
              isAdmin={isAdmin}
              editableFields={editableFields}
              websiteScrapeStatus={websiteScrapeStatus}
              knowledge={knowledge}
              markDirty={markDirty}
              markClean={markClean}
              onSave={onDataRefresh}
            />
          )}
          {openSheet === 'hours' && clientId && (
            <HoursSheet
              clientId={clientId}
              isAdmin={isAdmin}
              initialWeekday={editableFields.hoursWeekday ?? ''}
              initialWeekend={editableFields.hoursWeekend ?? ''}
              markDirty={markDirty}
              markClean={markClean}
              onSave={onDataRefresh}
            />
          )}
          {openSheet === 'forwarding' && clientId && (
            <ForwardingSheet
              clientId={clientId}
              isAdmin={isAdmin}
              initialForwardingNumber={editableFields.forwardingNumber ?? ''}
              markDirty={markDirty}
              markClean={markClean}
              onSave={onDataRefresh}
            />
          )}
          {openSheet === 'notifications' && clientId && (
            <NotificationsSheet
              clientId={clientId}
              isAdmin={isAdmin}
              telegramConnected={telegramConnected}
              markDirty={markDirty}
              markClean={markClean}
              onSave={onDataRefresh}
            />
          )}
          {openSheet === 'billing' && clientId && (
            <BillingSheet
              clientId={clientId}
              selectedPlan={selectedPlan}
              subscriptionStatus={subscriptionStatus}
            />
          )}
        </div>
      </div>
    </>
  )
}
