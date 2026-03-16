import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Try a Live AI Agent — unmissed.ai",
  description:
    "Talk to an AI receptionist right in your browser. No sign-up, no credit card. Try auto glass, property management, or real estate agents live.",
  openGraph: {
    title: "Try a Live AI Agent — unmissed.ai",
    description: "Talk to an AI receptionist right in your browser. No sign-up required.",
  },
}

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return children
}
