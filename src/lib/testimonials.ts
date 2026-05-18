/**
 * Real testimonials for End Voicemail.
 *
 * Rule: ONLY add real quotes from real paying customers with their written permission.
 * Never fabricate. Empty list is honest; fake testimonials are not.
 *
 * To add: copy a Testimonial object, paste it into the array, run `npm run build`.
 * Photo: drop into public/testimonials/{slug}.jpg (300x300px square, 80% JPEG quality).
 *
 * If TESTIMONIALS is empty (length 0), the ReviewBadges component renders nothing —
 * no fake social proof, no pressure. Add one when you have one.
 */

export interface Testimonial {
  /** stable slug for photo filename + key */
  slug: string
  /** customer first name + last initial */
  name: string
  /** business or role line */
  business: string
  /** city for trust */
  city?: string
  /** 1-3 sentence pull quote */
  quote: string
  /** which niche they're in */
  niche: 'real_estate' | 'auto_glass' | 'property_management' | 'plumbing' | 'hvac' | 'dental' | 'legal' | 'salon' | 'restaurant' | 'voicemail' | 'other'
  /** ship-able specific metric, optional */
  metric?: string
  /** path under public/, optional — falls back to initials */
  photoPath?: string
  /** date collected (ISO) */
  collectedAt: string
}

export const TESTIMONIALS: Testimonial[] = [
  // Empty until 4 paying clients submit quotes with permission.
  // Hasan: collect via SMS — "Mind if I quote you for the site? 1-2 sentences on what you'd say to another business owner."
  // Then add an object here.
]

export const hasTestimonials = (): boolean => TESTIMONIALS.length > 0
