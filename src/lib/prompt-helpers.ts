// Extracted from prompt-builder.ts by phase2-extract.ts — DO NOT EDIT manually.

import { MODE_VARIABLE_OVERRIDES } from './prompt-config/mode-overrides'
import { wrapSection } from '@/lib/prompt-sections'

export function buildNicheFaqDefaults(niche: string, variables: Record<string, string>): string {
  const cp = variables.CLOSE_PERSON || 'our team'
  const ca = variables.CLOSE_ACTION || 'call ya back'

  const faqMap: Record<string, string[]> = {
    auto_glass: [
      `Are you a robot / AI? — yeah, I'm an AI assistant here at ${variables.BUSINESS_NAME || 'the shop'} — I can help with chip or crack repair quotes, full replacements, insurance questions, and scheduling. how can I help?`,
      `Can you fix a chip or does it need a full replacement? — depends on the size. if the chip is smaller than a quarter, we can usually repair it. anything bigger and it's likely a full replacement. ${cp}'ll ${ca} and let you know for sure once they see it.`,
      `Does insurance cover windshield replacement? — a lot of insurance plans do. we can give you a receipt for your claim. just bring your claim info when you come in and we'll help sort it out.`,
      `Do you work with SGI? — yeah, we work with SGI and also do regular payment. just bring your claim number when you come in.`,
      `Do you do mobile service? — ${variables.MOBILE_POLICY || "you'd bring it to us"}. we'll get you in and out as fast as we can.`,
      `How long does a windshield replacement take? — usually about an hour for the replacement itself, plus an hour cure time. so figure about two hours total.`,
      `What about the camera behind the mirror — does that need recalibrating? — if your vehicle has ADAS — that's the lane assist camera up by the rearview — yeah, it needs recalibration after a new windshield. we handle that.`,
      `Do I need the v-i-n? — it helps if you've got it handy, but if not, no worries — we can look it up with the year, make, and model.`,
      `What do I need to bring? — just the vehicle and your insurance claim number if you have one. we take care of the rest.`,
      `Are you open on weekends? — ${variables.WEEKEND_POLICY || "yeah we're open saturdays too. sundays we can sometimes do depending on how urgent it is"}.`,
      `How much does it cost? — depends on the year, make, and model. ${cp}'ll ${ca} with a quote once we know the details.`,
    ],
    hvac: [
      `Are you a robot / AI? — yeah, I'm an AI assistant here at ${variables.BUSINESS_NAME || 'the office'} — I can help with heating and cooling issues, maintenance requests, and scheduling. how can I help?`,
      `Do you handle emergencies? — yeah, if your furnace is out in the middle of winter or you have no AC on a hot day, let us know and we'll prioritize it.`,
      `How fast can someone come out? — depends on the day, but for emergencies we try to get someone there same day. ${cp}'ll ${ca} to lock in a time.`,
      `Do you do installs or just repairs? — both. whether it's a new furnace, a new AC unit, or fixing what you've got, we handle it.`,
      `What brands do you work on? — we work on most major brands. if you know the make and model, let us know and we'll confirm.`,
      `Should I get a tune-up? — yeah, seasonal tune-ups catch small problems before they turn into expensive ones. most people do it once before winter and once before summer.`,
      `I smell gas near my furnace — okay, call your gas company emergency line right now and get everyone out. once you're safe, call us back and we'll follow up.`,
      `My furnace is making a weird noise — could be a few things. don't worry about diagnosing it — just tell me your name and address and ${cp}'ll get someone out to take a look.`,
      `Do you come to me or do I come to you? — we come to you. all our service calls are on-site.`,
      `How much does it cost? — depends on the job. ${cp}'ll ${ca} with an estimate once we know what's going on.`,
    ],
    plumbing: [
      `Are you a robot / AI? — yeah, I'm an AI assistant here at ${variables.BUSINESS_NAME || 'the office'} — I can help with plumbing issues, scheduling, and messages. how can I help?`,
      `Do you handle emergencies? — yeah, if you've got a burst pipe, flooding, or no water at all, let us know right away and we'll get someone out there fast.`,
      `Do you do drain cleaning? — for sure. clogged drains, slow drains, sewer backups — we handle all of it.`,
      `Can you replace a water heater? — yeah, we do water heater installs and repairs. tank or tankless, we can sort it out.`,
      `My basement is flooding — okay, if you can, turn off the main water valve right now. then give me your name and address so we can get someone there fast.`,
      `How fast can someone come out? — for emergencies we try to get there same day. for routine stuff, ${cp}'ll ${ca} to book a time that works.`,
      `Do you come to me or do I come to you? — we come to you. all our work is on-site.`,
      `Do you do bathroom or kitchen renovations? — we handle the plumbing side of renos — ${cp}'ll ${ca} to discuss what you're looking for.`,
      `Is there a call-out fee? — ${cp}'ll go over all the pricing when they call you back. we keep things transparent.`,
      `How much does it cost? — depends on the job. ${cp}'ll ${ca} once we know what the issue is and can give you a proper estimate.`,
    ],
    dental: [
      `Are you a robot / AI? — yeah, I'm an AI assistant here at ${variables.BUSINESS_NAME || 'the office'} — I can help with appointments, emergencies, and questions. how can I help?`,
      `Are you accepting new patients? — yeah, we're taking new patients. we'll just need a bit of info to get you set up.`,
      `Do you take my insurance? — ${variables.INSURANCE_STATUS || 'we work with most dental insurance'}. ${variables.INSURANCE_DETAIL || "just bring your insurance card and we'll sort it out"}.`,
      `Can I get in today for an emergency? — if you're in pain, let us know and we'll do our best to get you in same day. emergencies always get priority.`,
      `Do you do cosmetic work like whitening or veneers? — we offer a range of cosmetic services. ${cp}'ll ${ca} to go over your options and book an appointment.`,
      `I broke my tooth — okay, that's urgent. tell me your name and ${cp}'ll call you back right away to get you in.`,
      `Do you do kids' dentistry? — yeah, we see patients of all ages. just let me know the child's name and age and we'll get them booked in.`,
      `Can I get a referral to a specialist? — for sure. ${cp}'ll ${ca} to discuss what you need and point you to the right specialist.`,
      `What are your hours? — ${variables.WEEKEND_POLICY || "we're open weekdays and can share exact hours when we call back"}.`,
      `How much does a cleaning cost? — pricing depends on whether you have insurance and what's included. ${cp}'ll ${ca} with the details.`,
    ],
    legal: [
      `Are you a robot / AI? — yeah, I'm an AI assistant here at ${variables.BUSINESS_NAME || 'the firm'} — I can take messages, log consultation requests, and pass along urgent matters. how can I help?`,
      `Do you offer a free consultation? — ${variables.INSURANCE_STATUS || 'we offer a free initial consultation'}. ${variables.INSURANCE_DETAIL || "the first call is on us — no obligation"}.`,
      `What areas of law do you cover? — we handle a range of areas. let us know what your situation is about and we'll make sure you talk to the right person.`,
      `Do I need to book an appointment? — yeah, it's best to book a time so one of our lawyers can give you their full attention. ${cp}'ll ${ca} to set that up.`,
      `I've been served with papers — I understand, that can be stressful. let me grab your info so ${cp} can call you back right away.`,
      `Is this conversation confidential? — yes, everything you share here is treated as confidential and passed only to the lawyer handling your matter.`,
      `Can I bring someone with me to the meeting? — for sure, that's totally fine. ${cp}'ll go over the details when they call back.`,
      `How long is a consultation? — typically 30 minutes to an hour, depending on the complexity. enough time to understand your situation and outline your options.`,
      `How much do you charge? — depends on the matter. ${cp}'ll ${ca} to discuss the details and let you know about fees upfront.`,
    ],
    salon: [
      `Are you a robot / AI? — yeah, I'm an AI assistant here at ${variables.BUSINESS_NAME || 'the salon'} — I can help with bookings, service questions, and messages. how can I help?`,
      `Do you take walk-ins? — we do when there's availability, but booking ahead is the best way to guarantee your spot.`,
      `Do you do color and highlights? — for sure. full color, highlights, balayage — we do it all. ${cp}'ll ${ca} to talk about what you're looking for and get you booked.`,
      `Can I request a specific stylist? — yeah, just let us know who you'd like and we'll check their availability.`,
      `Do you do men's cuts? — yeah, we do cuts for everyone.`,
      `I need to cancel or reschedule — no worries. what's your name and when was your appointment? I'll pass that along and ${cp}'ll sort it out.`,
      `Do you sell hair products? — we carry a selection of professional products in the salon. feel free to ask about them when you come in.`,
      `Are you open on weekends? — ${variables.WEEKEND_POLICY || 'yeah we do weekend appointments — usually book up fast though'}.`,
      `Do you do bridal / special event styling? — for sure. ${cp}'ll ${ca} to discuss what you need and get you set up.`,
      `How much does a haircut cost? — depends on the service. ${cp}'ll ${ca} to go over pricing and get you booked.`,
    ],
    property_management: [
      `Are you a robot / AI? — yeah, I'm an AI assistant for ${variables.BUSINESS_NAME || 'the property management office'}. I can help with maintenance requests, rental inquiries, billing questions, viewings, and messages for ${cp} — everything gets passed to the right person.`,
      `What can you do? — I can log maintenance requests, flag emergencies, handle rental inquiries, take down billing or payment questions, help with viewings, and pass messages to ${cp}. everything goes to the right person.`,
      `What properties do you manage? — residential rentals in ${variables.CITY || 'the area'}. ${cp}'ll call ya back with what's currently available.`,
      `How do I report an emergency? — tell me your name, unit, and what's happening — i'll flag it urgent right now and ${cp} will call you back asap.`,
      `How do I pay rent? — ${cp} handles all the payment details — let me grab your name and they'll call you back.`,
      `Is there a unit available? — ${cp} will have the latest availability — let me grab your name and they'll be in touch.`,
      `Can I do a viewing? — yes for sure — what's your name? ${cp} will call you back to arrange a time.`,
      `Are pets allowed? — that's up to ${cp} and depends on the unit — let me grab your name and they'll sort that out with you.`,
      `Is parking included? — ${cp} can go over everything that's included when they call — what's your name?`,
      `What utilities are included? — depends on the unit — ${cp} will walk you through it. what's your name?`,
      `Do you manage commercial properties? — residential only — but I can have ${cp} point you in the right direction if you need a referral.`,
      `My landlord entered without notice / Can my landlord do that? — I'll pass that along to ${cp} — what's your name?`,
      `How do I break my lease? — ${cp} can walk you through your options — what's your name?`,
    ],
    barbershop: [
      `Are you a robot / AI? — yeah, i'm an AI assistant at ${variables.BUSINESS_NAME || 'the barbershop'} — i can help with booking appointments and answering questions. how can i help?`,
      `How much does a haircut cost? — cuts start from ${variables.PRICE_RANGE || 'contact us for pricing'}. ${cp}'ll confirm the exact total when you come in, depending on the style.`,
      `Do you take walk-ins? — ${variables.WALK_IN_POLICY || 'yeah, walk-ins are welcome'}. if you want a guaranteed slot, i can book you in right now.`,
      `How long does a haircut take? — usually about 30 to 45 minutes depending on the style. a beard trim on top adds another 15 or so.`,
      `Do you do kids' cuts? — yeah, kids' cuts are available. ${cp}'ll confirm pricing when you come in.`,
      `Do you do beard trims or straight razor shaves? — yeah, beard trims for sure. straight razor shaves depend on the barber — i'll note your preference when we book.`,
      `Can I request a specific barber? — i can't check individual schedules from here, but i'll note your preference and ${cp}'ll do their best to accommodate.`,
      `Can I book online? — i can book you right now on this call. just tell me what service and what day works for you.`,
      `Do you take card payments? — yeah, we take card. ${cp}'ll confirm the payment options when you come in.`,
      `Can I cancel or reschedule? — yeah for sure — just give us a call. what's your name and when was your appointment?`,
      `Are you open on weekends? — ${variables.WEEKEND_POLICY || "yeah we're usually open saturdays — the owner can confirm the exact hours"}.`,
    ],
  }

  const lines = faqMap[niche]
  if (!lines) return ''
  return lines.join('\n')
}

