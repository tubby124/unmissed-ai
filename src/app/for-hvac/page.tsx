import type { Metadata } from "next";
import NicheLandingPage from "@/components/NicheLandingPage";
import { HVAC } from "@/lib/niche-pages";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `AI Receptionist for HVAC Companies — ${BRAND_NAME}`,
  description:
    "Route missed HVAC calls away from voicemail. Your AI agent handles after-hours inquiries, captures urgency, and sends call summaries.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-hvac`,
  },
  openGraph: {
    title: `AI Receptionist for HVAC Companies — ${BRAND_NAME}`,
    description:
      "Route missed HVAC calls away from voicemail. Your AI agent captures heating and cooling inquiries and sends call summaries.",
  },
};

export default function ForHvacPage() {
  return <NicheLandingPage data={HVAC} />;
}
