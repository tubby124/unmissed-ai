/**
 * Gettimely booking provider — Phase 1A stub.
 *
 * Phase 1A: every method throws ProviderNotImplementedError so the route
 * dispatcher returns a graceful `provider_not_implemented` reason and the
 * agent falls back to message-taking mode (matches existing CALENDAR FALLBACK
 * branch in the barbershop niche template).
 *
 * Phase 1B will implement against the Gettimely REST API:
 *   - OAuth: https://api.gettimely.com/oauth/{authorize,token}
 *   - Availability: GET /v1/booking/staff/{staffId}/times
 *   - Create booking: POST /v1/booking/bookings
 *   - Refresh access token: POST /oauth/token grant_type=refresh_token
 */
import { ProviderNotImplementedError, type BookingProvider } from './types'

export const gettimelyProvider: BookingProvider = {
  id: 'gettimely',

  isConnected(client) {
    // Truthful even in stub form — OAuth callback writes both fields when real
    return Boolean(client.gettimely_refresh_token && client.gettimely_staff_id)
  },

  async listSlots() {
    throw new ProviderNotImplementedError('gettimely')
  },

  async book() {
    return {
      booked: false,
      reason: 'provider_not_implemented',
    }
  },
}
