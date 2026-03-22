"use client"

import { CalendarDays } from "lucide-react"
import EmptyStateBase from "./EmptyStateBase"

export default function NoBookings() {
  return (
    <EmptyStateBase
      icon={<CalendarDays className="w-5 h-5" style={{ color: "#10b981" }} />}
      title="No bookings yet"
      description="When your agent books appointments for callers, they'll show up here. Connect your Google Calendar to get started."
      accentColor="rgba(16,185,129,0.15)"
      cta={{ label: "Connect Calendar", href: "/dashboard/settings?tab=calendar" }}
    />
  )
}
