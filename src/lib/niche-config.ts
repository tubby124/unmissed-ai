import { Niche } from '@/types/onboarding'

export const NICHE_CONFIG: Record<string, { label: string; color: string; border: string; bg: string }> = {
  'auto-glass':          { label: 'Auto Glass',        color: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/10' },
  'auto_glass':          { label: 'Auto Glass',        color: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/10' },
  'auto':                { label: 'Automotive',         color: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/10' },
  'real-estate':         { label: 'Real Estate',        color: 'text-amber-400',  border: 'border-amber-500/30',  bg: 'bg-amber-500/10' },
  'real_estate':         { label: 'Real Estate',        color: 'text-amber-400',  border: 'border-amber-500/30',  bg: 'bg-amber-500/10' },
  'outbound_isa_realtor': { label: 'ISA / Real Estate', color: 'text-amber-400',  border: 'border-amber-500/30',  bg: 'bg-amber-500/10' },
  'isa':                 { label: 'ISA / Real Estate',  color: 'text-amber-400',  border: 'border-amber-500/30',  bg: 'bg-amber-500/10' },
  'property-management': { label: 'Property Mgmt',     color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  'property_mgmt':       { label: 'Property Mgmt',     color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  'dental':              { label: 'Dental',             color: 'text-teal-400',   border: 'border-teal-500/30',   bg: 'bg-teal-500/10' },
  'hvac':                { label: 'HVAC',               color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
  'plumbing':            { label: 'Plumbing',           color: 'text-cyan-400',   border: 'border-cyan-500/30',   bg: 'bg-cyan-500/10' },
  'legal':               { label: 'Legal',              color: 'text-rose-400',   border: 'border-rose-500/30',   bg: 'bg-rose-500/10' },
  'print_shop':          { label: 'Print Shop',         color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10' },
  'voicemail':           { label: 'Voicemail',          color: 'text-zinc-400',   border: 'border-zinc-500/30',   bg: 'bg-zinc-500/10' },
  'mechanic_shop':       { label: 'Auto Repair',        color: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/10' },
  'pest_control':        { label: 'Pest Control',       color: 'text-lime-400',   border: 'border-lime-500/30',   bg: 'bg-lime-500/10' },
  'electrician':         { label: 'Electrician',        color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
  'locksmith':           { label: 'Locksmith',          color: 'text-slate-400',  border: 'border-slate-500/30',  bg: 'bg-slate-500/10' },
  'barbershop':          { label: 'Barbershop',         color: 'text-green-400',  border: 'border-green-500/30',  bg: 'bg-green-500/10' },
  'other':               { label: 'Other',              color: 'text-zinc-400',   border: 'border-zinc-500/30',   bg: 'bg-zinc-500/10' },
}

/** Default Ultravox voice ID per niche — used as fallback when no explicit voice was chosen during onboarding */
export const NICHE_VOICE_MAP: Record<string, string> = {
  auto_glass:           'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark — confident, professional
  'auto-glass':         'b0e6b5c1-3100-44d5-8578-9015aa3023ae',
  property_mgmt:        'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', // Jacqueline — empathic, warm
  'property-management':'aa601962-1cbd-4bbd-9d96-3c7a93c3414a',
  property_management:  'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', // Jacqueline — fix key mismatch (was property_mgmt)
  salon:                'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', // Jacqueline — warm for beauty/wellness
  restaurant:           'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', // Jacqueline — warm for hospitality
  real_estate:          'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', // Jacqueline
  'real-estate':        'aa601962-1cbd-4bbd-9d96-3c7a93c3414a',
  outbound_isa_realtor: 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a',
  print_shop:           'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark
  dental:               'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', // Jacqueline — warm for patients
  hvac:                 'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark
  plumbing:             'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark
  legal:                'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', // Jacqueline — professional
  voicemail:            '87edb04c-06d4-47c2-bd94-683bc47e8fbe', // Monika — warm, natural (upgraded from Emily)
  mechanic_shop:        'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark — confident, direct
  pest_control:         'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark — practical, calm
  electrician:          'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark — direct, reassuring
  locksmith:            'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark — fast, direct (lockouts = speed)
  barbershop:           'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark — confident, energetic
  other:                'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark — safe default
}

export const NICHE_PRODUCTION_READY: Record<Niche, boolean> = {
  auto_glass:           true,
  hvac:                 true,
  plumbing:             true,
  dental:               true,
  legal:                true,
  salon:                true,
  real_estate:          true,
  property_management:  true,
  outbound_isa_realtor: false,  // admin-only — hidden from self-serve
  restaurant:           true,
  voicemail:            true,
  print_shop:           true,
  mechanic_shop:        true,
  pest_control:         true,
  electrician:          true,
  locksmith:            true,
  barbershop:           true,
  other:                true,
}

export function getNicheVoice(niche: string | null | undefined): string {
  if (!niche) return NICHE_VOICE_MAP.other
  return NICHE_VOICE_MAP[niche] ?? NICHE_VOICE_MAP.other
}

export function getNicheConfig(niche: string | null | undefined) {
  if (!niche) return null
  return NICHE_CONFIG[niche] ?? NICHE_CONFIG['other']
}

/** Canonical default minute limit for the base plan — single source of truth */
export const DEFAULT_MINUTE_LIMIT = 100

/** Monthly minute limits per niche — voicemail is lower tier */
export const NICHE_MINUTE_LIMITS: Record<string, number> = {
  voicemail: 50,
}

export function getNicheMinuteLimit(niche: string | null | undefined): number {
  if (!niche) return DEFAULT_MINUTE_LIMIT
  return NICHE_MINUTE_LIMITS[niche] ?? DEFAULT_MINUTE_LIMIT
}
