'use client'

import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Tiny wrapper that injects a global `<MotionConfig reducedMotion="user" />`
 * so that every `motion.div` / `AnimatePresence` in the dashboard
 * automatically disables JS animations when the user's OS accessibility
 * settings request reduced motion.
 *
 * Placed around the dashboard content in layout.tsx — one line, zero
 * component changes needed elsewhere.
 */
export function MotionConfigProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  )
}