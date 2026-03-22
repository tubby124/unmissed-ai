"use client"

import { motion } from "motion/react"
import type { ReactNode } from "react"

interface EmptyStateBaseProps {
  icon: ReactNode
  title: string
  description: string
  cta?: {
    label: string
    href?: string
    onClick?: () => void
  }
  accentColor?: string
}

export default function EmptyStateBase({
  icon,
  title,
  description,
  cta,
  accentColor = "rgba(99,102,241,0.15)",
}: EmptyStateBaseProps) {
  const ctaElement = cta ? (
    cta.href ? (
      <a
        href={cta.href}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        {cta.label}
      </a>
    ) : (
      <button
        onClick={cta.onClick}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        {cta.label}
      </button>
    )
  ) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center text-center py-10 px-6"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: accentColor }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text-1)" }}>
        {title}
      </h3>
      <p className="text-xs max-w-xs mb-4" style={{ color: "var(--color-text-3)" }}>
        {description}
      </p>
      {ctaElement}
    </motion.div>
  )
}
