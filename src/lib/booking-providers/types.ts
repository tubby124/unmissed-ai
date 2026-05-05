/**
 * Booking provider abstraction — Phase 1A scaffolding.
 *
 * Single shape that every external booking system (Google Calendar, Gettimely,
 * Vagaro, Acuity, Square Appointments, Booksy) must implement. The Ultravox
 * tools `checkCalendarAvailability` and `bookAppointment` always hit the same
 * URLs (`/api/calendar/[slug]/slots`, `/api/calendar/[slug]/book`). Those route
 * handlers read `clients.booking_provider` and dispatch to the matching adapter.
 *
 * Phase 1A: only Google adapter is real (wraps existing lib/google-calendar.ts).
 * Gettimely adapter throws `provider_not_implemented` until Phase 1B fills it in.
 */

export type BookingProviderId = 'google' | 'gettimely'

export interface BookingProviderClient {
  id: string
  slug: string
  booking_provider: BookingProviderId | null
  // Provider-agnostic config
  booking_service_duration_minutes: number | null
  booking_buffer_minutes: number | null
  timezone: string | null
  // Google-specific
  google_refresh_token: string | null
  google_calendar_id: string | null
  // Gettimely-specific
  gettimely_account_id: string | null
  gettimely_refresh_token: string | null
  gettimely_staff_id: string | null
  gettimely_service_map: Record<string, string | number> | null
}

export interface AvailabilitySlot {
  /** ISO 8601 start time (provider-native). Used for booking. */
  start: string
  /** ISO 8601 end time. Providers that don't return end can synthesize from duration. */
  end: string
  /** Human-readable time the agent reads back to caller — e.g. "9:00 AM". */
  displayTime: string
}

export interface ListSlotsArgs {
  date: string // YYYY-MM-DD
  preferredTime?: string // HH:MM 24h
  durationMinutes?: number
  maxSlots?: number
}

export interface BookArgs {
  date: string
  time: string // matches the displayTime returned by listSlots
  service?: string
  callerName: string
  callerPhone: string
}

export interface BookResult {
  booked: boolean
  reason?: 'slot_taken' | 'fallback' | 'auth_expired' | 'provider_not_implemented' | 'provider_error'
  nextAvailable?: string // displayTime of next free slot when slot_taken
  /** Provider-native confirmation/reference ID, surfaced in SMS confirmation. */
  externalId?: string
  /** Optional reschedule URL — provider deep link sent to the caller via SMS. */
  rescheduleUrl?: string
}

export interface BookingProvider {
  id: BookingProviderId
  /** True when the client has valid auth for this provider. */
  isConnected(client: BookingProviderClient): boolean
  /** Returns slots near `preferredTime`, sorted by proximity. */
  listSlots(client: BookingProviderClient, args: ListSlotsArgs): Promise<AvailabilitySlot[]>
  /** Creates the booking. Re-checks availability before writing. */
  book(client: BookingProviderClient, args: BookArgs): Promise<BookResult>
}

export class ProviderNotImplementedError extends Error {
  readonly providerId: BookingProviderId
  constructor(providerId: BookingProviderId) {
    super(`Booking provider '${providerId}' is not implemented yet`)
    this.name = 'ProviderNotImplementedError'
    this.providerId = providerId
  }
}
