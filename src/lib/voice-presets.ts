/**
 * voice-presets.ts — Voice style preset definitions.
 *
 * Extracted from prompt-builder.ts to avoid pulling the entire 2100-line
 * prompt builder into routes that only need preset lookups (e.g. settings-patchers).
 *
 * prompt-builder.ts re-exports from this file for backwards compatibility.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Go Live tab voice catalog audit
// ─────────────────────────────────────────────────────────────────────────────
//
// EXPERIMENTAL_VOICES is a list of Ultravox voiceIds whose preview audio
// cannot be reliably played back through `/api/dashboard/voices/[voiceId]/preview`.
//
// The full Ultravox catalog is fetched at runtime from `/api/dashboard/voices`
// and proxied through that route (the upstream `previewUrl` requires an
// `X-API-Key` header that browsers cannot send, hence the proxy).
//
// Audit criterion (default): a voiceId is added here when its proxy preview
// is empirically known to return a non-audio response or hang. We do NOT have
// a static URL HEAD check for the full upstream catalog at import time — the
// catalog is dynamic.
//
// Used by:
//   - <VoicePickerCompact /> in the Go Live tab — filters EXPERIMENTAL voices out.
//   - The deep settings VoicePicker / VoiceTab also read the audited catalog.
//
// Add a voiceId here only after manual confirmation that its preview fails.
// Removing a voiceId here re-exposes it on Go Live with no other change.
//
// Default: empty. The Go Live picker additionally cross-references
// GO_LIVE_VOICES (below) — a curated catalog of voices that have been
// confirmed to work end-to-end (preview + production calls). When the
// upstream Ultravox catalog has not been audited, only voices in
// GO_LIVE_VOICES are shown on Go Live.
//
export const EXPERIMENTAL_VOICES: string[] = [
  '441ec053-5566-4d18-9752-452dd5120071', // Elilhiz-English
  '87edb04c-06d4-47c2-bd94-683bc47e8fbe', // Monika-English-Indian
  '7c125579-a8b9-46ba-887b-60e4f0449e5d', // Raju-English-Indian
  'bd2118e8-84fc-4d6f-8038-bb5e25e3f398', // linny
  '813f0a80-2dc5-4019-af72-11237a2b74d5', // Steve-English-Australian
  '87691b77-0174-4808-b73c-30000b334e14', // Emily-English
  '1769b283-36c6-4883-9c52-17bf75a29bc5', // Tanya-English
  'feccf00b-417e-4e7a-9f89-62f537280334', // Aaron-English
  'e6fce4ac-da54-43e9-8fb2-66de86f72a5b', // Conversationalist-English
  'ac329809-3b43-4ab7-a16a-b40448212e1c', // Dakota Flash V2
  '54ebeae1-88df-4d66-af13-6c41283b4332', // Chelsea
  '3abe60f5-13ed-4e82-ac15-4391d9e5cd9d', // Oliver
  'b0e6b5c1-3100-44d5-8578-9015aa3023ae', // Jessica / stale Mark ID
  '91fa9bcf-93c8-467c-8b29-973720e3f167', // Mark
  'dcb65d6e-9a56-459e-bf6f-d97572e2fe64', // terrence
  'ede629be-f7cf-48a2-a7e6-ee2c50785b5d', // lily
]

/**
 * GO_LIVE_VOICES — curated catalog used by the Go Live tab voice picker.
 *
 * Mirrors the onboarding GenderVoicePicker (`src/components/onboard/GenderVoicePicker.tsx`)
 * — these are the voiceIds that have shipped to production clients and have
 * verified preview playback through `/api/dashboard/voices/[voiceId]/preview`.
 *
 * The deep settings page (`VoicePicker`/`VoiceTab`) and public voice library
 * also use this curated list so customers do not see unverified previews.
 */
export interface GoLiveVoice {
  voiceId: string
  name: string
  gender: 'female' | 'male'
  vibe: string
}

export type VoiceGender = 'female' | 'male' | 'unknown'

export const UNPLAYABLE_PREVIEW_VOICE_IDS = new Set(EXPERIMENTAL_VOICES)

