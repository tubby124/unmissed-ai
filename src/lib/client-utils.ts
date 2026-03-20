// ── Client classification utilities ─────────────────────────────────────────
// Single source of truth — replaces scattered isTestClient() copies in
// ClientsTable, CampaignGrid, CampaignCard, etc.

export const PROTECTED_SLUGS = ['hasan-sharif', 'windshield-hub', 'urban-vibe', 'manzil-isa'] as const

export type ClientSetupState = 'active' | 'setup_incomplete' | 'unassigned_number' | 'test'

interface ClientLike {
  slug: string
  status?: string | null
  twilio_number?: string | null
}

export function getClientSetupState(client: ClientLike): ClientSetupState {
  if (client.slug.startsWith('e2e-test-') || client.slug.startsWith('test-')) return 'test'
  if (client.status === 'setup') return 'setup_incomplete'
  if (!client.twilio_number) return 'unassigned_number'
  return 'active'
}

export function isTestClient(client: { slug: string; status?: string | null }): boolean {
  if ((PROTECTED_SLUGS as readonly string[]).includes(client.slug)) return false
  if (client.slug.startsWith('e2e-test-') || client.slug.startsWith('test-')) return true
  if (client.status === 'setup') return true
  return false
}
