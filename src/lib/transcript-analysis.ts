/**
 * Transcript Analysis Engine (L5)
 *
 * Keyword-based analysis of call transcripts to detect:
 * - Unanswered questions (agent hedged or couldn't answer)
 * - Feature suggestions (caller tried to use a disabled capability)
 * - Frustration signals (repeated questions, explicit frustration)
 *
 * Two entry points:
 * - analyzeTranscriptClient() — browser-safe, instant feedback after test calls
 * - analyzeTranscriptServer() — server-only, richer config from DB
 *
 * Both return the same CallInsight type. Client-side runs on Ultravox SDK
 * transcripts (speaker/text). Server-side runs on getTranscript() output (role/text).
 *
 * ## How to edit
 * - Add hedge phrases: HEDGE_PHRASES array (agent uncertainty indicators)
 * - Add frustration phrases: FRUSTRATION_PHRASES array (caller displeasure)
 * - Add feature keywords: FEATURE_KEYWORDS map (maps keyword -> feature)
 * - Tune R4 sensitivity: CONTEXT_WINDOW (how many turns to check after a hedge)
 * - Add new feature detectors: extend FeatureDetector type + FEATURE_DETECTORS array
 * - Action types for hints: 'toggle' (instant), 'setup' (needs config), 'scroll' (nav)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Normalized message format used internally by the analysis engine */
export interface AnalysisMessage {
  role: 'user' | 'agent'
  text: string
}

/** A question the agent couldn't answer, detected from hedging/deflection */
export interface UnansweredQuestion {
  question: string
  confidence: 'high' | 'medium' | 'low'
}

/** A feature the caller tried to use but isn't enabled */
export interface FeatureSuggestion {
  /** Feature key matching client config flags */
  feature: 'booking' | 'transfer' | 'sms' | 'hours' | 'knowledge' | 'website'
  /** The caller's actual words that triggered this detection */
  evidence: string
  /** How the dashboard should present the action */
  action: FeatureAction
}

export interface FeatureAction {
  /** 'toggle' = one-click enable, 'setup' = needs wizard/OAuth, 'scroll' = navigate to section */
  type: 'toggle' | 'setup' | 'scroll'
  /** DB field name for toggle actions (e.g. 'sms_enabled') */
  field?: string
  /** Settings section ID for scroll actions (matches id="section-*" on cards) */
  section: string
  /** What the CTA button should say */
  label: string
  /** Setup dependencies — shown instead of toggle if these are missing */
  requires?: string[]
}

/** Complete analysis result for a single call */
export interface CallInsight {
  unansweredQuestions: UnansweredQuestion[]
  featureSuggestions: FeatureSuggestion[]
  callerFrustrated: boolean
  repeatedQuestions: number
  agentConfusedMoments: number
  source: 'keyword'
}

/** Capabilities the client has enabled — used by both client and server paths */
export interface ClientCapabilities {
  hasBooking: boolean
  hasTransfer: boolean
  hasSms: boolean
  hasHours: boolean
  hasKnowledge: boolean
  hasWebsite: boolean
  hasFacts: boolean
  hasFaqs: boolean
}

// ─── Keyword Lists ────────────────────────────────────────────────────────────
// Edit these arrays to tune detection sensitivity.

/** Agent phrases that indicate it couldn't answer a question.
 *  R4: Only flagged if the agent doesn't recover in the next CONTEXT_WINDOW turns. */
const HEDGE_PHRASES = [
  "i don't have that information",
  "i'm not sure about that",
  "i don't know",
  "i'm not able to",
  "i can't help with that",
  "you'd need to contact",
  "i don't have details",
  "i'm unable to",
  "that's outside",
  "i don't have access to that",
  "i'm not certain",
  "i can't provide that",
  "i wouldn't be able to",
  "you'll have to check",
  "i'm not aware of",
  "unfortunately i don't",
  "i don't have specific",
]

/** Caller phrases indicating frustration or displeasure */
const FRUSTRATION_PHRASES = [
  "that's not what i asked",
  "you're not helping",
  "never mind",
  "forget it",
  "i already said",
  "i just told you",
  "that doesn't answer",
  "you already said that",
  "can you just",
  "this is frustrating",
  "are you even listening",
  "i said",
  "that's wrong",
  "no that's not right",
  "that's not correct",
]

/** Feature keyword map: keyword patterns -> feature key.
 *  Each feature has an array of phrases that callers use when trying to access it. */
const FEATURE_KEYWORDS: Record<FeatureSuggestion['feature'], string[]> = {
  booking: [
    'appointment', 'book', 'schedule', 'available time', 'reserve',
    'set up a time', 'make a booking', 'when can i come', 'slot',
    'can i come in', 'book a time',
  ],
  transfer: [
    'speak to someone', 'talk to a person', 'transfer me', 'real person',
    'human', 'speak to a human', 'can i talk to', 'connect me',
    'live person', 'actual person', 'representative',
  ],
  sms: [
    'text me', 'send me', 'message me', 'send information',
    'send a text', 'text the details', 'can you text', 'send it to my phone',
  ],
  hours: [
    'when are you open', 'what time', 'opening hours', 'business hours',
    'are you open', 'what are your hours', 'do you close', 'when do you close',
    'operating hours', 'store hours',
  ],
  knowledge: [], // detected via hedging, not caller keywords
  website: [],   // detected via hedging about info that could come from website scrape
}

