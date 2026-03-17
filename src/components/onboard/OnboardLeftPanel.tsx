'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

const BUILD_PHRASES: Record<string, string[]> = {
  real_estate: [
    "Learning your service area and provinces…",
    "Understanding buyer vs. seller lead routing…",
    "Configuring HOT lead escalation paths…",
    "Setting up after-hours coverage…",
    "Personalizing your agent's greeting…",
  ],
  auto_glass: [
    "Learning windshield vs. chip repair triage…",
    "Configuring emergency mobile dispatch routing…",
    "Setting up insurance claim intake questions…",
    "Calibrating response timing for urgent calls…",
  ],
  property_management: [
    "Learning maintenance emergency escalation paths…",
    "Configuring tenant vs. owner call routing…",
    "Setting up after-hours emergency protocols…",
  ],
  hvac: [
    "Setting up emergency dispatch protocol…",
    "Loading HVAC service call scripts…",
    "Configuring comfort zone routing…",
    "Calibrating seasonal service detection…",
    "Setting up furnace vs. AC triage logic…",
  ],
  plumbing: [
    "Loading emergency call triage…",
    "Setting up service area routing…",
    "Configuring estimate request flow…",
    "Calibrating urgency detection for leaks…",
    "Setting up after-hours emergency dispatch…",
  ],
  dental: [
    "Loading patient intake flow…",
    "Setting up insurance verification prompts…",
    "Configuring appointment scheduling logic…",
    "Calibrating new patient vs. existing routing…",
    "Setting up emergency dental triage…",
  ],
  legal: [
    "Loading case intake protocol…",
    "Setting up consultation booking flow…",
    "Configuring practice area routing…",
    "Calibrating urgency detection for filings…",
    "Setting up conflict check reminders…",
  ],
  salon: [
    "Loading appointment booking flow…",
    "Setting up stylist routing preferences…",
    "Configuring walk-in availability logic…",
    "Calibrating service duration estimates…",
    "Setting up rebooking reminder prompts…",
  ],
  restaurant: [
    "Loading reservation system logic…",
    "Setting up order routing flow…",
    "Configuring menu FAQ responses…",
    "Calibrating party size and seating rules…",
    "Setting up hours and specials handling…",
  ],
  print_shop: [
    "Loading print job intake flow…",
    "Setting up file format handling prompts…",
    "Configuring turnaround time estimates…",
    "Calibrating material and finish options…",
    "Setting up quote request routing…",
  ],
  voicemail: [
    "Recording your business info…",
    "Setting up voicemail capture rules…",
    "Configuring after-hours greetings…",
  ],
  other: [
    "Setting up intelligent call routing…",
    "Loading FAQ response engine…",
    "Configuring message-taking protocol…",
    "Calibrating call classification rules…",
    "Setting up notification preferences…",
  ],
  default: [
    "Learning your business hours and timezone…",
    "Personalizing your agent's greeting…",
    "Configuring HOT lead classification rules…",
    "Setting up call notifications…",
    "Almost ready to go live…",
  ],
}

const REVIEW_CHECKLIST: Record<string, string[]> = {
  real_estate: [
    "Service area confirmed",
    "Agent voice selected",
    "Lead routing configured",
    "After-hours coverage set",
    "Ready to activate",
  ],
  auto_glass: [
    "Shop details confirmed",
    "Agent voice selected",
    "Repair triage configured",
    "Dispatch routing set",
    "Ready to activate",
  ],
  property_management: [
    "Property portfolio confirmed",
    "Agent voice selected",
    "Emergency escalation configured",
    "Tenant routing set",
    "Ready to activate",
  ],
  hvac: [
    "Service area confirmed",
    "Agent voice selected",
    "Emergency dispatch configured",
    "Seasonal routing set",
    "Ready to activate",
  ],
  plumbing: [
    "Service area confirmed",
    "Agent voice selected",
    "Emergency triage configured",
    "Estimate flow set",
    "Ready to activate",
  ],
  dental: [
    "Practice info confirmed",
    "Agent voice selected",
    "Patient intake configured",
    "Scheduling flow set",
    "Ready to activate",
  ],
  legal: [
    "Firm details confirmed",
    "Agent voice selected",
    "Case intake configured",
    "Consultation booking set",
    "Ready to activate",
  ],
  salon: [
    "Salon details confirmed",
    "Agent voice selected",
    "Booking flow configured",
    "Stylist routing set",
    "Ready to activate",
  ],
  restaurant: [
    "Restaurant info confirmed",
    "Agent voice selected",
    "Reservation system configured",
    "Menu FAQs set",
    "Ready to activate",
  ],
  print_shop: [
    "Shop details confirmed",
    "Agent voice selected",
    "Job intake configured",
    "Quote routing set",
    "Ready to activate",
  ],
  voicemail: [
    "Business info confirmed",
    "Agent voice selected",
    "Voicemail rules configured",
    "After-hours greeting set",
    "Ready to activate",
  ],
  other: [
    "Business info confirmed",
    "Agent voice selected",
    "Call handling configured",
    "Message routing set",
    "Ready to activate",
  ],
  default: [
    "Business info confirmed",
    "Agent voice selected",
    "Call handling configured",
    "Notifications set up",
    "Ready to activate",
  ],
}

