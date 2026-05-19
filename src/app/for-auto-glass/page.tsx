import type { Metadata } from "next";
import NicheLandingPage from "@/components/NicheLandingPage";
import { AUTO_GLASS } from "@/lib/niche-pages";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `AI Receptionist for Auto Glass Shops — ${BRAND_NAME}`,
  description:
    "Route missed windshield calls away from voicemail. Your AI agent collects vehicle details and sends lead summaries while you do installs.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-auto-glass`,
  },
  openGraph: {
    title: `AI Receptionist for Auto Glass Shops — ${BRAND_NAME}`,
    description:
      "AI agent answers missed auto-glass calls, collects vehicle details and ADAS requirements, and sends instant summaries.",
  },
};

export default function ForAutoGlassPage() {
  return <NicheLandingPage data={AUTO_GLASS} />;
}
