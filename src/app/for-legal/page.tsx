import type { Metadata } from "next";
import NicheLandingPage from "@/components/NicheLandingPage";
import { LEGAL } from "@/lib/niche-pages";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `AI Receptionist for Law Firms — ${BRAND_NAME}`,
  description:
    "Route missed law-firm calls away from voicemail. Your AI receptionist screens calls, collects case details, and sends summaries.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-legal`,
  },
  openGraph: {
    title: `AI Receptionist for Law Firms — ${BRAND_NAME}`,
    description:
      "Route missed law-firm calls away from voicemail. Your AI receptionist screens calls, collects case details, and sends summaries.",
  },
};

export default function ForLegalPage() {
  return <NicheLandingPage data={LEGAL} />;
}
