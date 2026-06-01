/**
 * StatsRibbon — top-of-page summary of notification activity in the current
 * window, broken down by channel. Pure server component (no state).
 */

export interface StatsByChannel {
  email:    ChannelStats
  telegram: ChannelStats
  sms:      ChannelStats
  system:   ChannelStats
}

interface ChannelStats {
  total: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  failed: number
  bounced: number
  complained: number
  other: number
}

function channelColor(channel: string): string {
  switch (channel) {
    case 'email':    return 'rgb(129,140,248)'
    case 'telegram': return 'rgb(56,189,248)'
    case 'sms':      return 'rgb(74,222,128)'
    default:         return 'rgb(148,163,184)'
  }
}

function ChannelTile({ name, stats }: { name: keyof StatsByChannel; stats: ChannelStats }) {
  const color = channelColor(name)
  const successCount = stats.delivered + stats.opened + stats.clicked + (name === 'telegram' || name === 'sms' ? stats.sent : 0)
  const failCount = stats.failed + stats.bounced + stats.complained
  const pendingCount = name === 'email' ? stats.sent : 0 // email "sent" but not yet "delivered"

  return (
    <div
      className="rounded-xl p-3 flex-1 min-w-[160px]"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="text-[10px] uppercase tracking-wider font-medium"
          style={{ color }}
        >
          {name}
        </span>
        <span className="text-[20px] font-bold tabular-nums" style={{ color: 'var(--color-text-1)' }}>
          {stats.total}
        </span>
      </div>
      <div className="flex gap-3 mt-1.5 text-[11px] tabular-nums">
        {successCount > 0 && (
          <span style={{ color: 'rgb(74,222,128)' }} title="delivered + opened + clicked">
            ✓ {successCount}
          </span>
        )}
        {pendingCount > 0 && (
          <span style={{ color: 'var(--color-text-3)' }} title="sent — awaiting delivery confirmation from Resend">
            ⋯ {pendingCount}
          </span>
        )}
        {failCount > 0 && (
          <span style={{ color: 'rgb(248,113,113)' }} title="failed + bounced + complained">
            ✕ {failCount}
          </span>
        )}
        {stats.total === 0 && (
          <span style={{ color: 'var(--color-text-3)' }}>—</span>
        )}
      </div>
    </div>
  )
}

export default function StatsRibbon({
  stats,
  window,
}: {
  stats: StatsByChannel
  window: string
}) {
  const grandTotal = stats.email.total + stats.telegram.total + stats.sms.total + stats.system.total
  const grandFail = ['email', 'telegram', 'sms', 'system']
    .map(k => stats[k as keyof StatsByChannel])
    .reduce((acc, s) => acc + s.failed + s.bounced + s.complained, 0)

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>
          Window: {window}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
          {grandTotal} total · {grandFail} failures
        </span>
      </div>
      <div className="flex gap-3 flex-wrap">
        <ChannelTile name="email" stats={stats.email} />
        <ChannelTile name="telegram" stats={stats.telegram} />
        <ChannelTile name="sms" stats={stats.sms} />
        <ChannelTile name="system" stats={stats.system} />
      </div>
    </div>
  )
}
