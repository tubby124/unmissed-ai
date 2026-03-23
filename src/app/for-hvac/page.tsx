import type { Metadata } from "next";
import NicheLandingPage from "@/components/NicheLandingPage";
import { HVAC } from "@/lib/niche-pages";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `AI Receptionist for HVAC Companies — ${BRAND_NAME}`,
  description:
    "Never lose a furnace repair call to voicemail. Your AI agent handles calls 24/7 — even during emergency season.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-hvac`,
  },
  openGraph: {
    title: `AI Receptionist for HVAC Companies — ${BRAND_NAME}`,
    description:
      "Never lose a furnace repair call to voicemail. Your AI agent handles calls 24/7 — even during emergency season.",
  },
};

export default function ForHvacPage() {
  return <NicheLandingPage data={HVAC} />;
}
