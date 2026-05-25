import type { Metadata } from "next"
import { BRAND_NAME } from "@/lib/brand"

export const metadata: Metadata = {
  title: `Get a Phone Demo Call — ${BRAND_NAME}`,
  description:
    "Enter your number and Zara calls your phone with a live EndVoicemail demo. See how missed calls become clean summaries instead of audio voicemail.",
  openGraph: {
    title: `Get a Phone Demo Call — ${BRAND_NAME}`,
    description: "Zara calls your phone with a live demo of voicemail replacement and clean missed-call summaries.",
  },
}

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return children
}
