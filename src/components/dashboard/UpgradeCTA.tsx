"use client"

import { motion } from "motion/react"
import { ArrowRight, Sparkles } from "lucide-react"

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
        title="Upgrade to paid plan"
        className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-colors"
        style={{ backgroundColor: "rgba(99,102,241,0.15)" }}
      >
        <Sparkles className="w-4 h-4" style={{ color: "#818cf8" }} />
      </a>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-2 rounded-xl p-3"
      style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.08))",
        border: "1px solid rgba(99,102,241,0.2)",
      }}
      id="upgrade-cta"
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(99,102,241,0.2)" }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: "#818cf8" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color: "var(--color-text-1)" }}>
            Ready for real calls?
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-3)" }}>
            {minutesUsed > 0
              ? `${minutesUsed} test min used`
              : "Get a phone number"}
            {daysRemaining !== undefined && ` \u00b7 ${daysRemaining}d left`}
          </p>
        </div>
      </div>
      <a
        href="/dashboard/settings?tab=billing"
        className="mt-2.5 w-full py-1.5 rounded-lg text-[11px] font-medium text-white flex items-center justify-center gap-1 transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        Upgrade
        <ArrowRight className="w-3 h-3" />
      </a>
    </motion.div>
  )
}
