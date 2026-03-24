'use client'

import { useState } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import SmsTab from '@/components/dashboard/settings/SmsTab'

interface Props {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}

export default function MessagingSettingsSection({ client, isAdmin, previewMode }: Props) {
  const [smsEnabled, setSmsEnabled] = useState(client.sms_enabled ?? false)
  const [smsTemplate, setSmsTemplate] = useState(client.sms_template ?? '')

  return (
    <SmsTab
      client={client}
      isAdmin={isAdmin}
      previewMode={previewMode}
      smsEnabled={smsEnabled}
      setSmsEnabled={setSmsEnabled}
      smsTemplate={smsTemplate}
      setSmsTemplate={setSmsTemplate}
    />
  )
}
