'use client'

import { useState } from 'react'
import OutboundConfigCard from './OutboundConfigCard'

interface Props {
  initialOutboundPrompt: string | null
  hasPhoneNumber: boolean
}

export default function OutboundConfigWrapper({ initialOutboundPrompt, hasPhoneNumber }: Props) {
  const [outboundPrompt, setOutboundPrompt] = useState(initialOutboundPrompt)
  return (
    <OutboundConfigCard
      outboundPrompt={outboundPrompt}
      hasPhoneNumber={hasPhoneNumber}
      onSaved={setOutboundPrompt}
    />
  )
}