// ── Print shop FAQ (dynamic — uses intake fields) ────────────────────────────

export function buildPrintShopFaq(intake: Record<string, unknown>, _variables: Record<string, string>): string {
  const rushCutoff = ((intake.niche_rushCutoffTime as string) || '10 AM').trim()
  const pickupOnly = intake.niche_pickupOnly !== false
  const designOffered = intake.niche_designOffered !== false
  const websiteUrl = ((intake.niche_websiteUrl as string) || '').trim()
  const emailAddress = ((intake.niche_emailAddress as string) || '').trim()

  const faqLines: string[] = [
    `How much are coroplast yard signs? — a standard 2 by 2 single-sided starts at $32, a 2 by 4 is $64, and a 4 by 8 is $240. custom sizes are $8 a square foot${websiteUrl ? `. for exact pricing, the online estimator at ${websiteUrl} gives you the number right away` : ''}.`,
    `How much are vinyl banners? — a 2 by 4 banner starts at $66, a 3 by 6 is $135, and a 4 by 8 is $216. custom sizes are about $8.25 a square foot.`,
    `How much are business cards? — 250 double-sided on 14-point gloss — $45.`,
    `How much are flyers? — 100 full-colour sheets — $45.`,
    `How much are retractable banners? — economy starts at $219, deluxe is $299 — both include a carry case.`,
    `How much are ACP aluminum signs? — those run about $13 a square foot — stronger and more permanent than coroplast.`,
    designOffered
      ? `Do you do design? — yeah, we've got a designer on site. $35 flat to build a layout or clean up your files, and you'll get a proof same day.`
      : `Do you do design? — the team can point you in the right direction when they call back.`,
    `Do you do rush orders? — yeah, same-day rush is $40 on top and you'd need your order in before ${rushCutoff}. after that we're usually looking at next business day.`,
    `What's the turnaround time? — standard is 1 to 3 business days after your artwork is approved.`,
    pickupOnly
      ? `Do you deliver or ship? — we're pickup only${websiteUrl ? `. easiest way to order is online at ${websiteUrl}` : ''}.`
      : `Do you deliver or ship? — the team can sort that out when they call you back.`,
    `What file format do you need? — PDF works great, or an AI or vector file is even better.${designOffered ? ' if you don\'t have anything ready, our designer can take care of it for $35.' : ''}`,
    `Can I reorder something I got before? — for sure — if you know roughly what you got, i'll have the team look it up and call ya back.`,
  ]
  if (emailAddress) {
    faqLines.push(`How do I send my files? — email them to ${emailAddress} and the team will confirm they got it.`)
  }
  if (websiteUrl) {
    faqLines.push(`Can I order online? — yep — ${websiteUrl} has a live estimator where you can place the order right now.`)
  }
  return faqLines.join('\n')
}

