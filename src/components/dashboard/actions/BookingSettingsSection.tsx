'use client'

import type { ClientConfig } from '@/app/dashboard/settings/page'
import BookingCard from '@/components/dashboard/settings/BookingCard'

interface Props {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}

export default function BookingSettingsSection({ client, isAdmin, previewMode }: Props) {
  return (
    <BookingCard
      clientId={client.id}
      isAdmin={isAdmin}
      calendarAuthStatus={client.calendar_auth_status}
      googleCalendarId={client.google_calendar_id}
      initialDuration={client.booking_service_duration_minutes ?? 30}
      initialBuffer={client.booking_buffer_minutes ?? 0}
      initialBookingEnabled={client.booking_enabled ?? false}
      initialBookingProvider={(client.booking_provider as 'google' | 'gettimely' | null | undefined) ?? 'google'}
      previewMode={previewMode}
    />
  )
}
