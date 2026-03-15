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
  'other':               { label: 'Other',              color: 'text-zinc-400',   border: 'border-zinc-500/30',   bg: 'bg-zinc-500/10' },
}

/** Default Ultravox voice ID per niche — used as fallback when no explicit voice was chosen during onboarding */
export const NICHE_VOICE_MAP: Record<string, string> = {
  auto_glass:           'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark — confident, professional
  'auto-glass':         'b0e6b5c1-3100-44d5-8578-9015aa3023ae',
  property_mgmt:        'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', // Jacqueline — empathic, warm
  'property-management':'aa601962-1cbd-4bbd-9d96-3c7a93c3414a',
  real_estate:          'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', // Jacqueline
  'real-estate':        'aa601962-1cbd-4bbd-9d96-3c7a93c3414a',
  outbound_isa_realtor: 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a',
  print_shop:           'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark
  dental:               'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', // Jacqueline — warm for patients
  hvac:                 'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark
  plumbing:             'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark
  legal:                'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', // Jacqueline — professional
  voicemail:            'b9de4a89-7971-4ac8-aeea-d86fd8543a1a', // Emily — friendly
  other:                'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Mark — safe default
}

export function getNicheVoice(niche: string | null | undefined): string {
  if (!niche) return NICHE_VOICE_MAP.other
  return NICHE_VOICE_MAP[niche] ?? NICHE_VOICE_MAP.other
}

export function getNicheConfig(niche: string | null | undefined) {
  if (!niche) return null
  return NICHE_CONFIG[niche] ?? NICHE_CONFIG['other']
}
