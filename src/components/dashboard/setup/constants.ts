// ── Mobile carrier data ───────────────────────────────────────────────────────

export const CARRIERS = [
  // Big 3
  { id: 'rogers',       name: 'Rogers' },
  { id: 'bell',         name: 'Bell' },
  { id: 'telus',        name: 'Telus' },
  // Sub-brands
  { id: 'chatr',        name: 'Chatr (Rogers network)' },
  { id: 'fido',         name: 'Fido (Rogers network)' },
  { id: 'freedom',      name: 'Freedom Mobile' },
  { id: 'koodo',        name: 'Koodo (Telus network)' },
  { id: 'lucky-mobile', name: 'Lucky Mobile (Bell network)' },
  { id: 'pc-mobile',    name: 'PC Mobile (Bell network)' },
  { id: 'public-mobile',name: 'Public Mobile (Telus network)' },
  { id: 'videotron',    name: 'Videotron' },
  { id: 'virgin-plus',  name: 'Virgin Plus (Bell network)' },
  { id: 'other',        name: 'Other / Unlisted' },
]

export const CARRIER_NOTES: Record<string, string[]> = {
  'rogers':        ['Conditional forwarding won\'t work if voicemail is active on your plan. Disable voicemail first if needed.'],
  'fido':          ['Conditional forwarding is not available when Voice Messaging is active on your account.', 'To disable forwarding: use ##61#, ##62#, ##67# (double hash) instead of the single-hash codes below.'],
  'koodo':         ['Call Forwarding requires adding the add-on first (~$3–5/month). Do this in the My Koodo app before dialing these codes.', 'Prepaid accounts: only the Unreachable (*62*) forward is available.'],
  'public-mobile': ['Call forwarding is free on all Public Mobile plans — no add-on needed.', 'You must be on the Public Mobile network in Canada when setting this up.'],
  'other':         ['These are standard GSM codes used by most Canadian and international carriers. If the codes don\'t work, contact your carrier to enable conditional call forwarding on your account.'],
}

// Fido/Chatr use double-hash for disable codes
export const FIDO_DISABLE = new Set(['fido', 'chatr'])

// ── Landline carrier data ─────────────────────────────────────────────────────

export const LANDLINE_CARRIERS = [
  { id: 'rogers-business', name: 'Rogers Business / Shaw Business' },
  { id: 'bell-business',   name: 'Bell Business' },
  { id: 'sasktel',         name: 'SaskTel (IBC)' },
  { id: 'telus-wireline',  name: 'Telus Business (wireline)' },
  { id: 'cogeco',          name: 'Cogeco Business' },
  { id: 'other-landline',  name: 'Other Landline' },
]

export type LandlineCodes = {
  noAnswerOn: string | null
  noAnswerOff: string | null
  busyOn: string | null
  busyOff: string | null
  unconditionalOn: string | null
  unconditionalOff: string | null
  process: string
}

export const LANDLINE_CODES: Record<string, LandlineCodes> = {
  'rogers-business': {
    noAnswerOn: '*92', noAnswerOff: '*93',
    busyOn: '*90', busyOff: '*91',
    unconditionalOn: '*72', unconditionalOff: '*73',
    process: 'Pick up the receiver → dial the code followed by the 10-digit destination number → wait for the stutter/confirmation tone → hang up.',
  },
  'bell-business': {
    noAnswerOn: '*92', noAnswerOff: '*93',
    busyOn: '*90', busyOff: '*91',
    unconditionalOn: '*72', unconditionalOff: '*73',
    process: 'Pick up the receiver → dial the code followed by the 10-digit destination number → wait for the stutter/confirmation tone → hang up.',
  },
  'sasktel': {
    noAnswerOn: '*92', noAnswerOff: '*93',
    busyOn: '*90', busyOff: '*91',
    unconditionalOn: '*72', unconditionalOff: '*73',
    process: 'Pick up the receiver → dial the code followed by the 10-digit destination number → wait for the confirmation announcement → hang up.',
  },
  'telus-wireline': {
    noAnswerOn: '*72', noAnswerOff: '*73',
    busyOn: null, busyOff: null,
    unconditionalOn: '*72', unconditionalOff: '*73',
    process: 'Dial *72 followed by the 10-digit destination number → the destination phone will ring → answer it to confirm activation. If it doesn\'t ring, try #72 instead.',
  },
  'cogeco': {
    noAnswerOn: '*72', noAnswerOff: '*73',
    busyOn: null, busyOff: null,
    unconditionalOn: '*72', unconditionalOff: '*73',
    process: 'Pick up the receiver → dial the code followed by the 10-digit destination number → wait for the stutter/confirmation tone → hang up.',
  },
  'other-landline': {
    noAnswerOn: '*72', noAnswerOff: '*73',
    busyOn: null, busyOff: null,
    unconditionalOn: '*72', unconditionalOff: '*73',
    process: 'Pick up the receiver → dial the code followed by the 10-digit destination number → wait for the stutter/confirmation tone → hang up.',
  },
}

