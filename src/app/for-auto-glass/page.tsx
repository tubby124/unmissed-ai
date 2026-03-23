import type { Metadata } from "next";
import NicheLandingPage from "@/components/NicheLandingPage";
import { AUTO_GLASS } from "@/lib/niche-pages";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `AI Receptionist for Auto Glass Shops — ${BRAND_NAME}`,
  description:
    "Never lose another windshield job to voicemail. Your AI agent handles calls while you do installs — 24/7, with instant lead cards delivered to your phone.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-auto-glass`,
  },
  openGraph: {
    title: `AI Receptionist for Auto Glass Shops — ${BRAND_NAME}`,
    description:
      "Stop losing $150–$800 windshield jobs to voicemail. AI agent answers every call, collects vehicle details, ADAS requirements, and sends instant alerts.",
  },
};

export default function ForAutoGlassPage() {
  return <NicheLandingPage data={AUTO_GLASS} />;
}
