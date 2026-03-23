"use client"

import { motion } from "motion/react"
import { ArrowRight, Sparkles } from "lucide-react"
import { trackEvent } from "@/lib/analytics"

interface UpgradeCTAProps {
  collapsed?: boolean
  minutesUsed?: number
  daysRemaining?: number
}

export default function UpgradeCTA({ collapsed, minutesUsed = 0, daysRemaining }: UpgradeCTAProps) {
  if (collapsed) {
    return (
      <a
        href="/dashboard/settings?tab=billing"
        title="Go live — your setup carries over"
        className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-colors"
        style={{ backgroundColor: "var(--color-accent-tint)" }}
      >
        <Sparkles className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
      </a>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-2 rounded-xl p-3"
      style={{
        backgroundColor: "var(--color-accent-tint)",
        border: "1px solid var(--color-border)",
      }}
      id="upgrade-cta"
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--color-primary)", opacity: 0.15 }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--color-primary)", opacity: 1 }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color: "var(--color-text-1)" }}>
            Go live for $97/mo
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-3)" }}>
            {daysRemaining !== undefined && daysRemaining > 0
              ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left — your setup carries over`
              : "Your own number + unlimited calls"}
          </p>
        </div>
      </div>
      <a
        href="/dashboard/settings?tab=billing"
        onClick={() => trackEvent('upgrade_cta_click')}
        className="mt-2.5 w-full py-2 rounded-lg text-[12px] font-medium text-white flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90 cursor-pointer"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        Get Your Phone Number
        <ArrowRight className="w-3.5 h-3.5" />
      </a>
    </motion.div>
  )
}