const FEMALE_NAME_HINTS = [
  'monika', 'ashley', 'jacqueline', 'olivia', 'sarah', 'luna', 'deborah',
  'hana', 'hannah', 'emily', 'tanya', 'claire', 'wendy', 'priya', 'pixie',
  'julia', 'cassidy', 'noushin', 'paulina', 'cheyenne', 'louisamay',
  'elizabeth', 'kai', 'gabrielle', 'karri', 'veronica', 'jess',
]

const MALE_NAME_HINTS = [
  'mark', 'grant', 'shaun', 'blake', 'dennis', 'timothy', 'brandon',
  'clive', 'arlo', 'matt', 'eanna', 'chris', 'carter', 'alex', 'craig',
  'edward', 'hades', 'ronald', 'aaron', 'steve', 'muyiwa', 'david', 'troy',
]

export function inferVoiceGender(name: string, description = ''): VoiceGender {
  const normalizedDescription = description.toLowerCase()
  const normalizedName = name.toLowerCase()

  if (/\bfemale\b|\bwoman\b|\bwomen\b/.test(normalizedDescription)) return 'female'
  if (/\bmale\b|\bman\b|\bmen\b/.test(normalizedDescription)) return 'male'
  if (FEMALE_NAME_HINTS.some(hint => normalizedName.includes(hint))) return 'female'
  if (MALE_NAME_HINTS.some(hint => normalizedName.includes(hint))) return 'male'
  return 'unknown'
}

