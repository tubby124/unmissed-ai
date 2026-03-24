/**
 * Builds a pre-filled Google Calendar event URL.
 * No OAuth required — opens in the user's browser with event pre-populated.
 */
export function buildCalendarUrl({
  callerPhone,
  serviceType,
  aiSummary,
  nextSteps,
  callId,
}: {
  callerPhone?: string | null
  serviceType?: string | null
  aiSummary?: string | null
  nextSteps?: string | null
  callId?: string
}): string {
  const title =
    serviceType && serviceType !== 'other'
      ? `Follow-up: ${serviceType.replace(/_/g, ' ')} — ${callerPhone ?? 'Unknown'}`
      : `Follow-up call — ${callerPhone ?? 'Unknown'}`

  const detailParts: string[] = []
  if (aiSummary) detailParts.push(`AI Summary:\n${aiSummary}`)
  if (nextSteps) detailParts.push(`Next Steps:\n${nextSteps}`)
  if (callId) detailParts.push(`Call ID: ${callId}`)
  const details = detailParts.join('\n\n')

  // Default: tomorrow at 10:00–10:30 AM
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(10, 0, 0, 0)
  const end = new Date(start)
  end.setMinutes(30)

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details,
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
