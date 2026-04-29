'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { createBrowserClient } from '@/lib/supabase/client'
import NoNotifications from '@/components/dashboard/empty-states/NoNotifications'
import NotificationsConfigSection from './NotificationsConfigSection'
import { useClientScope } from '@/lib/admin-scope'
import { isAdminRedesignEnabledClient } from '@/lib/feature-flags'

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

type ChannelFilter = '' | 'telegram' | 'email' | 'sms_followup' | 'system'
type StatusFilter = '' | 'sent' | 'failed'

const CHANNEL_OPTIONS: { value: ChannelFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: 'Email' },
  { value: 'sms_followup', label: 'SMS' },
  { value: 'system', label: 'System' },
]

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
]

function channelIcon(ch: string) {
  switch (ch) {
    case 'telegram':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M21.2 4.4L2.4 11.5c-.6.2-.6.6 0 .8l4.6 1.4 1.8 5.7c.2.5.7.5 1 .2l2.6-2.1 5 3.7c.5.4 1 .2 1.1-.4L22 5.2c.2-.7-.3-1.1-.8-.8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'email':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M22 7l-10 7L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'sms_followup':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )
  }
}

function channelColor(ch: string): { bg: string; text: string; border: string } {
  switch (ch) {
    case 'telegram': return { bg: 'rgba(59,130,246,0.08)', text: 'rgb(96,165,250)', border: 'rgba(59,130,246,0.15)' }
    case 'email': return { bg: 'rgba(168,85,247,0.08)', text: 'rgb(192,132,252)', border: 'rgba(168,85,247,0.15)' }
    case 'sms_followup': return { bg: 'rgba(16,185,129,0.08)', text: 'rgb(52,211,153)', border: 'rgba(16,185,129,0.15)' }
    default: return { bg: 'rgba(148,163,184,0.08)', text: 'rgb(148,163,184)', border: 'rgba(148,163,184,0.15)' }
  }
}

