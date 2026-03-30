'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'

export function RouteLoadingBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setLoading(true)
    setProgress(0)
    const t1 = setTimeout(() => setProgress(70), 80)
    const t2 = setTimeout(() => {
      setProgress(100)
      setTimeout(() => setLoading(false), 200)
    }, 350)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [pathname, searchParams])

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          className="fixed top-0 left-0 z-[100] h-[2px] pointer-events-none"
          style={{ backgroundColor: 'var(--color-cta)', width: `${progress}%` }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        />
      )}
    </AnimatePresence>
  )
}
