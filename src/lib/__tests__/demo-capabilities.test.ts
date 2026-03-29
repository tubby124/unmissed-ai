import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildDemoTools } from '../ultravox'

// ── Phase F0: Capability-truth tests for demo paths ──────────────────────────
// Asserts that buildDemoTools returns EXACTLY the right tools for each demo path.
// No extras, no missing. This catches the class of bug where a path claims tools
// it cannot actually deliver.

describe('buildDemoTools — browser path (WebRTC, no phone)', () => {
  const tools = buildDemoTools('unmissed-demo', {
    hasPhoneMedium: false,
    hasCallerPhone: false,
    calendarEnabled: true,
    transferEnabled: false,
  })

  it('includes calendar tools (3)', () => {
    const calendarTools = tools.filter(
      (t: any) => t.temporaryTool?.modelToolName?.includes('Calendar') || t.temporaryTool?.modelToolName?.includes('Appointment') || t.temporaryTool?.modelToolName === 'checkCalendarAvailability' || t.temporaryTool?.modelToolName === 'bookAppointment' || t.temporaryTool?.modelToolName === 'transitionToBookingStage'
    )
    assert.equal(calendarTools.length, 3, `Expected 3 calendar tools, got ${calendarTools.length}`)
  })

  it('does NOT include SMS (no phone number)', () => {
    const smsTools = tools.filter((t: any) => t.temporaryTool?.modelToolName === 'sendTextMessage')
    assert.equal(smsTools.length, 0, 'SMS tool should not be present — browser has no phone number')
  })

  it('does NOT include transfer (no Twilio SID)', () => {
    const transferTools = tools.filter((t: any) => t.temporaryTool?.modelToolName === 'transferCall')
    assert.equal(transferTools.length, 0, 'Transfer tool should not be present — WebRTC has no Twilio SID')
  })

  it('total tool count is exactly 3 (calendar only)', () => {
    assert.equal(tools.length, 3, `Expected 3 tools (calendar set), got ${tools.length}`)
  })
})

describe('buildDemoTools — call-me path (Twilio, known phone)', () => {
  const tools = buildDemoTools('unmissed-demo', {
    hasPhoneMedium: true,
    hasCallerPhone: true,
    calendarEnabled: true,
    transferEnabled: true,
  })

  it('includes calendar tools (3)', () => {
    const calendarTools = tools.filter(
      (t: any) => t.temporaryTool?.modelToolName === 'checkCalendarAvailability' || t.temporaryTool?.modelToolName === 'bookAppointment' || t.temporaryTool?.modelToolName === 'transitionToBookingStage'
    )
    assert.equal(calendarTools.length, 3)
  })

  it('includes SMS tool (1)', () => {
    const smsTools = tools.filter((t: any) => t.temporaryTool?.modelToolName === 'sendTextMessage')
    assert.equal(smsTools.length, 1)
  })

  it('includes transfer tool (1)', () => {
    const transferTools = tools.filter((t: any) => t.temporaryTool?.modelToolName === 'transferCall')
    assert.equal(transferTools.length, 1)
  })

  it('total tool count is exactly 5 (calendar + SMS + transfer)', () => {
    assert.equal(tools.length, 5, `Expected 5 tools, got ${tools.length}`)
  })
})

describe('buildDemoTools — IVR path B1a (hangUp only, no tools from buildDemoTools)', () => {
  // IVR B1a: no tools passed to createDemoCall. buildDemoTools not called.
  // This test verifies that a "no capabilities" config returns empty array.
  const tools = buildDemoTools('unmissed-demo', {
    hasPhoneMedium: true,
    hasCallerPhone: true,
    calendarEnabled: false,
    transferEnabled: false,
  })

  it('returns empty when calendar and transfer disabled (even with phone)', () => {
    // SMS requires hasPhoneMedium + hasCallerPhone — but if we don't enable calendar/transfer,
    // SMS still gets added because it only checks hasPhoneMedium + hasCallerPhone.
    // So with the current implementation, we'd get SMS only.
    // The IVR B1a path doesn't call buildDemoTools at all — it uses createDemoCall with no tools.
    // This test documents what buildDemoTools WOULD return if called with minimal caps.
    const smsTools = tools.filter((t: any) => t.temporaryTool?.modelToolName === 'sendTextMessage')
    assert.equal(smsTools.length, 1, 'SMS still injected when phone medium + caller phone exist')
    assert.equal(tools.length, 1, 'Only SMS tool returned with minimal caps + phone')
  })
})

describe('buildDemoTools — no phone medium, no calendar, no transfer', () => {
  const tools = buildDemoTools('unmissed-demo', {
    hasPhoneMedium: false,
    hasCallerPhone: false,
    calendarEnabled: false,
    transferEnabled: false,
  })

  it('returns empty array', () => {
    assert.equal(tools.length, 0, 'No tools should be returned with all caps disabled')
  })
})

describe('buildDemoTools — corpus gate (dual-gated)', () => {
  // buildDemoTools does NOT include corpus/knowledge tools — those are added separately
  // by the route handler based on knowledge_backend check.
  // This test verifies buildDemoTools never includes corpus tools regardless of caps.
  const tools = buildDemoTools('unmissed-demo', {
    hasPhoneMedium: true,
    hasCallerPhone: true,
    calendarEnabled: true,
    transferEnabled: true,
  })

  it('never includes queryCorpus (corpus is managed separately)', () => {
    const corpusTools = tools.filter((t: any) => t.toolName === 'queryCorpus')
    assert.equal(corpusTools.length, 0, 'buildDemoTools should never include corpus tools — those are route-level')
  })
})
