"use client"

import { Bell } from "lucide-react"
import EmptyStateBase from "./EmptyStateBase"

export default function NoNotifications() {
  return (
    <EmptyStateBase
      icon={<Bell className="w-5 h-5" style={{ color: "#f59e0b" }} />}
      title="Stay in the loop"
      description="Connect Telegram to get instant call summaries, booking confirmations, and lead alerts on your phone."
      accentColor="rgba(245,158,11,0.15)"
      cta={{ label: "Connect Telegram", href: "/dashboard/settings?tab=notifications" }}
    />
  )
}
