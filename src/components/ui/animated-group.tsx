'use client'

import { Children, type ReactNode } from 'react'
import { motion, type Variants } from 'motion/react'
import { cn } from '@/lib/utils'

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
}

interface AnimatedGroupProps {
  children: ReactNode
  className?: string
  variants?: Variants
  stagger?: number
  as?: 'div' | 'ul' | 'ol' | 'section'
}

export default function AnimatedGroup({
  children,
  className,
  variants,
  stagger = 0.06,
  as = 'div',
}: AnimatedGroupProps) {
  const container: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: stagger },
    },
  }
  const item = variants || defaultVariants
  const MotionTag = motion.create(as)

  return (
    <MotionTag
      initial="hidden"
      animate="visible"
      variants={container}
      className={cn(className)}
    >
      {Children.map(children, (child) => (
        <motion.div variants={item}>{child}</motion.div>
      ))}
    </MotionTag>
  )
}
