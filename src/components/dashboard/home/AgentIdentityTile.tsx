'use client'

/**
 * AgentIdentityTile — compact agent identity bento card.
 * Shows agent name + niche/style subtitle. Opens IdentitySheet on click.
 */

interface Props {
  agentName: string
  niche: string | null
  voiceStylePreset: string | null
  onOpenSheet: () => void
}

function nicheToLabel(niche: string | null): string | null {
  if (!niche) return null
  return niche.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function AgentIdentityTile({ agentName, niche, voiceStylePreset, onOpenSheet }: Props) {
  const nicheLabel = nicheToLabel(niche)
  const styleLabel = voiceStylePreset
    ? voiceStylePreset.charAt(0).toUpperCase() + voiceStylePreset.slice(1)
    : null
  const subtitle = [nicheLabel, styleLabel].filter(Boolean).join(' · ')

  return (
    <button
      onClick={onOpenSheet}
      className="rounded-2xl p-4 card-surface flex flex-col gap-3 text-left w-full hover:bg-hover transition-colors group"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">Agent</p>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="t3 opacity-0 group-hover:opacity-100 transition-opacity">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Name + subtitle */}
      <div>
        <p className="text-xl font-bold t1 leading-tight">{agentName}</p>
        {subtitle && (
          <p className="text-xs t3 mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Edit nudge */}
      <p className="text-[11px] t3 leading-relaxed">Tap to rename or change voice settings.</p>
    </button>
  )
}
