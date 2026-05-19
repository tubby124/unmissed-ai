import type { Metadata } from "next";
import NicheLandingPage from "@/components/NicheLandingPage";
import { DENTAL } from "@/lib/niche-pages";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `AI Receptionist for Dental Offices — ${BRAND_NAME}`,
  description:
    "Route missed dental calls away from voicemail. Your AI receptionist captures patient details and sends instant summaries.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-dental`,
  },
  openGraph: {
    title: `AI Receptionist for Dental Offices — ${BRAND_NAME}`,
    description:
      "Route missed dental calls away from voicemail. Your AI receptionist captures patient details and sends instant summaries.",
  },
};

export default function ForDentalPage() {
  return <NicheLandingPage data={DENTAL} />;
}
