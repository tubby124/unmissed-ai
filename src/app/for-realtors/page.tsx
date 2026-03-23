import type { Metadata } from "next";
import NicheLandingPage from "@/components/NicheLandingPage";
import { REALTY } from "@/lib/niche-pages";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `AI Receptionist for Real Estate Agents — ${BRAND_NAME}`,
  description:
    "Handle every buyer and seller inquiry while you're showing properties. Your AI handles calls, qualifies leads, and sends instant alerts — 24/7.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-realtors`,
  },
  openGraph: {
    title: `AI Receptionist for Real Estate Agents — ${BRAND_NAME}`,
    description:
      "Your AI that handles calls while you show properties. Qualifies buyers and sellers, sends instant lead cards — 24/7.",
  },
};

export default function ForRealtorsPage() {
  return <NicheLandingPage data={REALTY} />;
}
