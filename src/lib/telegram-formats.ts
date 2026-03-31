/**
 * Telegram message format templates.
 *
 * Three styles selectable per client via `clients.telegram_style`:
 *   - compact:     Minimal — action line + key detail (one glance)
 *   - standard:    Balanced — action + context separated (DEFAULT)
 *   - action_card: Structured — divider lines, action front, all details below
 *
 * Design rule (D248): action drives the first 2 lines for HOT/WARM.
 *   HOT  → "📞 Call [Name] NOW: [phone]" on line 2
 *   WARM → "📞 Follow up: [phone]" on line 2
 *   COLD → summary only, no action line
 *   JUNK → returns empty string (caller must skip sendAlert)
 *
 * Auto-glass niche keeps its own dedicated format in completed-notifications.ts.
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
  callbackPreference?: string | null
}

const STATUS_EMOJI: Record<string, string> = {
  HOT: '🔥', WARM: '🟡', COLD: '❄️', JUNK: '🗑', UNKNOWN: '⚠️',
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

/** Build the action line — the most important line in the message. */
function buildActionLine(status: string, callerName: string | null, phone: string): string {
  const fmtPhone = formatPhone(phone)
  if (status === 'HOT') {
    return callerName
      ? `📞 Call <b>${callerName}</b> NOW: ${fmtPhone}`
      : `📞 Call back NOW: ${fmtPhone}`
  }
  if (status === 'WARM') {
    return callerName
      ? `📞 Follow up with <b>${callerName}</b>: ${fmtPhone}`
      : `📞 Follow up: ${fmtPhone}`
  }
  return ''
}

/** Build the header line — status + service label. */
function buildHeader(status: string, serviceType: string, serviceRequested: string | null): string {
  const emoji = STATUS_EMOJI[status] || '📞'
  const label = serviceRequested || serviceType || ''
  const labelStr = label && label !== 'other' ? ` — ${label}` : ''
  return `${emoji} <b>${status} LEAD${labelStr}</b>`
}

// ── Style: Compact ─────────────────────────────────────────────────────────
function formatCompact(input: FormatInput): string {
  if (input.status === 'JUNK') return ''

  const callerName = input.callerData?.callerName ?? null
  const lines: string[] = []

  lines.push(buildHeader(input.status, input.serviceType, input.callerData?.serviceRequested ?? null))

  const actionLine = buildActionLine(input.status, callerName, input.callerPhone)
  if (actionLine) lines.push(actionLine)

  if (input.summary) lines.push(input.summary)

  if (input.booking) {
    lines.push(`📅 Booked: ${input.booking.appointmentTime}`)
  }

  if (input.callbackPreference) {
    lines.push(`⏰ Callback pref: ${input.callbackPreference}`)
  }

  if (input.recordingUrl) {
    lines.push(`🎧 <a href="${input.recordingUrl}">Recording</a>`)
  }

  if (input.status === 'COLD') {
    lines.push(`ℹ️ No action needed.`)
  }

  return lines.join('\n')
}

// ── Style: Standard (DEFAULT) ──────────────────────────────────────────────
function formatStandard(input: FormatInput): string {
  if (input.status === 'JUNK') return ''

  const callerName = input.callerData?.callerName ?? null
  const { date, time } = formatDateTime(input.endedAt, input.timezone)
  const dur = formatDuration(input.durationSeconds)
  const lines: string[] = []

  lines.push(buildHeader(input.status, input.serviceType, input.callerData?.serviceRequested ?? null))
  lines.push(`📅 ${date} · ${time} · ${dur}`)

  const actionLine = buildActionLine(input.status, callerName, input.callerPhone)
  if (actionLine) {
    lines.push('')
    lines.push(actionLine)
  }

  if (input.summary) {
    lines.push('')
    lines.push(input.summary)
  }

  if (input.booking) {
    lines.push('')
    lines.push(`📅 <b>BOOKED:</b> ${input.booking.appointmentTime}`)
    if (input.booking.calendarUrl) {
      lines.push(`🔗 <a href="${input.booking.calendarUrl}">View in Google Calendar</a>`)
    }
  }

  if (input.callbackPreference) {
    lines.push(`⏰ Callback pref: ${input.callbackPreference}`)
  }

  if (input.recordingUrl) {
    lines.push(`🎧 <a href="${input.recordingUrl}">Recording</a>`)
  }

  if (input.status === 'COLD') {
    lines.push('')
    lines.push(`ℹ️ No action needed.`)
  }

  return lines.join('\n')
}

// ── Style: Action Card ─────────────────────────────────────────────────────
const DIVIDER = '━━━━━━━━━━━━━━━━━'

function formatActionCard(input: FormatInput): string {
  if (input.status === 'JUNK') return ''

  const callerName = input.callerData?.callerName ?? null
  const { date, time } = formatDateTime(input.endedAt, input.timezone)
  const dur = formatDuration(input.durationSeconds)
  const lines: string[] = []

  lines.push(buildHeader(input.status, input.serviceType, input.callerData?.serviceRequested ?? null))
  lines.push(DIVIDER)

  const actionLine = buildActionLine(input.status, callerName, input.callerPhone)
  if (actionLine) {
    lines.push(actionLine)
  }

  if (input.summary) lines.push(input.summary)

  if (input.booking) {
    lines.push(`📅 Booked: <b>${input.booking.appointmentTime}</b>`)
    if (input.booking.calendarUrl) {
      lines.push(`🔗 <a href="${input.booking.calendarUrl}">View in Google Calendar</a>`)
    }
  }

  if (input.callbackPreference) {
    lines.push(`⏰ ${input.callbackPreference}`)
  }

  lines.push(DIVIDER)
  lines.push(`📅 ${date} · ${time} · ${dur}`)

  if (input.recordingUrl) {
    lines.push(`🎧 <a href="${input.recordingUrl}">Recording</a>`)
  }

  if (input.status === 'COLD') {
    lines.push(`ℹ️ No action needed.`)
  }

  return lines.join('\n')
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Format a call summary for Telegram.
 * Returns empty string for JUNK — callers must check before sending.
 */
export function formatTelegramMessage(style: TelegramStyle, input: FormatInput): string {
  switch (style) {
    case 'action_card': return formatActionCard(input)
    case 'compact':     return formatCompact(input)
    case 'standard':
    default:            return formatStandard(input)
  }
}