/** Feature action configuration — how each feature should be presented in hints.
 *  Edit this to change CTA copy or action types. */
const FEATURE_ACTIONS: Record<FeatureSuggestion['feature'], FeatureAction> = {
  booking: {
    type: 'setup',
    section: 'booking',
    label: 'Set up booking',
    requires: ['google_calendar'],
  },
  transfer: {
    type: 'scroll',
    section: 'agent-config',
    label: 'Add forwarding number',
  },
  sms: {
    type: 'toggle',
    field: 'sms_enabled',
    section: 'agent-config',
    label: 'Enable SMS',
  },
  hours: {
    type: 'scroll',
    section: 'hours',
    label: 'Set your hours',
  },
  knowledge: {
    type: 'scroll',
    section: 'knowledge',
    label: 'Add to knowledge base',
  },
  website: {
    type: 'scroll',
    section: 'advanced-context',
    label: 'Add your website',
  },
}

/** How many agent turns to check after a hedge before flagging as unanswered (R4) */
const CONTEXT_WINDOW = 2

/** Minimum chars for an agent response to count as "substantive" (R4) */
const SUBSTANTIVE_RESPONSE_MIN_CHARS = 50

// ─── Core Analysis (shared, no imports) ───────────────────────────────────────

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

function detectHedges(messages: AnalysisMessage[]): UnansweredQuestion[] {
  const questions: UnansweredQuestion[] = []
  const seen = new Set<string>()

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role !== 'agent') continue

    const normalized = normalizeText(msg.text)
    const hedgeMatch = HEDGE_PHRASES.find(phrase => normalized.includes(phrase))
    if (!hedgeMatch) continue

    // R4: Check if agent recovers in the next CONTEXT_WINDOW turns
    let recovered = false
    for (let j = i + 1; j <= Math.min(i + CONTEXT_WINDOW * 2, messages.length - 1); j++) {
      if (messages[j].role !== 'agent') continue
      const followUp = normalizeText(messages[j].text)
      const stillHedging = HEDGE_PHRASES.some(p => followUp.includes(p))
      if (!stillHedging && messages[j].text.length >= SUBSTANTIVE_RESPONSE_MIN_CHARS) {
        recovered = true
        break
      }
    }

    if (recovered) continue

    // Find the preceding user question
    let userQuestion = ''
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (messages[j].role === 'user' && messages[j].text.length > 5) {
        userQuestion = messages[j].text
        break
      }
    }

    if (!userQuestion) continue
    const normalizedQ = normalizeText(userQuestion)
    if (seen.has(normalizedQ)) continue
    seen.add(normalizedQ)

    questions.push({
      question: userQuestion,
      confidence: hedgeMatch.includes("don't know") || hedgeMatch.includes("can't help")
        ? 'high'
        : 'medium',
    })
  }

  return questions
}

function detectFeatures(
  messages: AnalysisMessage[],
  capabilities: ClientCapabilities
): FeatureSuggestion[] {
  const suggestions: FeatureSuggestion[] = []
  const seenFeatures = new Set<string>()

  // Only check user messages for feature intent
  const userMessages = messages.filter(m => m.role === 'user')

  for (const [feature, keywords] of Object.entries(FEATURE_KEYWORDS) as [FeatureSuggestion['feature'], string[]][]) {
    if (keywords.length === 0) continue // skip knowledge/website (detected via hedging)

    // Skip if feature is already enabled
    const isEnabled = getFeatureEnabled(feature, capabilities)
    if (isEnabled) continue

    for (const msg of userMessages) {
      const normalized = normalizeText(msg.text)
      const matchedKeyword = keywords.find(kw => normalized.includes(kw))
      if (matchedKeyword && !seenFeatures.has(feature)) {
        seenFeatures.add(feature)
        suggestions.push({
          feature,
          evidence: msg.text,
          action: FEATURE_ACTIONS[feature],
        })
        break
      }
    }
  }

  return suggestions
}

function getFeatureEnabled(feature: FeatureSuggestion['feature'], cap: ClientCapabilities): boolean {
  switch (feature) {
    case 'booking': return cap.hasBooking
    case 'transfer': return cap.hasTransfer
    case 'sms': return cap.hasSms
    case 'hours': return cap.hasHours
    case 'knowledge': return cap.hasKnowledge
    case 'website': return cap.hasWebsite
    default: return false
  }
}

