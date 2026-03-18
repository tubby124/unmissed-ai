import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";
import StickyMobileCta from "@/components/StickyMobileCta";
import HowItWorks from "@/components/HowItWorks";
import NicheSelectorGrid from "@/components/NicheSelectorGrid";
import DemoAudioPlayer from "@/components/DemoAudioPlayer";
import PricingCards from "@/components/PricingCards";
import FaqAccordion from "@/components/FaqAccordion";
import StatsSection from "@/components/StatsSection";
import { faqSchema } from "@/lib/schema";
import HeroCallMockup from "@/components/HeroCallMockup";
import HeroContent from "@/components/HeroContent";
import CallMeNowWidget from "@/components/CallMeNowWidget";
import TalkToAgentWidget from "@/components/TalkToAgentWidget";

export const metadata: Metadata = {
  title: "unmissed.ai — AI Receptionist for Service Businesses",
  description:
    "Stop losing leads to voicemail. Your AI receptionist answers every call 24/7, collects lead info, and sends you an instant notification.",
  alternates: {
    canonical: "https://unmissed.ai",
  },
  openGraph: {
    title: "unmissed.ai — AI Receptionist for Service Businesses",
    description:
      "Stop losing leads to voicemail. AI agent answers every call, captures every lead, sends instant alerts. Built for service businesses.",
  },
};

export default async function HomePage() {
  const stats = [
    { value: "62%", label: "SMBs Miss Calls Daily" },
    { value: "85%", label: "Won't Call Back" },
    { value: "$126K", label: "Avg Revenue Lost/Year" },
    { value: "24/7", label: "Always Available" },
  ]
  return (
    <>
      {/* FAQ JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <Navbar />
      <StickyMobileCta />

      <main style={{ backgroundColor: "var(--color-bg)" }}>
        {/* ── 1. HERO ──────────────────────────────────────────── */}
        <section className="relative pt-32 pb-20 px-4 overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="relative max-w-6xl mx-auto">
            <HeroContent />

            {/* Call Me Now — hero inline phone input */}
            <div className="max-w-md mx-auto mt-8">
              <CallMeNowWidget compact niche="unmissed_demo" />
            </div>

            {/* Animated call mockup */}
            <div className="mt-14 pb-20">
              <HeroCallMockup />
            </div>
          </div>
        </section>

        {/* ── 2. STATS STRIP ─────────────────────────────────── */}
        <section
          className="py-12 px-4"
          style={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}
        >
          <StatsSection stats={stats} />
        </section>

        {/* ── 3. DEMO AUDIO PLAYER ─────────────────────────────── */}
        <ErrorBoundary>
          <DemoAudioPlayer />
        </ErrorBoundary>

        {/* ── 4. HOW IT WORKS ──────────────────────────────────── */}
        <ErrorBoundary>
          <HowItWorks />
        </ErrorBoundary>

        {/* ── 5. NICHE SELECTOR ────────────────────────────────── */}
        <ErrorBoundary>
          <NicheSelectorGrid />
        </ErrorBoundary>

        {/* ── 6. PRICING ─────────────────────────────────────── */}
        <section
          id="pricing"
          className="py-20 px-4"
          style={{ backgroundColor: "var(--color-bg)" }}
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p
                className="text-xs font-mono uppercase tracking-widest mb-2"
                style={{ color: "var(--color-primary)" }}
              >
                Pricing
              </p>
              <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
                Simple, honest pricing.
              </h2>
              <p className="text-lg" style={{ color: "var(--color-text-2)" }}>
                No per-minute charges. No overage fees. No surprises.
              </p>
            </div>
            <ErrorBoundary>
              <PricingCards compact />
            </ErrorBoundary>
            <p className="text-center mt-6">
              <a
                href="/pricing"
                className="text-sm transition-colors"
                style={{ color: "var(--color-primary)" }}
              >
                See full pricing details and feature comparison →
              </a>
            </p>
          </div>
        </section>

        {/* ── 7. FAQ ──────────────────────────────────────────── */}
        <ErrorBoundary>
          <FaqAccordion />
        </ErrorBoundary>

        {/* ── 8. FINAL CTA ────────────────────────────────────── */}
        <section
          className="py-24 px-4 text-center"
          style={{ backgroundColor: "#0a0a0a" }}
        >
          <div className="max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ color: "#FFFFFF" }}>
              Stop leaving money on the table.
            </h2>
            <p className="text-xl mb-8" style={{ color: "rgba(255,255,255,0.65)" }}>
              Every call you miss is a job that went to someone who picked up.
            </p>
            <Link
              href="/onboard"
              className="inline-block px-10 py-4 rounded-xl text-white font-bold text-lg transition-colors"
              style={{ backgroundColor: "var(--color-cta)" }}
            >
              Get My Agent Set Up →
            </Link>
            <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.35)" }}>
              Agent live within 24 hours · No contracts · 30-day money-back guarantee
            </p>
          </div>
        </section>
      </main>

      <Footer />
      <TalkToAgentWidget />
    </>
  );
}
