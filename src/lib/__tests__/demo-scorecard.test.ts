import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildDemoScorecard } from '../demo-scorecard'

describe('buildDemoScorecard', () => {
  it('captures buyer intent, capability proof, and stale pricing faults', () => {
    const scorecard = buildDemoScorecard({
      transcriptText: [
        'Caller: I run an auto glass shop and miss quote calls after hours.',
        'Agent: I just texted you the setup link. Pro is $119/month for 250 minutes.',
        'Caller: Can this book into Google Calendar?',
        'Agent: Yes, I can book a setup walkthrough.',
      ].join('\n'),
      toolNames: ['sendTextMessage', 'queryKnowledge', 'transitionToBookingStage'],
      demoCall: { caller_name: 'Sam', caller_phone: '+13065551212', caller_email: 'sam@example.com' },
    })

    assert.equal(scorecard.capabilityProof.smsSent, true)
    assert.equal(scorecard.capabilityProof.knowledgeUsed, true)
    assert.equal(scorecard.capabilityProof.bookingStageEntered, true)
    assert.equal(scorecard.buyerIntent.businessType, 'auto glass')
    assert.equal(scorecard.buyerIntent.planFit, 'pro')
    assert.equal(scorecard.faults.length, 0)
  })

  it('flags old pricing and robotic wording', () => {
    const scorecard = buildDemoScorecard({
      transcriptText: 'Agent: Great question. Great question. It is $20 a month.',
      toolNames: [],
      demoCall: {},
    })
    assert.ok(scorecard.faults.some(fault => fault.includes('stale pricing')))
    assert.ok(scorecard.faults.some(fault => fault.includes('repeated phrase')))
  })
})