const PAGE_SIZE = 50

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [channel, setChannel] = useState<ChannelFilter>('')
  const [status, setStatus] = useState<StatusFilter>('')

  // Phase 3 Wave B: admin's switcher-selected client scopes the timeline too.
  // Flag-OFF preserves legacy "all clients" admin view.
  const { scopedClientId } = useClientScope()
  const flagOn = isAdminRedesignEnabledClient()
  const adminScope = flagOn && scopedClientId !== 'all' ? scopedClientId : null

  const buildParams = useCallback((offset = 0) => {
    const params = new URLSearchParams()
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(offset))
    if (channel) params.set('channel', channel)
    if (status) params.set('status', status)
    if (adminScope) params.set('client_id', adminScope)
    return params
  }, [channel, status, adminScope])

  const fetchNotifications = useCallback(async (offset = 0, append = false) => {
    if (!append) setLoading(true)
    else setLoadingMore(true)
    try {
      const r = await fetch(`/api/dashboard/notifications?${buildParams(offset)}`)
      const d = await r.json()
      const items: Notification[] = d.notifications || []
      setNotifications(prev => append ? [...prev, ...items] : items)
      setTotal(d.total ?? 0)
    } catch { /* swallow */ }
    setLoading(false)
    setLoadingMore(false)
  }, [buildParams])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Realtime: refresh when notification_logs change
  useEffect(() => {
    const supabase = createBrowserClient()
    const ch = supabase
      .channel('notifications_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_logs' }, () => {
        fetchNotifications()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchNotifications])

  const counts = useMemo(() => {
    const sent = notifications.filter(n => n.status === 'sent').length
    const failed = notifications.filter(n => n.status === 'failed').length
    const telegram = notifications.filter(n => n.channel === 'telegram').length
    const email = notifications.filter(n => n.channel === 'email').length
    return { sent, failed, telegram, email, total: notifications.length }
  }, [notifications])

  // Group notifications by date
  const grouped = useMemo(() => {
    const groups: { date: string; label: string; items: Notification[] }[] = []
    const map = new Map<string, Notification[]>()
    notifications.forEach(n => {
      const key = n.created_at.split('T')[0]
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(n)
    })
    const today = new Date().toISOString().split('T')[0]
    for (const [date, items] of map) {
      const d = new Date(date + 'T00:00')
      const label = date === today ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      groups.push({ date, label, items })
    }
    return groups
  }, [notifications])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-1)' }}>
          Notifications
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-3)' }}>
          Alerts sent by your AI agent — Telegram, email, and SMS.
        </p>
      </div>

      {/* Alert configuration — channels, message style, preferences, weekly email */}
      <NotificationsConfigSection />

      {loading && (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            <span className="text-sm" style={{ color: 'var(--color-text-3)' }}>Loading notifications...</span>
          </div>
        </div>
      )}

      {!loading && notifications.length === 0 && !channel && !status && <NoNotifications />}

      {!loading && (notifications.length > 0 || channel || status) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Sent" value={counts.sent} color="emerald" />
            <StatCard label="Failed" value={counts.failed} color="red" />
            <StatCard label="Telegram" value={counts.telegram} color="blue" />
            <StatCard label="Email" value={counts.email} color="purple" />
          </div>

          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex gap-2">
              {CHANNEL_OPTIONS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setChannel(c.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    channel === c.value
                      ? 'border-indigo-500/40 bg-indigo-500/10 text-[var(--color-primary)] shadow-sm shadow-indigo-500/10'
                      : 'border-transparent hover:bg-hover'
                  }`}
                  style={channel !== c.value ? { color: 'var(--color-text-3)' } : undefined}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    status === s.value
                      ? 'border-indigo-500/40 bg-indigo-500/10 text-[var(--color-primary)] shadow-sm shadow-indigo-500/10'
                      : 'border-transparent hover:bg-hover'
                  }`}
                  style={status !== s.value ? { color: 'var(--color-text-3)' } : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grouped timeline */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${channel}-${status}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {notifications.length === 0 && (
                <div className="text-center py-16 rounded-2xl border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                  <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>No notifications match this filter.</p>
                </div>
              )}

              {grouped.map((group, gi) => (
                <div key={group.date}>
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-3)' }}>
                      {group.label}
                    </span>
                    <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-3)' }}>
                      {group.items.length} {group.items.length === 1 ? 'notification' : 'notifications'}
                    </span>
                  </div>

                  {/* Timeline cards */}
                  <div className="relative pl-6 space-y-3">
                    {/* Timeline line */}
                    <div
                      className="absolute left-[7px] top-2 bottom-2 w-px"
                      style={{ backgroundColor: 'var(--color-border)' }}
                    />

                    {group.items.map((n, i) => {
                      const cc = channelColor(n.channel)
                      return (
                        <motion.div
                          key={n.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: gi * 0.05 + i * 0.03 }}
                          className="relative"
                        >
                          {/* Timeline dot */}
                          <div
                            className={`absolute -left-6 top-5 w-[15px] h-[15px] rounded-full border-2 ${
                              n.status === 'failed'
                                ? 'border-red-500/50 bg-red-500/20'
                                : 'border-emerald-500/50 bg-emerald-500/20'
                            }`}
                          >
                            {n.status === 'sent' && (
                              <div className="absolute inset-[3px] rounded-full bg-emerald-400" />
                            )}
                            {n.status === 'failed' && (
                              <div className="absolute inset-[3px] rounded-full bg-red-400" />
                            )}
                          </div>

                          {/* Card */}
                          <div
                            className="rounded-xl border p-4 transition-all hover:border-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/[0.03] group"
                            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                          >
                            <div className="flex items-start gap-4">
                              {/* Channel icon badge */}
                              <div
                                className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: cc.bg, border: `1px solid ${cc.border}`, color: cc.text }}
                              >
                                {channelIcon(n.channel)}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cc.text }}>
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
                                  <span className="text-[11px] ml-auto tabular-nums" style={{ color: 'var(--color-text-3)' }}>
                                    {new Date(n.created_at).toLocaleString('en', { hour: 'numeric', minute: '2-digit' })}
                                  </span>
                                </div>

                                {n.recipient && (
                                  <p className="text-xs mt-1 truncate" style={{ color: 'var(--color-text-2)' }}>{n.recipient}</p>
                                )}
                                {n.content && (
                                  <p className="text-xs mt-1.5 line-clamp-2" style={{ color: 'var(--color-text-3)' }}>{n.content.replace(/<[^>]*>/g, '')}</p>
                                )}
                                {n.error && (
                                  <p className="text-xs mt-1.5 text-red-400 truncate flex items-center gap-1">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
                                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                                      <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                      <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                    </svg>
                                    {n.error}
                                  </p>
                                )}

                                {/* Action row */}
                                {n.call_id && (
                                  <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Link
                                      href={`/dashboard/calls/${n.call_id}`}
                                      className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors hover:bg-hover w-fit"
                                      style={{ color: 'var(--color-text-3)' }}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 18.5A2.5 2.5 0 0114.5 16H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h3.5A2.5 2.5 0 0112 18.5zM12 18.5V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                      </svg>
                                      View call
                                    </Link>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>

          {notifications.length < total && (
            <div className="text-center pt-2">
              <button
                onClick={() => fetchNotifications(notifications.length, true)}
                disabled={loadingMore}
                className="px-4 py-2 rounded-lg text-xs font-medium border transition-colors hover:bg-hover disabled:opacity-50"
                style={{ color: 'var(--color-text-3)', borderColor: 'var(--color-border)' }}
              >
                {loadingMore ? 'Loading...' : `Load more (${notifications.length} of ${total})`}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

// ─── Stats Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    emerald: { bg: 'rgba(16,185,129,0.08)', text: 'rgb(52,211,153)', border: 'rgba(16,185,129,0.15)' },
    red: { bg: 'rgba(239,68,68,0.08)', text: 'rgb(248,113,113)', border: 'rgba(239,68,68,0.15)' },
    blue: { bg: 'rgba(59,130,246,0.08)', text: 'rgb(96,165,250)', border: 'rgba(59,130,246,0.15)' },
    purple: { bg: 'rgba(168,85,247,0.08)', text: 'rgb(192,132,252)', border: 'rgba(168,85,247,0.15)' },
  }
  const c = colors[color] || colors.emerald
  return (
    <div
      className="rounded-xl px-4 py-3 border"
      style={{ backgroundColor: c.bg, borderColor: c.border }}
    >
      <p className="text-2xl font-bold tabular-nums" style={{ color: c.text }}>{value}</p>
      <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--color-text-3)' }}>{label}</p>
    </div>
  )
}
