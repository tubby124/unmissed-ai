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
import TrustBar from "@/components/TrustBar";
import { faqSchema } from "@/lib/schema";
import HeroCallMockup from "@/components/HeroCallMockup";
import HeroContent from "@/components/HeroContent";
import CallMeNowWidget from "@/components/CallMeNowWidget";
// TalkToAgentWidget moved to root layout — available site-wide
import { BETA_PROMO, TRIAL, BASE_PLAN } from "@/lib/pricing";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND_NAME} — AI Receptionist for Service Businesses`,
  description:
    "Stop losing leads to voicemail. Your AI receptionist answers every call 24/7, collects lead info, and sends you an instant notification.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}`,
  },
  openGraph: {
    title: `${BRAND_NAME} — AI Receptionist for Service Businesses`,
    description:
      "Stop losing leads to voicemail. AI agent answers every call, captures every lead, sends instant alerts. Built for service businesses.",
  },
};

export default async function HomePage() {
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
        {/* ── 1. HERO — Split layout ────────────────────────────── */}
        <section
          className="relative pt-28 sm:pt-32 pb-16 lg:pb-20 px-4 overflow-hidden"
          style={{ backgroundColor: "var(--color-bg)" }}
        >
          <div className="relative max-w-6xl mx-auto">
            {/* Grid: left copy + right mockup */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* LEFT — Copy + Phone CTA */}
              <HeroContent />

              {/* RIGHT — Animated call mockup */}
              <div className="flex justify-center lg:justify-end">
                <div className="relative">
                  {/* Ambient glow backdrop */}
                  <div
                    className="absolute -inset-10 rounded-3xl blur-3xl opacity-15 pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(circle, var(--color-primary), transparent 70%)",
                    }}
                  />
                  <HeroCallMockup />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. TRUST BAR — Social proof stats ─────────────────── */}
        <TrustBar />

        {/* ── 3. DEMO AUDIO PLAYER ──────────────────────────────── */}
        <ErrorBoundary>
          <DemoAudioPlayer />
        </ErrorBoundary>

        {/* ── 4. HOW IT WORKS ───────────────────────────────────── */}
        <ErrorBoundary>
          <HowItWorks />
        </ErrorBoundary>

        {/* ── 5. NICHE SELECTOR ─────────────────────────────────── */}
        <ErrorBoundary>
          <NicheSelectorGrid />
        </ErrorBoundary>

        {/* ── 6. PRICING ────────────────────────────────────────── */}
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
              <h2
                className="text-3xl md:text-4xl font-bold mb-3"
                style={{ color: "var(--color-text-1)" }}
              >
                Simple, honest pricing.
              </h2>
              <p
                className="text-lg"
                style={{ color: "var(--color-text-2)" }}
              >
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

        {/* ── 7. FAQ ────────────────────────────────────────────── */}
        <ErrorBoundary>
          <FaqAccordion />
        </ErrorBoundary>

        {/* ── 8. FINAL CTA — Bookend with phone input ───────────── */}
        <section
          className="py-24 px-4 text-center"
          style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}
        >
          <div className="max-w-2xl mx-auto">
            <h2
              className="text-4xl md:text-5xl font-black mb-4"
              style={{ color: "var(--color-text-1)" }}
            >
              Stop leaving money on the table.
            </h2>
            <p
              className="text-xl mb-8"
              style={{ color: "var(--color-text-2)" }}
            >
              Every call you miss is a job that went to someone who picked up.
            </p>

            {/* Phone input — bookends the hero CTA */}
            <div className="max-w-md mx-auto mb-6">
              <CallMeNowWidget compact niche="unmissed_demo" />
            </div>

            <div
              className="flex items-center justify-center gap-6 text-sm"
              style={{ color: "var(--color-text-3)" }}
            >
              <span>{TRIAL.label}</span>
              <span
                className="w-px h-3"
                style={{ backgroundColor: "var(--color-border)" }}
              />
              <span>
                {BETA_PROMO.enabled
                  ? `$${BETA_PROMO.monthly}/mo`
                  : `$${BASE_PLAN.monthly}/mo`}
              </span>
              <span
                className="w-px h-3"
                style={{ backgroundColor: "var(--color-border)" }}
              />
              <span>No contracts</span>
            </div>

            <p className="mt-6">
              <Link
                href="/onboard"
                className="text-sm font-medium transition-colors"
                style={{ color: "var(--color-primary)" }}
              >
                Or sign up and build your agent →
              </Link>
            </p>
          </div>
        </section>
      </main>

      <Footer />
      {/* TalkToAgentWidget rendered in root layout */}
    </>
  );
}
