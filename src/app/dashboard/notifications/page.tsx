'use client'

import { useEffect, useState } from 'react'

interface Notification {
  id: string
  call_id: string | null
  client_id: string | null
  channel: string
  recipient: string | null
  content: string | null
  status: string
  error: string | null
  external_id: string | null
  created_at: string
}

const CHANNELS = [
  { value: '', label: 'All' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: 'Email' },
  { value: 'sms_followup', label: 'SMS' },
  { value: 'system', label: 'System' },
]

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
]

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', '50')
    if (channel) params.set('channel', channel)
    if (status) params.set('status', status)

    fetch(`/api/dashboard/notifications?${params}`)
      .then(r => r.json())
      .then(d => {
        setNotifications(d.notifications || [])
        setTotal(d.total ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [channel, status])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-1)' }}>Notifications</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-3)' }}>
          Recent alerts sent by your AI agent — Telegram, email, and SMS.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-5 flex-wrap">
        <div className="flex gap-1">
          {CHANNELS.map(c => (
            <button
              key={c.value}
              onClick={() => setChannel(c.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                channel === c.value
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                  : 'border-transparent hover:bg-white/[0.04]'
              }`}
              style={channel !== c.value ? { color: 'var(--color-text-3)' } : undefined}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {STATUS_FILTERS.map(s => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                status === s.value
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                  : 'border-transparent hover:bg-white/[0.04]'
              }`}
              style={status !== s.value ? { color: 'var(--color-text-3)' } : undefined}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-center py-20" style={{ color: 'var(--color-text-3)' }}>Loading...</div>
      )}

      {!loading && notifications.length === 0 && (
        <div
          className="rounded-xl p-8 text-center border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <div className="text-4xl mb-4">🔔</div>
          <p className="font-medium mb-1" style={{ color: 'var(--color-text-1)' }}>No notifications yet</p>
          <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>
            When your AI agent sends alerts, they appear here.
          </p>
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <div
          className="rounded-xl overflow-hidden border divide-y"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {notifications.map(n => (
            <div
              key={n.id}
              className="flex items-start gap-4 px-4 py-4"
              style={{ backgroundColor: 'var(--color-surface)' }}
            >
              {/* Channel icon */}
              <div
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
              >
                {n.channel === 'telegram' ? '📨' : n.channel === 'email' ? '📧' : n.channel === 'sms_followup' ? '💬' : '⚙️'}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-2)' }}>
                    {n.channel === 'sms_followup' ? 'SMS' : n.channel}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                      n.status === 'failed'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-green-500/10 text-green-400 border border-green-500/20'
                    }`}
                  >
                    {n.status}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
                    {new Date(n.created_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                {n.recipient && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-3)' }}>{n.recipient}</p>
                )}
                {n.content && (
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-2)' }}>{n.content}</p>
                )}
                {n.error && (
                  <p className="text-xs mt-1 text-red-400 truncate">{n.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && total > 0 && (
        <p className="text-xs mt-3 text-center" style={{ color: 'var(--color-text-3)' }}>
          Showing {notifications.length} of {total}
        </p>
      )}
    </div>
  )
}
