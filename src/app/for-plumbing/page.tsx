import type { Metadata } from "next";
import NicheLandingPage from "@/components/NicheLandingPage";
import { PLUMBING } from "@/lib/niche-pages";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `AI Receptionist for Plumbers — ${BRAND_NAME}`,
  description:
    "Route missed plumbing calls away from voicemail. Your AI triages leaks, collects details, and sends instant summaries.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-plumbing`,
  },
  openGraph: {
    title: `AI Receptionist for Plumbers — ${BRAND_NAME}`,
    description:
      "Route missed plumbing calls away from voicemail. Your AI triages leaks, collects details, and sends instant summaries.",
  },
};

export default function ForPlumbingPage() {
  return <NicheLandingPage data={PLUMBING} />;
}
