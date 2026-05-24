'use client'

import { useEffect } from 'react'
import { useReducedMotion } from 'motion/react'

/**
 * Custom hook that wraps `useReducedMotion()` from motion/react and
 * additionally sets/removes a `prefers-reduced-motion` class on the
 * `<html>` element so plain CSS can also react to the preference.
 *
 * SSR-safe — only runs in the browser (useEffect guarantees this).
 *
 * @returns `{ prefersReducedMotion: boolean }` — `true` when the user
 *          has requested reduced motion in their OS/accessibility settings.
 */
export function usePrefersReducedMotion(): { prefersReducedMotion: boolean } {
  const prefersReducedMotion = useReducedMotion() ?? false

  useEffect(() => {
    if (!prefersReducedMotion) {
      document.documentElement.classList.remove('prefers-reduced-motion')
    } else {
      document.documentElement.classList.add('prefers-reduced-motion')
    }

    // Cleanup on unmount: remove the class so it doesn't linger
    return () => {
      document.documentElement.classList.remove('prefers-reduced-motion')
    }
  }, [prefersReducedMotion])

  return { prefersReducedMotion }
}