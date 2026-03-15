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
  voicemail: [
    "Recording your business info…",
    "Setting up voicemail capture rules…",
    "Configuring after-hours greetings…",
  ],
  default: [
    "Learning your business hours and timezone…",
    "Personalizing your agent's greeting…",
    "Configuring HOT lead classification rules…",
    "Setting up call notifications…",
    "Almost ready to go live…",
  ],
}

interface Props {
  niche: string | null
  stepTitle: string
  stepIndex: number  // 1-based
  totalSteps: number
}

export default function OnboardLeftPanel({ niche, stepTitle, stepIndex, totalSteps }: Props) {
  const shouldReduceMotion = useReducedMotion()
  const phrases = BUILD_PHRASES[niche ?? ''] ?? BUILD_PHRASES.default
  const [visibleCount, setVisibleCount] = useState(shouldReduceMotion ? phrases.length : 1)

  // Reveal one phrase every 2.5s
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

  return (
    <div className="hidden lg:flex w-[400px] xl:w-[440px] flex-shrink-0 flex-col
      text-white px-10 py-12 sticky top-0 h-screen overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)' }}>

      {/* Logo */}
      <div className="flex items-center gap-2 mb-16">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.15)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>unmissed.ai</span>
      </div>

      {/* Step info */}
      <div className="flex-1">
        <p className="text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Step {stepIndex} of {totalSteps}
        </p>
        <h2 className="text-3xl font-bold leading-tight mb-8">{stepTitle}</h2>

        {/* Build phrases */}
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
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: '#34d399' }} />
                <span className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {phrase}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Your data stays in Canada · PIPEDA compliant
      </p>
    </div>
  )
}
