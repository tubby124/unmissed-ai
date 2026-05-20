type DemoCallLike = {
  caller_name?: string | null
  caller_phone?: string | null
  caller_email?: string | null
}

export interface DemoScorecardInput {
  transcriptText: string
  toolNames: string[]
  demoCall: DemoCallLike
}

export interface DemoScorecard {
  capabilityProof: {
    smsSent: boolean
    knowledgeUsed: boolean
    bookingStageEntered: boolean
    transferOffered: boolean
  }
  buyerIntent: {
    businessType: string | null
    pain: string | null
    planFit: 'trial' | 'pro' | 'unknown'
    nextBestAction: 'trial' | 'pro' | 'booking' | 'transfer' | 'follow_up' | 'none'
    contactAvailable: boolean
  }
  faults: string[]
}

const BUSINESS_PATTERNS: Array<[RegExp, string]> = [
  [/auto glass|windshield|glass shop/i, 'auto glass'],
  [/property manager|tenant|rental/i, 'property management'],
  [/real estate|realtor|showing|buyer/i, 'real estate'],
  [/restaurant|reservation|catering/i, 'restaurant'],
  [/plumb|hvac|roof|trade|service business/i, 'service business'],
]

export function buildDemoScorecard(input: DemoScorecardInput): DemoScorecard {
  const text = input.transcriptText
  const lower = text.toLowerCase()
  const businessType = BUSINESS_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? null
  const pain = /miss(?:ed)? .*call|after hours|voicemail|not answering/i.test(text)
    ? 'missed-call pain mentioned'
    : null
  const wantsBooking = /book|calendar|walkthrough|demo call/i.test(text) || input.toolNames.includes('transitionToBookingStage')
  const proSignal = /pro|250 minutes|serious|already losing|call volume/i.test(text)
  const trialSignal = /trial|test|try|mess with|play with/i.test(text)
  const faults: string[] = []

  if (/\$20\b|\$29 founding|\$49 regular/i.test(text)) faults.push('stale pricing mentioned')
  if ((lower.match(/great question/g) ?? []).length > 1) faults.push('repeated phrase: great question')
  if (/telegram/i.test(text) && !/depends on setup|when configured|if configured/i.test(text)) {
    faults.push('Telegram may have been overclaimed')
  }

  return {
    capabilityProof: {
      smsSent: input.toolNames.includes('sendTextMessage') || /texted you|sent you/i.test(text),
      knowledgeUsed: input.toolNames.includes('queryKnowledge'),
      bookingStageEntered: input.toolNames.includes('transitionToBookingStage'),
      transferOffered: input.toolNames.includes('transferCall') || /connect you|transfer/i.test(text),
    },
    buyerIntent: {
      businessType,
      pain,
      planFit: proSignal ? 'pro' : trialSignal ? 'trial' : 'unknown',
      nextBestAction: wantsBooking ? 'booking' : proSignal ? 'pro' : trialSignal ? 'trial' : pain ? 'follow_up' : 'none',
      contactAvailable: Boolean(input.demoCall.caller_phone || input.demoCall.caller_email),
    },
    faults,
  }
}
