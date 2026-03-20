/**
 * Telegram message format templates.
 *
 * Three styles selectable per client via `clients.telegram_style`:
 *   - compact:     Minimal — status + phone + summary + action (one glance)
 *   - standard:    Balanced — summary, contact, next steps separated (DEFAULT)
 *   - action_card: Structured — date/time header, summary, booking, contact, action
 *
 * Auto-glass niche keeps its own dedicated format (vehicle/ADAS/VIN).
 */

export type TelegramStyle = 'compact' | 'standard' | 'action_card'

interface FormatInput {
  status: string
  businessName: string
  callerPhone: string
  durationSeconds: number
  summary: string
  nextSteps: string
  serviceType: string
  endedAt: string
  timezone: string
  callerData?: {
    callerName: string | null
    serviceRequested: string | null
  } | null
  booking?: {
    callerName: string | null
    appointmentTime: string
    calendarUrl: string | null
  } | null
  recordingUrl?: string | null
}

const STATUS_EMOJI: Record<string, string> = {
  HOT: '🔥', WARM: '🌤', COLD: '❄️', JUNK: '🗑', UNKNOWN: '⚠️',
}

function formatPhone(p: string): string {
  const d = p.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return p
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'n/a'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function formatDateTime(iso: string, tz: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }),
  }
}

// ── Style C — Compact ──────────────────────────────────────────────────────
function formatCompact(input: FormatInput): string {
  const emoji = STATUS_EMOJI[input.status] || '📞'
  const dur = formatDuration(input.durationSeconds)
  const phone = formatPhone(input.callerPhone)
  const nameLabel = input.callerData?.callerName ? ` — ${input.callerData.callerName}` : ''

  const lines = [
    `${emoji} <b>${input.status}${nameLabel}</b> · ${phone} · ${dur}`,
  ]

  if (input.callerData?.serviceRequested) lines.push(`🏷 ${input.callerData.serviceRequested}`)
  lines.push(input.summary)

  if (input.booking) {
    lines.push(`📅 Booked: ${input.booking.appointmentTime}`)
  }

  if (input.nextSteps) {
    lines.push(`↳ ${input.nextSteps}`)
  }

  if (input.recordingUrl) {
    lines.push(`🎧 <a href="${input.recordingUrl}">Listen to recording</a>`)
  }

  return lines.join('\n')
}

// ── Style B — Standard (DEFAULT) ───────────────────────────────────────────
function formatStandard(input: FormatInput): string {
  const emoji = STATUS_EMOJI[input.status] || '📞'
  const { date, time } = formatDateTime(input.endedAt, input.timezone)
  const phone = formatPhone(input.callerPhone)
  const dur = formatDuration(input.durationSeconds)
  const nameLabel = input.callerData?.callerName ? ` — ${input.callerData.callerName}` : ''

  const lines = [
    `${emoji} <b>${input.status} LEAD${nameLabel}</b> — ${input.businessName}`,
    `📅 ${date} · ${time}`,
  ]

  if (input.callerData?.serviceRequested) lines.push(`🏷 ${input.callerData.serviceRequested}`)
  lines.push('')
  lines.push(input.summary)

  if (input.booking) {
    lines.push('')
    lines.push(`📅 <b>BOOKED:</b> ${input.booking.appointmentTime}`)
    if (input.booking.calendarUrl) {
      lines.push(`🔗 <a href="${input.booking.calendarUrl}">View in Google Calendar</a>`)
    }
  }

  lines.push('')
  lines.push(`👤 ${phone} · ${dur}`)

  if (input.nextSteps) {
    lines.push(`📋 ${input.nextSteps}`)
  }

  if (input.recordingUrl) {
    lines.push(`🎧 <a href="${input.recordingUrl}">Listen to recording</a>`)
  }

  return lines.join('\n')
}

// ── Style A — Action Card ──────────────────────────────────────────────────
function formatActionCard(input: FormatInput): string {
  const emoji = STATUS_EMOJI[input.status] || '📞'
  const { date, time } = formatDateTime(input.endedAt, input.timezone)
  const phone = formatPhone(input.callerPhone)
  const dur = formatDuration(input.durationSeconds)
  const nameLabel = input.callerData?.callerName ? ` — ${input.callerData.callerName}` : ''

  const lines = [
    `${emoji} <b>${input.status} LEAD${nameLabel}</b> — ${input.businessName}`,
    `📅 ${date} · ${time} · ${dur}`,
  ]

  if (input.callerData?.serviceRequested) lines.push(`🏷 ${input.callerData.serviceRequested}`)
  lines.push('')
  lines.push(input.summary)

  if (input.booking) {
    lines.push('')
    lines.push(`📅 <b>BOOKED:</b> ${input.booking.appointmentTime}`)
    if (input.booking.calendarUrl) {
      lines.push(`🔗 <a href="${input.booking.calendarUrl}">View in Google Calendar</a>`)
    }
    const name = input.booking.callerName && input.booking.callerName !== 'Caller' ? input.booking.callerName : null
    lines.push(`↳ Call${name ? ` ${name}` : ''} at ${phone} to confirm`)
  } else {
    lines.push(`↳ Call ${phone}`)
  }

  if (input.recordingUrl) {
    lines.push(`🎧 <a href="${input.recordingUrl}">Listen to recording</a>`)
  }

  return lines.join('\n')
}

// ── Public API ─────────────────────────────────────────────────────────────
export function formatTelegramMessage(style: TelegramStyle, input: FormatInput): string {
  switch (style) {
    case 'action_card': return formatActionCard(input)
    case 'compact':     return formatCompact(input)
    case 'standard':
    default:            return formatStandard(input)
  }
}