export const GO_LIVE_VOICES: GoLiveVoice[] = [
  // Female
  { voiceId: 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', name: 'Jacqueline', gender: 'female', vibe: 'Warm, friendly, empathetic' },
  { voiceId: '33175488-b0f9-4f11-a0c6-3f4edd47353e', name: 'Gabrielle',  gender: 'female', vibe: 'Clear, friendly, upbeat' },
  { voiceId: 'df0b14d7-945f-41b2-989a-7c8c57688ddf', name: 'Ashley',     gender: 'female', vibe: 'Calm, professional, reassuring' },
  // Male
  { voiceId: 'ef6757de-79b1-497b-ad54-c6bef635e2b7', name: 'David', gender: 'male', vibe: 'Clear, direct, professional' },
  { voiceId: 'd766b9e3-69df-4727-b62f-cd0b6772c2ad', name: 'Nour',  gender: 'male', vibe: 'Warm, patient, trustworthy' },
  { voiceId: '5f8e97b1-cd48-431a-b6a1-3b94306d8914', name: 'Grant', gender: 'male', vibe: 'Confident, authoritative, steady' },
]

export interface VoicePreset {
  id: string
  label: string
  description: string
  /** Personality adjectives injected into IDENTITY section (e.g. "Upbeat and relaxed.") */
  personalityLine: string
  toneStyleBlock: string
  fillerStyle: string
  greetingLine: string
  closingLine: string
  closePerson?: string
}

export const VOICE_PRESETS: Record<string, VoicePreset> = {
  casual_friendly: {
    id: 'casual_friendly',
    label: 'Casual & Friendly',
    description: 'Warm, upbeat, uses natural fillers and slang. Great for trades, auto shops, and small businesses.',
    personalityLine: 'Upbeat and relaxed. Friendly and easygoing. Sounds like a real person at the front desk, not a robot.',
    toneStyleBlock: [
      'Upbeat and alert. Sound relaxed but sharp — never tired or flat.',
      'Speak at a relaxed, natural speed. Slow down slightly when confirming important info.',
      'Keep responses very short — 1 to 2 sentences max. Punchy and direct.',
      'Use contractions always: gotta, lemme, wanna, ya.',
      'Use natural fillers sparingly: yeah, right, gotcha, alright, mmhmm, okay.',
      'Speak in lowercase. Minimal punctuation.',
    ].join('\n'),
    fillerStyle: [
      'Start every response with a quick backchannel before your actual answer: "mmhmm...", "gotcha...", "right...", "yeah..."',
      'Use "uh" or "um" once or twice per call when transitioning topics — never more.',
    ].join('\n'),
    greetingLine: `"{{BUSINESS_NAME}} — this is {{AGENT_NAME}}, an AI assistant. How can I help ya today?"`,
    closingLine: `"alright, i'll let {{CLOSE_PERSON}} know — they'll call you back at the number you called from. talk soon."`,
  },
  professional_warm: {
    id: 'professional_warm',
    label: 'Professional & Warm',
    description: 'Polished but approachable. No slang, measured pace. Good for real estate, law offices, medical, and corporate.',
    personalityLine: 'Warm and professional. Confident and knowledgeable. Sounds polished but genuinely approachable.',
    toneStyleBlock: [
      'Warm and professional. Sound confident and knowledgeable — friendly but polished.',
      'Speak at a measured, natural speed. Slow down slightly when confirming important info.',
      'Keep responses very short — 1 to 2 sentences max. Clear and direct.',
      "Use standard contractions: \"I'll\", \"he'll\", \"that's\", \"we're\". Avoid slang like \"gonna\", \"kinda\", \"wanna\", \"ya\", \"lemme\".",
      'Use clean professional phrases: "sure thing", "no problem", "of course", "got it", "right".',
      'No filler words like "like", "uh", or "um". Keep sentences clean and direct.',
      'Speak clearly. Proper punctuation and capitalization.',
    ].join('\n'),
    fillerStyle: [
      'Start responses with a brief acknowledgment before your answer: "sure...", "got it...", "right..."',
      'Avoid "uh", "um", "mmhmm", and casual fillers entirely. Use deliberate pauses instead.',
    ].join('\n'),
    greetingLine: `"Hi there, this is {{AGENT_NAME}}, {{CLOSE_PERSON}}'s assistant. How can I help you?"`,
    closingLine: `"I'll pass this along to {{CLOSE_PERSON}} — they'll call you back at the number you called from. Have a great day."`,
  },
  direct_efficient: {
    id: 'direct_efficient',
    label: 'Direct & Efficient',
    description: 'Minimal small talk, gets to the point fast. Good for high-volume shops and busy offices.',
    personalityLine: 'Sharp and no-nonsense. Gets straight to the point. Efficient and competent.',
    toneStyleBlock: [
      'Direct and efficient. No unnecessary pleasantries — get to the point.',
      'Speak at a brisk, confident pace. Do not slow down unless confirming critical info.',
      'Keep responses extremely short — 1 sentence preferred. Never exceed 2.',
      "Use standard contractions: \"I'll\", \"we'll\", \"they'll\". Avoid slang.",
      'No fillers. No backchannels. Respond with substance immediately.',
      'Speak clearly and crisply.',
    ].join('\n'),
    fillerStyle: [
      'Do not start with backchannels or fillers. Jump straight to your answer.',
      'Never use "uh", "um", "mmhmm", or "gotcha". Get to the point.',
    ].join('\n'),
    greetingLine: `"{{BUSINESS_NAME}}, {{AGENT_NAME}} speaking. How can I help?"`,
    closingLine: `"Got it. {{CLOSE_PERSON}} will call you back. Thanks."`,
  },
  empathetic_care: {
    id: 'empathetic_care',
    label: 'Empathetic & Patient',
    description: 'Extra validation, slower pace, gentle tone. Good for healthcare, dental, property management, and senior services.',
    personalityLine: 'Warm and patient. Gentle and reassuring. Makes callers feel heard and cared for.',
    toneStyleBlock: [
      'Warm, patient, and empathetic. Make the caller feel heard and cared for.',
      'Speak at a slower, gentle pace. Give the caller time to respond.',
      'Keep responses short — 1 to 2 sentences max. Soft and reassuring.',
      "Use standard contractions: \"I'll\", \"we're\", \"they'll\". Gentle language.",
      'Use validating phrases: "I hear you", "no rush", "take your time", "that makes sense".',
      'Speak softly and warmly. Avoid being abrupt.',
    ].join('\n'),
    fillerStyle: [
      'Start responses with a gentle acknowledgment: "I hear you...", "okay...", "no worries...", "of course..."',
      'Use brief pauses between thoughts. Never rush.',
    ].join('\n'),
    greetingLine: `"Hi there, you've reached {{BUSINESS_NAME}}. This is {{AGENT_NAME}}, an AI assistant. How can I help you today?"`,
    closingLine: `"I'll make sure {{CLOSE_PERSON}} gets your message — they'll call you back soon. Take care."`,
  },
}
