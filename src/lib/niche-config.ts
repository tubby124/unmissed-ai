/**
 * niche-config.ts — Dashboard-facing niche configuration.
 *
 * All data is now derived from NICHE_REGISTRY (single source of truth).
 * Add new niches in src/lib/niche-registry.ts — this file needs no edits.
 */

import { NICHE_REGISTRY, getNicheConfig as _getNicheConfig, getNicheVoice, getNicheMinuteLimit } from '@/lib/niche-registry'
import type { Niche } from '@/lib/niche-registry'

/**
 * Dashboard chip config map — { label, shortLabel, color, border, bg }.
 * Includes legacy hyphenated aliases (auto-glass, real-estate, etc.) for
 * backwards-compat with any DB rows that stored hyphenated niche slugs.
 * Source of truth for each entry is NICHE_REGISTRY.
 */
export const NICHE_CONFIG: Record<string, { label: string; color: string; border: string; bg: string }> = {
  // Canonical underscore keys — derived from registry
  ...Object.fromEntries(
    Object.entries(NICHE_REGISTRY).map(([k, v]) => [
      k,
      { label: v.label, color: v.color, border: v.border, bg: v.bg },
    ])
  ),
  // Legacy alias keys
  'auto-glass':          { label: 'Auto Glass',    color: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/10'  },
  'real-estate':         { label: 'Real Estate',   color: 'text-amber-400',  border: 'border-amber-500/30',  bg: 'bg-amber-500/10' },
  'property-management': { label: 'Property Mgmt', color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10'},
  'property_mgmt':       { label: 'Property Mgmt', color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10'},
  'auto':                { label: 'Automotive',    color: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/10'  },
  'isa':                 { label: 'ISA / RE',       color: 'text-amber-400',  border: 'border-amber-500/30',  bg: 'bg-amber-500/10' },
}

export function getNicheConfig(niche: string | null | undefined) {
  if (!niche) return null
  return NICHE_CONFIG[niche] ?? NICHE_CONFIG['other']
}

// Re-export voice getter — derived from registry
export { getNicheVoice }

// Re-export production-ready map — derived from registry
export { NICHE_PRODUCTION_READY } from '@/lib/niche-registry'

/** Canonical default minute limit for the base plan */
export const DEFAULT_MINUTE_LIMIT = 100

export { getNicheMinuteLimit }
