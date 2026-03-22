"use client"

import { BookOpen } from "lucide-react"
import EmptyStateBase from "./EmptyStateBase"

export default function NoKnowledge() {
  return (
    <EmptyStateBase
      icon={<BookOpen className="w-5 h-5" style={{ color: "#a78bfa" }} />}
      title="Your agent starts smart"
      description="Add FAQs, service details, or upload docs to make your agent an expert on your business."
      accentColor="rgba(167,139,250,0.15)"
      cta={{ label: "Add Knowledge", href: "/dashboard/settings?tab=knowledge" }}
    />
  )
}
