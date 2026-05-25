export type ReliabilitySeverity = 'P0' | 'P1' | 'P2'

export interface NotificationReliabilityInput {
  callId: string
  clientId: string | null
  callCompleted: boolean
  ownerAlertSent: boolean
  summaryGenerated: boolean
  classification: string | null
  notificationFailures: number
  billedDurationMissing?: boolean
  createdAt?: string | null
}

export interface NotificationReliabilityFinding {
  severity: ReliabilitySeverity
  kind:
    | 'completed_call_without_owner_alert'
    | 'missing_summary'
    | 'unknown_classification'
    | 'notification_send_failures'
    | 'missing_billed_duration'
  callId: string
  clientId: string | null
  message: string
}

export interface NotificationReliabilitySummary {
  ok: boolean
  counts: Record<ReliabilitySeverity, number>
  findings: NotificationReliabilityFinding[]
}

const ACTIONABLE_STATUSES = new Set(['HOT', 'WARM', 'COLD', 'UNKNOWN', 'LEAD', 'completed'])

function normalizeStatus(status: string | null): string {
  return (status || '').trim()
}

function isActionable(status: string | null): boolean {
  const normalized = normalizeStatus(status)
  return ACTIONABLE_STATUSES.has(normalized) || ACTIONABLE_STATUSES.has(normalized.toUpperCase())
}

export function classifyNotificationGap(input: NotificationReliabilityInput): NotificationReliabilityFinding[] {
  const findings: NotificationReliabilityFinding[] = []
  const status = normalizeStatus(input.classification)

  if (input.callCompleted && isActionable(status) && !input.ownerAlertSent) {
    findings.push({
      severity: 'P0',
      kind: 'completed_call_without_owner_alert',
      callId: input.callId,
      clientId: input.clientId,
      message: `Actionable ${status || 'completed'} call has no sent owner notification`,
    })
  }

  if (input.callCompleted && isActionable(status) && !input.summaryGenerated) {
    findings.push({
      severity: 'P0',
      kind: 'missing_summary',
      callId: input.callId,
      clientId: input.clientId,
      message: `Actionable ${status || 'completed'} call has no AI/owner summary`,
    })
  }

  if (status.toUpperCase() === 'UNKNOWN') {
    findings.push({
      severity: 'P1',
      kind: 'unknown_classification',
      callId: input.callId,
      clientId: input.clientId,
      message: 'Call classified UNKNOWN and needs manual review or classifier fallback',
    })
  }

  if (input.notificationFailures > 0) {
    findings.push({
      severity: 'P1',
      kind: 'notification_send_failures',
      callId: input.callId,
      clientId: input.clientId,
      message: `${input.notificationFailures} notification channel(s) failed for this call`,
    })
  }

  if (input.billedDurationMissing) {
    findings.push({
      severity: 'P1',
      kind: 'missing_billed_duration',
      callId: input.callId,
      clientId: input.clientId,
      message: 'Completed/billable call is missing billed_duration_seconds',
    })
  }

  return findings
}

export function summarizeNotificationReliability(inputs: NotificationReliabilityInput[]): NotificationReliabilitySummary {
  const findings = inputs.flatMap(classifyNotificationGap)
  const counts: Record<ReliabilitySeverity, number> = { P0: 0, P1: 0, P2: 0 }

  for (const finding of findings) {
    counts[finding.severity] += 1
  }

  return {
    ok: findings.length === 0,
    counts,
    findings,
  }
}
