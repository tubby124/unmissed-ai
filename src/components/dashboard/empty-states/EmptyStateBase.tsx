"use client"

import Link from "next/link"
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
      <Link
        href={cta.href}
        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:opacity-90"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-1)",
        }}
      >
        {cta.label}
      </Link>
    ) : (
      <button
        onClick={cta.onClick}
        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:opacity-90 cursor-pointer"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-1)",
        }}
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
      className="flex flex-col items-center justify-center min-h-[400px] px-6 text-center"
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: accentColor }}
      >
        {icon}
      </div>
      <h2 className="text-base font-semibold mb-1" style={{ color: "var(--color-text-1)" }}>
        {title}
      </h2>
      <p className="text-sm mb-6 max-w-sm" style={{ color: "var(--color-text-3)" }}>
        {description}
      </p>
      {ctaElement}
    </motion.div>
  )
}
