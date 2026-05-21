/**
 * StatusBadge — colored severity/status badge for harness findings.
 *
 * Why centralized: P0/P1/P2/PASS color mapping appears in HarnessCard,
 * FindingRow, and FilterStrip. One source keeps the dashboard self-consistent.
 */

type Variant = 'P0' | 'P1' | 'P2' | 'PASS' | 'open' | 'resolved' | 'suppressed'

interface StatusBadgeProps {
  variant: Variant
  count?: number
  label?: string
}

function styleFor(variant: Variant): { bg: string; color: string; border: string } {
  switch (variant) {
    case 'P0':
      return { bg: 'rgba(239,68,68,0.12)', color: 'rgb(248,113,113)', border: 'rgba(239,68,68,0.3)' }
    case 'P1':
      return { bg: 'rgba(245,158,11,0.12)', color: 'rgb(251,191,36)', border: 'rgba(245,158,11,0.3)' }
    case 'P2':
      return { bg: 'rgba(59,130,246,0.12)', color: 'rgb(96,165,250)', border: 'rgba(59,130,246,0.3)' }
    case 'PASS':
      return { bg: 'rgba(34,197,94,0.12)', color: 'rgb(74,222,128)', border: 'rgba(34,197,94,0.3)' }
    case 'open':
      return { bg: 'rgba(239,68,68,0.10)', color: 'rgb(248,113,113)', border: 'rgba(239,68,68,0.25)' }
    case 'resolved':
      return { bg: 'rgba(34,197,94,0.10)', color: 'rgb(74,222,128)', border: 'rgba(34,197,94,0.25)' }
    case 'suppressed':
      return { bg: 'rgba(148,163,184,0.10)', color: 'rgb(148,163,184)', border: 'rgba(148,163,184,0.25)' }
  }
}

export default function StatusBadge({ variant, count, label }: StatusBadgeProps) {
  const s = styleFor(variant)
  const text = label ?? variant
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {text}
      {typeof count === 'number' && <span className="font-mono">{count}</span>}
    </span>
  )
}