// ── Knowledge base builder ────────────────────────────────────────────────────

export function buildKnowledgeBase(callerFaq: string, _niche: string): string {
  const lines: string[] = []

  if (callerFaq?.trim()) {
    for (const entry of callerFaq.trim().split('\n')) {
      const trimmed = entry.trim()
      if (!trimmed) continue

      let matched = false
      for (const sep of [' — ', ' - ', ': ', '?']) {
        if (trimmed.includes(sep)) {
          const parts = trimmed.split(sep)
          const q = parts[0].trim().replace(/\?$/, '') + '?'
          const a = parts.slice(1).join(sep).trim().replace(/^["']|["']$/g, '')
          lines.push(`**${q}** "${a}"`)
          matched = true
          break
        }
      }
      if (!matched) {
        lines.push(`**Common question:** "${trimmed}"`)
      }
    }
  }

  if (lines.length === 0) {
    lines.push(`**What services do you offer?** "we handle all the usual stuff — i'll have our team call ya back with the specifics."`)
  }

  return lines.join('\n\n')
}

// ── After-hours block builder ─────────────────────────────────────────────────

export function buildAfterHoursBlock(behavior: string, emergencyPhone?: string): string {
  switch (behavior) {
    case 'route_emergency':
      return emergencyPhone
        ? `When callers reach you outside business hours, check if it's urgent. If urgent, tell them to call ${emergencyPhone}. If not urgent, take a message and let them know someone will call back during business hours.`
        : 'When callers reach you outside business hours, check if it\'s urgent. If urgent, route to callback immediately and flag as [URGENT]. If not urgent, take a message and let them know someone will call back during business hours.'
    case 'take_message':
      return 'When callers reach you outside business hours, take a message and let them know someone will call back during business hours.'
    default:
      return ''
  }
}

// ── Calendar booking block (injected when booking_enabled=true) ───────────────

export function buildCalendarBlock(serviceType: string, closePerson: string): string {
  return `
# CALENDAR BOOKING FLOW

Use this when a caller wants to book a ${serviceType} directly on the call.

Step 1 — Ask what day works: "what day were you thinking?"
Step 2 — Check slots: say "one sec, let me pull that up..." in that SAME turn, then call checkCalendarAvailability with date in YYYY-MM-DD format. Use TODAY from callerContext to resolve "tomorrow", "next Monday", etc.
Step 3 — If caller already named a specific time AND that time appears in the slots: skip listing — go straight to "perfect, let me grab that [time] for you..." and proceed to Step 4. Only list up to 3 options when the caller has NOT named a time, or when their requested time is unavailable.
Step 4 — If name not yet collected: "and your name?"
Step 5 — Book it: say "perfect, booking that now..." in the SAME turn as calling bookAppointment with:
  - date: YYYY-MM-DD
  - time: EXACTLY the displayTime from checkCalendarAvailability (do not reformat)
  - service: "${serviceType}"
  - callerName: caller's name
  - callerPhone: the CALLER PHONE from callerContext — always include this
Step 6 — Confirm and close: "you're booked — [day] at [time]. ${closePerson} will reach out before then!" → hangUp

SLOT TAKEN (booked=false, nextAvailable present): "that one just got taken — the next opening I've got is [nextAvailable]. does that work?"
DAY FULL (available=false or no slots): say "looks like we're full that day — let me check the next one..." then call checkCalendarAvailability for the following day. If also full, fall back to message mode.
TOOL ERROR (fallback=true or no response): fall back to message mode — collect preferred day/time and close as normal.`.trim()
}

// ── Agent-mode variable overrides ────────────────────────────────────────────

export function applyModeVariableOverrides(
  effectiveMode: string,
  variables: Record<string, string>,
): { modeForbiddenExtra: string; modeTriageDeep: string; modeForcesTriageDeep: boolean } {
  const overrides = MODE_VARIABLE_OVERRIDES[effectiveMode]
  if (!overrides) return { modeForbiddenExtra: '', modeTriageDeep: '', modeForcesTriageDeep: false }

  // Variable overrides: only apply when variable is not already set by niche or intake.
  // Modes that redefine call intent (voicemail_replacement, info_hub, appointment_booking) force-override
  // behavioral fields regardless of niche, because mode intent must win over niche collection behavior.
  // lead_capture has no overrides and continues to defer entirely to niche.
  const FORCE_OVERRIDE_FIELDS: Partial<Record<string, ReadonlyArray<string>>> = {
    appointment_booking: ['COMPLETION_FIELDS', 'CLOSE_ACTION', 'FIRST_INFO_QUESTION', 'INFO_TO_COLLECT'],
    voicemail_replacement: ['COMPLETION_FIELDS', 'CLOSE_ACTION', 'FIRST_INFO_QUESTION', 'INFO_TO_COLLECT'],
    info_hub: ['COMPLETION_FIELDS', 'CLOSE_ACTION', 'FIRST_INFO_QUESTION', 'INFO_TO_COLLECT'],
  }
  const forced = FORCE_OVERRIDE_FIELDS[effectiveMode] ?? []
  const varFields = ['COMPLETION_FIELDS', 'CLOSE_ACTION', 'FIRST_INFO_QUESTION', 'INFO_TO_COLLECT'] as const
  for (const field of varFields) {
    if (overrides[field] && (!variables[field] || forced.includes(field))) {
      variables[field] = overrides[field]!
    }
  }

  return {
    modeForbiddenExtra: overrides.FORBIDDEN_EXTRA ?? '',
    modeTriageDeep: overrides.TRIAGE_DEEP ?? '',
    modeForcesTriageDeep: forced.length > 0 && !!overrides.TRIAGE_DEEP,
  }
}

// ── Section wrapper helper ────────────────────────────────────────────────────

export function wrapSectionIfPresent(prompt: string, startHeading: string, endHeading: string | null, sectionId: string): string {
  const startIdx = prompt.indexOf(startHeading)
  if (startIdx === -1) return prompt
  const endIdx = endHeading ? prompt.indexOf(endHeading, startIdx + 1) : -1
  const sectionContent = endIdx !== -1
    ? prompt.slice(startIdx, endIdx).trimEnd()
    : prompt.slice(startIdx).trimEnd()
  const wrapped = wrapSection(sectionContent, sectionId)
  if (endIdx !== -1) {
    return prompt.slice(0, startIdx) + wrapped + '\n\n' + prompt.slice(endIdx)
  }
  return prompt.slice(0, startIdx) + wrapped
}