function detectFrustration(messages: AnalysisMessage[]): {
  frustrated: boolean
  repeatedQuestions: number
  confusedMoments: number
} {
  let frustrated = false
  const userQuestions: string[] = []
  let confusedMoments = 0

  for (const msg of messages) {
    if (msg.role === 'user') {
      const normalized = normalizeText(msg.text)

      // Check frustration phrases
      if (FRUSTRATION_PHRASES.some(p => normalized.includes(p))) {
        frustrated = true
      }

      // Track for repeated questions
      userQuestions.push(normalized)
    }

    if (msg.role === 'agent') {
      const normalized = normalizeText(msg.text)
      // Agent confusion: hedges twice in a row
      const isHedge = HEDGE_PHRASES.some(p => normalized.includes(p))
      if (isHedge) confusedMoments++
    }
  }

  // Count repeated questions (same question asked 2+ times)
  const questionCounts = new Map<string, number>()
  for (const q of userQuestions) {
    if (q.length > 10) { // ignore very short messages
      questionCounts.set(q, (questionCounts.get(q) ?? 0) + 1)
    }
  }
  const repeatedQuestions = Array.from(questionCounts.values()).filter(c => c >= 2).length

  if (repeatedQuestions >= 2) frustrated = true

  return { frustrated, repeatedQuestions, confusedMoments }
}

function analyzeCore(messages: AnalysisMessage[], capabilities: ClientCapabilities): CallInsight {
  const unansweredQuestions = detectHedges(messages)
  const featureSuggestions = detectFeatures(messages, capabilities)
  const { frustrated, repeatedQuestions, confusedMoments } = detectFrustration(messages)

  return {
    unansweredQuestions,
    featureSuggestions,
    callerFrustrated: frustrated,
    repeatedQuestions,
    agentConfusedMoments: confusedMoments,
    source: 'keyword',
  }
}

// ─── Client Entry Point (browser-safe, R1) ────────────────────────────────────

/** Ultravox SDK transcript format */
interface UltravoxTranscript {
  speaker: 'user' | 'agent'
  text: string
  isFinal: boolean
}

/**
 * Analyze transcripts client-side for instant post-call feedback.
 * Runs in the browser — no API calls, no server imports.
 *
 * @param transcripts - Ultravox SDK transcript entries (from session.transcripts)
 * @param knowledge - AgentKnowledge from the settings card (what capabilities are enabled)
 * @returns CallInsight with detected gaps and suggestions
 */
export function analyzeTranscriptClient(
  transcripts: UltravoxTranscript[],
  knowledge: ClientCapabilities
): CallInsight {
  // Only analyze final transcripts (ignore in-progress partials)
  const messages: AnalysisMessage[] = transcripts
    .filter(t => t.isFinal)
    .map(t => ({ role: t.speaker === 'user' ? 'user' as const : 'agent' as const, text: t.text }))

  return analyzeCore(messages, capabilities(knowledge))
}

function capabilities(k: ClientCapabilities): ClientCapabilities {
  return k // already the right shape
}

// ─── Server Entry Point (webhook, R5-aware) ───────────────────────────────────

/** DB client row shape needed for server-side analysis */
export interface ServerClientConfig {
  id: string
  booking_enabled?: boolean | null
  forwarding_number?: string | null
  sms_enabled?: boolean | null
  office_hours?: unknown
  knowledge_backend?: string | null
  website_url?: string | null
  business_facts?: unknown
  extra_qa?: unknown
}

/**
 * Analyze a transcript server-side in the completed webhook.
 * Uses DB client config for capability detection.
 *
 * @param transcript - Transcript from getTranscript() (role/text messages)
 * @param config - Client row from DB with capability flags
 * @returns CallInsight for insertion into call_insights table
 */
export function analyzeTranscriptServer(
  transcript: Array<{ role: string; text: string }>,
  config: ServerClientConfig
): CallInsight {
  const messages: AnalysisMessage[] = transcript.map(t => ({
    role: t.role === 'user' ? 'user' as const : 'agent' as const,
    text: t.text || '',
  }))

  const caps: ClientCapabilities = {
    hasBooking: !!config.booking_enabled,
    hasTransfer: !!config.forwarding_number,
    hasSms: !!config.sms_enabled,
    hasHours: !!config.office_hours && typeof config.office_hours === 'object',
    hasKnowledge: config.knowledge_backend === 'pgvector',
    hasWebsite: !!config.website_url,
    hasFacts: Array.isArray(config.business_facts) && (config.business_facts as unknown[]).length > 0,
    hasFaqs: Array.isArray(config.extra_qa) && (config.extra_qa as unknown[]).length > 0,
  }

  return analyzeCore(messages, caps)
}

/**
 * Check if an insight is "empty" (nothing detected).
 * Use this to skip DB writes for calls with no actionable findings.
 */
export function isEmptyInsight(insight: CallInsight): boolean {
  return (
    insight.unansweredQuestions.length === 0 &&
    insight.featureSuggestions.length === 0 &&
    !insight.callerFrustrated &&
    insight.repeatedQuestions === 0 &&
    insight.agentConfusedMoments === 0
  )
}