export const LANDLINE_NOTES: Record<string, string[]> = {
  'rogers-business': [
    'Call waiting is disabled while Call Forward is active on your line.',
    'If your plan uses Multi-line Hunting, manage forwarding only from the primary line.',
    'Forwarding works to Canadian and US numbers only.',
  ],
  'bell-business': [
    'Forwarding works to Canadian and US numbers only.',
    'Contact Bell Business at 1-800-667-0123 if the star codes don\'t activate on your line.',
  ],
  'sasktel': [
    'Optional: set ring count before forwarding — dial *92N [number] where N = rings (0–9). Example: *923 3065551234 = forward after 3 rings.',
    'You can also manage forwarding via the SaskTel IBC web portal.',
  ],
  'telus-wireline': [
    'Important: after dialing *72, the destination phone must physically ring and be answered to confirm activation.',
    'If the destination phone doesn\'t answer, call back and try again, or use Option B (call Telus support) below.',
    'If *72 doesn\'t work, try #72 — Telus uses both codes depending on the line type.',
  ],
  'cogeco': [
    'Contact Cogeco Business at 1-855-812-4484 if the codes don\'t work on your plan.',
    'Some Cogeco business plans require the Call Forwarding feature to be added first.',
  ],
  'other-landline': [
    'These are standard NANP star codes used by most North American landline carriers.',
    'If the codes don\'t work, contact your carrier\'s business support and ask to enable "Call Forward No Answer" to an external number.',
  ],
}

// ── VoIP platform data ────────────────────────────────────────────────────────

export const VOIP_PLATFORMS = [
  { id: 'ringcentral',    name: 'RingCentral' },
  { id: 'ooma',          name: 'Ooma Office' },
  { id: 'grasshopper',   name: 'Grasshopper' },
  { id: '8x8',           name: '8x8 Work / Express' },
  { id: 'vonage',        name: 'Vonage Business' },
  { id: 'telus-connect', name: 'Telus Business Connect' },
  { id: 'other-voip',    name: 'Other VoIP System' },
]

export const VOIP_INSTRUCTIONS: Record<string, { steps: string[]; note?: string }> = {
  'ringcentral': {
    steps: [
      'Log in to your RingCentral Admin Portal',
      'Go to Settings → Phone → Call Handling & Forwarding',
      'Under "When not answered", select Forward to external number',
      'Enter your AI agent number and save',
    ],
  },
  'ooma': {
    steps: [
      'Log in to Ooma Office Manager',
      'Go to Extensions → select your extension → Call Routing',
      'Under "No Answer", select Forward to external number',
      'Enter your AI agent number and save',
    ],
  },
  'grasshopper': {
    steps: [
      'Log in to your Grasshopper dashboard',
      'Go to Extensions → select your extension → Call Forwarding',
      'Under "No Answer", add your AI agent number as a forwarding destination',
      'Save changes',
    ],
  },
  '8x8': {
    steps: [
      'Log in to 8x8 Admin Console',
      'Go to Users → select the user → Call Forwarding Rules',
      'Set "No Answer Forwarding" to forward to your AI agent number',
      'Save and apply',
    ],
  },
  'vonage': {
    steps: [
      'Log in to the Vonage Business Admin Portal',
      'Go to Extensions → select your extension → Call Settings',
      'Find "Call Forwarding on No Answer" and enter your AI agent number',
      'Save changes',
    ],
  },
  'telus-connect': {
    steps: [
      'Log in to the Telus Business Connect Admin portal',
      'Go to Extensions → select your extension → Inbound Rules',
      'Under "No Answer", select Forward to External and enter your AI agent number',
      'Save and apply',
    ],
  },
  'other-voip': {
    steps: [
      'Log in to your VoIP system\'s admin portal',
      'Look for: Call Forwarding, Call Routing, or Call Handling settings',
      'Find the "No Answer" or "Unanswered" option and set it to forward to an external number',
      'Enter your AI agent number — any 10-digit North American number is supported',
    ],
    note: 'Can\'t find the setting? Contact your VoIP provider\'s support and ask to "forward unanswered calls to an external number."',
  },
}
