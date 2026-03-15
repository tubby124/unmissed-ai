'use client'

import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring } from 'motion/react'
import { cn } from '@/lib/utils'

interface NumberTickerProps {
  value: number
  direction?: 'up' | 'down'
  delay?: number
  decimalPlaces?: number
  format?: (n: number) => string
  className?: string
}

export default function NumberTicker({
  value,
  direction = 'up',
  delay = 0,
  decimalPlaces = 0,
  format,
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(direction === 'down' ? value : 0)
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  })
  const isInView = useInView(ref, { once: true, margin: '0px' })

  useEffect(() => {
    if (isInView) {
      const timeout = setTimeout(() => {
        motionValue.set(direction === 'down' ? 0 : value)
      }, delay * 1000)
      return () => clearTimeout(timeout)
    }
  }, [motionValue, isInView, delay, value, direction])

  useEffect(
    () =>
      springValue.on('change', (latest) => {
        if (ref.current) {
          const rounded = parseFloat(latest.toFixed(decimalPlaces))
          ref.current.textContent = format
            ? format(rounded)
            : Intl.NumberFormat('en-US', {
                minimumFractionDigits: decimalPlaces,
                maximumFractionDigits: decimalPlaces,
              }).format(rounded)
        }
      }),
    [springValue, decimalPlaces, format],
  )

  return (
    <span
      ref={ref}
      className={cn(
        'inline-block tabular-nums tracking-tight',
        className,
      )}
    >
      {format ? format(direction === 'down' ? value : 0) : (direction === 'down' ? value : 0)}
    </span>
  )
}
