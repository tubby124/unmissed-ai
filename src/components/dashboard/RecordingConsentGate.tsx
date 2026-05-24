'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordingConsentModal from './RecordingConsentModal'

interface Props {
  clientId: string
  isAdmin?: boolean
  /** If provided, the gate is considered "acknowledged" when this is non-null. */
  acknowledgedAt?: string | null
  /** Callback fired after acknowledgment is recorded. */
  onUpdated?: () => void
}

/**
 * Wave 1.5 — Client wrapper for RecordingConsentModal.
 * Renders the modal until acknowledgment is saved, then refreshes the route
 * so the server-rendered layout re-reads the (now non-null) timestamp.
 *
 * Supports two modes:
 * 1. Legacy mode (props: clientId only) — internal state + router.refresh()
 * 2. Controlled mode (props: acknowledgedAt + onUpdated) — parent-owned state
 */
export default function RecordingConsentGate({ clientId, isAdmin, acknowledgedAt, onUpdated }: Props) {
  const router = useRouter()
  const [acknowledged, setAcknowledged] = useState(false)

  // Controlled mode: parent tells us if already acknowledged
  if (acknowledgedAt !== undefined && acknowledgedAt !== null) return null

  // Legacy mode: internal state
  if (acknowledged) return null

  return (
    <RecordingConsentModal
      clientId={clientId}
      onAcknowledged={() => {
        setAcknowledged(true)
        if (onUpdated) {
          onUpdated()
        } else {
          router.refresh()
        }
      }}
    />
  )
}