interface Props {
  niche: string | null
  stepTitle: string
  stepIndex: number
  totalSteps: number
  businessName?: string
  city?: string
  placesPhotoUrl?: string
  placesRating?: number
  placesReviewCount?: number
  voiceName?: string
  isReviewStep?: boolean
}

export default function OnboardLeftPanel({
  niche,
  stepTitle,
  stepIndex,
  totalSteps,
  businessName,
  city,
  placesPhotoUrl,
  placesRating,
  placesReviewCount,
  voiceName,
  isReviewStep,
}: Props) {
  const shouldReduceMotion = useReducedMotion()
  const phrases = BUILD_PHRASES[niche ?? ''] ?? BUILD_PHRASES.default
  const [visibleCount, setVisibleCount] = useState(shouldReduceMotion ? phrases.length : 1)

  useEffect(() => {
    if (shouldReduceMotion) return
    setVisibleCount(1)
    const id = setInterval(() => {
      setVisibleCount(c => {
        if (c >= phrases.length) { clearInterval(id); return c }
        return c + 1
      })
    }, 2500)
    return () => clearInterval(id)
  }, [niche, phrases.length, shouldReduceMotion])

  const hasBusinessCard = !!(businessName && businessName.trim())

  return (
    <div
      className="hidden lg:flex w-[400px] xl:w-[440px] flex-shrink-0 flex-col text-white px-10 py-12 sticky top-0 h-screen overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>unmissed.ai</span>
      </div>

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {/* Mode 3: Review step — compact business card + checklist */}
          {isReviewStep && hasBusinessCard ? (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Compact business card */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Setting up</p>
                <p className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{businessName}</p>
                {city && <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{city}</p>}
              </div>
              {/* Checklist */}
              <div className="space-y-3">
                <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Setup complete</p>
                {(REVIEW_CHECKLIST[niche ?? ''] ?? REVIEW_CHECKLIST.default).map((item, i) => (
                  <motion.div
                    key={item}
                    initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.3 }}
                    className="flex items-center gap-2.5"
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#34d399' }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{item}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : hasBusinessCard ? (
            /* Mode 2: Business selected — show business card */
            <motion.div
              key="business-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              <div>
                <p className="text-sm font-medium mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Step {stepIndex} of {totalSteps} — {stepTitle}
                </p>
              </div>

              {/* Business photo or gradient placeholder */}
              <div className="rounded-xl overflow-hidden" style={{ height: 120 }}>
                {placesPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={placesPhotoUrl} alt={businessName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <path d="M21 15l-5-5L5 21"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Business info */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <p className="font-bold text-lg leading-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>{businessName}</p>
                {city && <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{city}</p>}

                {/* Rating */}
                {placesRating && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill={i < Math.round(placesRating) ? '#fbbf24' : 'rgba(255,255,255,0.2)'}>
                          <path d="M6 1l1.5 3 3.5.5-2.5 2.5.5 3.5L6 9l-3 1.5.5-3.5L1 4.5 4.5 4z"/>
                        </svg>
                      ))}
                    </div>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {placesRating.toFixed(1)}{placesReviewCount ? ` (${placesReviewCount.toLocaleString()})` : ''}
                    </span>
                  </div>
                )}

                {/* Voice badge */}
                {voiceName && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs" style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                      <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                    Agent voice: {voiceName}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            /* Mode 1: No business yet — original phrases animation */
            <motion.div
              key="phrases"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Step {stepIndex} of {totalSteps}
              </p>
              <h2 className="text-3xl font-bold leading-tight mb-8">{stepTitle}</h2>

              <div className="space-y-3">
                <AnimatePresence>
                  {phrases.slice(0, visibleCount).map((phrase) => (
                    <motion.div
                      key={phrase}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      className="flex items-start gap-2.5"
                    >
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#34d399' }} />
                      <span className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                        {phrase}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <p className="text-xs mt-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Your data stays in Canada · PIPEDA compliant
      </p>
    </div>
  )
}
