'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordingConsentModal from './RecordingConsentModal'

interface Props {
  clientId: string
}

/**
 * Wave 1.5 — Client wrapper for RecordingConsentModal.
 * Renders the modal until acknowledgment is saved, then refreshes the route
 * so the server-rendered layout re-reads the (now non-null) timestamp.
 */
export default function RecordingConsentGate({ clientId }: Props) {
  const router = useRouter()
  const [acknowledged, setAcknowledged] = useState(false)

  if (acknowledged) return null

  return (
    <RecordingConsentModal
      clientId={clientId}
      onAcknowledged={() => {
        setAcknowledged(true)
        router.refresh()
      }}
    />
  )
}
