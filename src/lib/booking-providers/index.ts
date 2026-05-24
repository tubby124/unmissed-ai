/**
 * Booking provider dispatcher — single entry point used by the calendar tool routes.
 *
 * Phase 1A: scaffolding only. The actual `/api/calendar/[slug]/{slots,book}/route.ts`
 * routes still call `lib/google-calendar.ts` inline. Phase 1B will refactor those
 * routes to call `getBookingProvider(client).{listSlots,book}(...)`.
 *
 * Why a dispatcher (not direct imports)? Adding Vagaro/Acuity/Square should be a
 * one-file change — register a new adapter, no route changes, no Ultravox tool
 * changes, no prompt changes.
 */
import { googleProvider } from './google'
import { gettimelyProvider } from './gettimely'
import type { BookingProvider, BookingProviderClient, BookingProviderId } from './types'

const PROVIDERS: Record<BookingProviderId, BookingProvider> = {
  google: googleProvider,
  gettimely: gettimelyProvider,
}

const DEFAULT_PROVIDER: BookingProviderId = 'google'

export function getBookingProvider(client: Pick<BookingProviderClient, 'booking_provider'>): BookingProvider {
  const id = (client.booking_provider ?? DEFAULT_PROVIDER) as BookingProviderId
  return PROVIDERS[id] ?? PROVIDERS[DEFAULT_PROVIDER]
}

/**
 * Provider-agnostic "is this client connected to any booking system?" check.
 * Used by capability flags + admin Integrations panel.
 */
export function isBookingConnected(client: BookingProviderClient): boolean {
  return getBookingProvider(client).isConnected(client)
}

export function listProviders(): BookingProvider[] {
  return Object.values(PROVIDERS)
}

export type { BookingProvider, BookingProviderClient, BookingProviderId } from './types'
export { ProviderNotImplementedError } from './types'
