import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyNotificationGap,
  summarizeNotificationReliability,
  type NotificationReliabilityInput,
} from '../notification-reliability.js'

describe('notification reliability gap classification', () => {
  test('completed actionable call without owner alert is P0', () => {
    const findings = classifyNotificationGap({
      callId: 'call-1',
      clientId: 'client-1',
      callCompleted: true,
      ownerAlertSent: false,
      summaryGenerated: true,
      classification: 'HOT',
      notificationFailures: 0,
    })

    assert.equal(findings[0]?.severity, 'P0')
    assert.equal(findings[0]?.kind, 'completed_call_without_owner_alert')
    assert.equal(findings[0]?.callId, 'call-1')
  })

  test('UNKNOWN classification is P1 even when an owner alert was sent', () => {
    const findings = classifyNotificationGap({
      callId: 'call-2',
      clientId: 'client-1',
      callCompleted: true,
      ownerAlertSent: true,
      summaryGenerated: true,
      classification: 'UNKNOWN',
      notificationFailures: 0,
    })

    assert.ok(findings.some((f) => f.severity === 'P1' && f.kind === 'unknown_classification'))
  })

  test('notification send failures are P1', () => {
    const findings = classifyNotificationGap({
      callId: 'call-3',
      clientId: 'client-1',
      callCompleted: true,
      ownerAlertSent: true,
      summaryGenerated: true,
      classification: 'WARM',
      notificationFailures: 2,
    })

    assert.ok(findings.some((f) => f.kind === 'notification_send_failures'))
  })

  test('summarizeNotificationReliability groups P0/P1/P2 counts', () => {
    const inputs: NotificationReliabilityInput[] = [
      {
        callId: 'call-1',
        clientId: 'client-1',
        callCompleted: true,
        ownerAlertSent: false,
        summaryGenerated: true,
        classification: 'HOT',
        notificationFailures: 0,
      },
      {
        callId: 'call-2',
        clientId: 'client-2',
        callCompleted: true,
        ownerAlertSent: true,
        summaryGenerated: true,
        classification: 'UNKNOWN',
        notificationFailures: 1,
      },
    ]

    const summary = summarizeNotificationReliability(inputs)
    assert.equal(summary.ok, false)
    assert.equal(summary.counts.P0, 1)
    assert.equal(summary.counts.P1, 2)
    assert.equal(summary.findings.length, 3)
  })
})
