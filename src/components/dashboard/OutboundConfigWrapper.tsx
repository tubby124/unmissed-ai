'use client'

import { useState } from 'react'
import OutboundAgentConfigCard from './OutboundAgentConfigCard'
import type { OutboundTone } from '@/lib/outbound-prompt-builder'

interface Props {
  clientId: string
  isAdmin?: boolean
  initialOutboundPrompt: string | null
  initialOutboundGoal: string | null
  initialOutboundOpening: string | null
  initialOutboundVmScript: string | null
  initialOutboundTone: OutboundTone
  hasPhoneNumber: boolean
}

export default function OutboundConfigWrapper({
  clientId,
  isAdmin = false,
  initialOutboundPrompt,
  initialOutboundGoal,
  initialOutboundOpening,
  initialOutboundVmScript,
  initialOutboundTone,
  hasPhoneNumber,
}: Props) {
  const [outboundPrompt, setOutboundPrompt] = useState(initialOutboundPrompt)
  return (
    <OutboundAgentConfigCard
      clientId={clientId}
      isAdmin={isAdmin}
      hasPhoneNumber={hasPhoneNumber}
      initialOutboundPrompt={outboundPrompt}
      initialGoal={initialOutboundGoal}
      initialOpening={initialOutboundOpening}
      initialVmScript={initialOutboundVmScript}
      initialTone={initialOutboundTone}
      onSaved={setOutboundPrompt}
    />
  )
}
