import type { Metadata } from "next";
import NicheLandingPage from "@/components/NicheLandingPage";
import { DENTAL } from "@/lib/niche-pages";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `AI Receptionist for Dental Offices — ${BRAND_NAME}`,
  description:
    "Never lose a new patient to voicemail. Your AI receptionist answers calls 24/7, books appointments, and sends you instant patient cards.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-dental`,
  },
  openGraph: {
    title: `AI Receptionist for Dental Offices — ${BRAND_NAME}`,
    description:
      "Never lose a new patient to voicemail. Your AI receptionist answers calls 24/7, books appointments, and sends you instant patient cards.",
  },
};

export default function ForDentalPage() {
  return <NicheLandingPage data={DENTAL} />;
}
