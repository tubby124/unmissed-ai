/**
 * service-catalog.ts
 *
 * Shared types and pure helpers for the structured service catalog.
 * No DB imports, no fetch — pure data transformations.
 *
 * Used by:
 *   - prompt-builder.ts (format for SERVICES_OFFERED variable)
 *   - agent-mode-rebuild.ts (convert DB rows → intake shape)
 *   - ServiceCatalogCard.tsx (legacy Settings card)
 *   - ServiceCatalogEditor.tsx (full Actions page editor)
 *   - API routes under /api/dashboard/services/
 */

// ── Row shape (matches client_services table) ─────────────────────────────────

export interface ClientService {
  id: string
  client_id: string
  name: string
  description: string
  category: string
  duration_mins: number | null
  price: string
  booking_notes: string
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// ── Write input (create / update) ─────────────────────────────────────────────

export interface ClientServiceWrite {
  name: string
  description?: string
  category?: string
  duration_mins?: number | null
  price?: string
  booking_notes?: string
  active?: boolean
  sort_order?: number
}

// ── AI Analyze draft (not yet persisted) ─────────────────────────────────────

export interface ServiceDraft {
  name: string
  description?: string
  category?: string
  duration_mins?: number | null
  price?: string
  booking_notes?: string
}

// ── Prompt-builder wire format (injected as intakeData.service_catalog) ───────
//
// This is the shape that buildPromptFromIntake() reads via parseServiceCatalog().
// Field names mirror the legacy JSONB schema so the prompt-builder requires no
// separate migration — the agent-mode-rebuild maps ClientService → this shape.

export interface ServiceCatalogItem {
  name: string
  duration_mins?: number
  price?: string
  description?: string
  category?: string
  booking_notes?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a raw value from intake data into a typed ServiceCatalogItem[].
 * Handles both legacy JSONB shape and richer v2 shape.
 * Returns [] for any non-array or malformed input (never throws).
 */
export function parseServiceCatalog(raw: unknown): ServiceCatalogItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (s): s is ServiceCatalogItem =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as ServiceCatalogItem).name === 'string' &&
      (s as ServiceCatalogItem).name.trim() !== '',
  )
}

/**
 * Format a catalog as a compact human-readable string for the SERVICES_OFFERED
 * prompt variable (e.g. "Haircut (30 min · $35), Beard Trim (20 min · $20)").
 */
export function formatServiceCatalog(catalog: ServiceCatalogItem[]): string {
  return catalog
    .filter(s => s.name.trim())
    .map(s => {
      let label = s.name.trim()
      const meta: string[] = []
      if (s.duration_mins && s.duration_mins > 0) meta.push(`${s.duration_mins} min`)
      if (s.price?.trim()) meta.push(s.price.trim())
      if (meta.length > 0) label += ` (${meta.join(' · ')})`
      if (s.description?.trim()) label += ` — ${s.description.trim()}`
      return label
    })
    .join(', ')
}

/**
 * Build a booking-notes block for injection into the TRIAGE section when any
 * active service has booking_notes set.
 * Returns '' when no notes exist.
 */
export function buildBookingNotesBlock(catalog: ServiceCatalogItem[]): string {
  const entries = catalog.filter(s => s.booking_notes?.trim())
  if (entries.length === 0) return ''
  const lines = entries.map(s => `- ${s.name}: ${s.booking_notes!.trim()}`)
  return `SERVICE NOTES (know before booking, do not quote verbatim):\n${lines.join('\n')}`
}

/**
 * Convert active client_services DB rows → ServiceCatalogItem[] for intake injection.
 * Caller should pass rows already filtered to active=true and sorted by sort_order.
 */
export function rowsToCatalogItems(rows: Pick<ClientService, 'name' | 'duration_mins' | 'price' | 'description' | 'category' | 'booking_notes'>[]): ServiceCatalogItem[] {
  return rows.map(r => ({
    name: r.name,
    ...(r.duration_mins != null ? { duration_mins: r.duration_mins } : {}),
    ...(r.price.trim() ? { price: r.price } : {}),
    ...(r.description.trim() ? { description: r.description } : {}),
    ...(r.category.trim() ? { category: r.category } : {}),
    ...(r.booking_notes.trim() ? { booking_notes: r.booking_notes } : {}),
  }))
}

/**
 * Validate a write payload for create/update.
 * Returns an error string or null if valid.
 */
export function validateServiceWrite(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return 'Body must be an object'
  const b = body as Record<string, unknown>
  if (typeof b.name !== 'string' || !b.name.trim()) return 'name is required'
  if (b.name.length > 200) return 'name must be ≤ 200 characters'
  if (b.duration_mins !== undefined && b.duration_mins !== null) {
    const d = Number(b.duration_mins)
    if (!Number.isInteger(d) || d <= 0 || d > 480) return 'duration_mins must be a positive integer ≤ 480'
  }
  if (typeof b.price === 'string' && b.price.length > 100) return 'price must be ≤ 100 characters'
  if (typeof b.description === 'string' && b.description.length > 500) return 'description must be ≤ 500 characters'
  if (typeof b.category === 'string' && b.category.length > 100) return 'category must be ≤ 100 characters'
  if (typeof b.booking_notes === 'string' && b.booking_notes.length > 500) return 'booking_notes must be ≤ 500 characters'
  return null
}
