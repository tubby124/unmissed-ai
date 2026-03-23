import type { Metadata } from "next";
import NicheLandingPage from "@/components/NicheLandingPage";
import { LEGAL } from "@/lib/niche-pages";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `AI Receptionist for Law Firms — ${BRAND_NAME}`,
  description:
    "Never lose a potential client to voicemail. Your AI receptionist screens calls, collects case details, and sends instant consultation requests.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-legal`,
  },
  openGraph: {
    title: `AI Receptionist for Law Firms — ${BRAND_NAME}`,
    description:
      "Never lose a potential client to voicemail. Your AI receptionist screens calls, collects case details, and sends instant consultation requests.",
  },
};

export default function ForLegalPage() {
  return <NicheLandingPage data={LEGAL} />;
}
