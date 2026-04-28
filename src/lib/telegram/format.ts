import type { CallRow } from './queries'

const STATUS_EMOJI: Record<string, string> = {
  HOT: '🔥',
  WARM: '🟡',
  COLD: '❄️',
  JUNK: '🗑',
  MISSED: '🚫',
  UNKNOWN: '⚠️',
}

function fmtPhone(p: string | null): string {
  if (!p) return '—'
  const d = p.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return p
}

function fmtTime(iso: string | null, tz: string): string {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n)
  return s + ' '.repeat(n - s.length)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderCallTable(rows: CallRow[], tz: string): string {
  if (rows.length === 0) return ''
  const lines = rows.map((r) => {
    const emoji = STATUS_EMOJI[r.call_status ?? 'UNKNOWN'] ?? '⚠️'
    const time = fmtTime(r.started_at, tz)
    const phone = pad(fmtPhone(r.caller_phone), 16)
    const name = pad((r.caller_name ?? '—').slice(0, 12), 12)
    const svc = (r.service_type ?? '').slice(0, 14)
    return `${emoji} ${time}  ${phone}  ${name}  ${svc}`.trimEnd()
  })
  return `<pre>${escapeHtml(lines.join('\n'))}</pre>`
}

export function renderCallSummary(r: CallRow, tz: string, recordingUrl: string | null): string {
  const emoji = STATUS_EMOJI[r.call_status ?? 'UNKNOWN'] ?? '⚠️'
  const time = fmtTime(r.started_at, tz)
  const phone = fmtPhone(r.caller_phone)
  const name = r.caller_name ? `<b>${escapeHtml(r.caller_name)}</b>` : phone
  const dur = r.duration_seconds && r.duration_seconds > 0
    ? `${Math.floor(r.duration_seconds / 60)}m ${String(r.duration_seconds % 60).padStart(2, '0')}s`
    : '—'
  const summary = (r.ai_summary ?? '').slice(0, 400)
  const next = r.next_steps ? `\n\n<b>Next:</b> ${escapeHtml(r.next_steps.slice(0, 200))}` : ''
  const cb = r.callback_preference ? `\n<b>Callback:</b> ${escapeHtml(r.callback_preference)}` : ''
  const rec = recordingUrl ? `\n\n🔊 <a href="${recordingUrl}">Recording</a>` : ''
  return `${emoji} ${name} · ${phone}\n${time} · ${dur} · ${r.call_status ?? '—'}\n\n${escapeHtml(summary)}${next}${cb}${rec}`
}

export function renderHelp(): string {
  return [
    '<b>Commands</b>',
    '/calls — last 5 calls',
    '/today — today\'s calls',
    '/missed — HOT/WARM not yet called back',
    '/lastcall — full summary of most recent call',
    '/minutes — minutes used this cycle',
    '/help — this list',
  ].join('\n')
}

export function renderEmptyCalls(): string {
  return 'No calls yet.\n\nForward your business number in and the first call will show up here.'
}

export function renderMinutes(
  used: number,
  limit: number,
  bonus: number,
  business: string | null
): string {
  const total = limit + bonus
  const pct = total > 0 ? Math.round((used / total) * 100) : 0
  const remaining = Math.max(0, total - used)
  const business_label = business ? `<b>${escapeHtml(business)}</b>\n` : ''
  return `${business_label}${used} / ${total} min used (${pct}%)\n${remaining} min remaining this cycle`
}

export function renderRateLimited(retryAfterSec: number): string {
  return `⏱ Slow down — try again in ${Math.max(1, retryAfterSec)}s.`
}

export function renderUnregistered(): string {
  return 'This bot only responds to clients of unmissed.ai.\n\nIf you\'re a client, use the link from your welcome email to connect.'
}

export function renderUnknown(): string {
  return 'I didn\'t catch that. Try /help for commands.'
}

export function urgentCount(rows: CallRow[]): number {
  return rows.filter((r) => r.call_status === 'HOT' || r.call_status === 'WARM').length
}

export function renderCallsHeader(rows: CallRow[]): string {
  const urgent = urgentCount(rows)
  return urgent > 0 ? `<b>${urgent} urgent</b>` : ''
}
