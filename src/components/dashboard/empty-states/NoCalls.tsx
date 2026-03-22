"use client"

import { Phone } from "lucide-react"
import EmptyStateBase from "./EmptyStateBase"

interface NoCallsProps {
  isTrial: boolean
  onTestAgent?: () => void
}

export default function NoCalls({ isTrial, onTestAgent }: NoCallsProps) {
  if (isTrial) {
    return (
      <EmptyStateBase
        icon={<Phone className="w-5 h-5" style={{ color: "#818cf8" }} />}
        title="No calls yet"
        description="Test your agent from your browser to hear how it handles calls with your business info. No phone needed."
        accentColor="rgba(99,102,241,0.15)"
        cta={onTestAgent ? { label: "Test Your Agent", onClick: onTestAgent } : undefined}
      />
    )
  }

  return (
    <EmptyStateBase
      icon={<Phone className="w-5 h-5" style={{ color: "#3b82f6" }} />}
      title="No calls this month"
      description="Your agent is live and ready. Calls will appear here as they come in."
      accentColor="rgba(59,130,246,0.15)"
    />
  )
}
