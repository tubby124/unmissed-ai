import type { Metadata } from "next";
import NicheLandingPage from "@/components/NicheLandingPage";
import { PLUMBING } from "@/lib/niche-pages";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `AI Receptionist for Plumbers — ${BRAND_NAME}`,
  description:
    "Never lose a plumbing emergency to voicemail. Your AI handles calls 24/7 — triages leaks, collects details, sends you instant alerts.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-plumbing`,
  },
  openGraph: {
    title: `AI Receptionist for Plumbers — ${BRAND_NAME}`,
    description:
      "Never lose a plumbing emergency to voicemail. Your AI handles calls 24/7 — triages leaks, collects details, sends you instant alerts.",
  },
};

export default function ForPlumbingPage() {
  return <NicheLandingPage data={PLUMBING} />;
}
