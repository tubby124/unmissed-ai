import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";
import StickyMobileCta from "@/components/StickyMobileCta";
import MarqueeStrip from "@/components/MarqueeStrip";
import HowItWorks from "@/components/HowItWorks";
import NicheSelectorGrid from "@/components/NicheSelectorGrid";
import VideoTestimonialCarousel from "@/components/VideoTestimonialCarousel";
import RoiCalculator from "@/components/RoiCalculator";
import CostComparisonTable from "@/components/CostComparisonTable";
import DemoAudioPlayer from "@/components/DemoAudioPlayer";
import PricingCards from "@/components/PricingCards";
import FaqAccordion from "@/components/FaqAccordion";
import IntegrationLogos from "@/components/IntegrationLogos";
import ReviewBadges from "@/components/ReviewBadges";
import EmailCapture from "@/components/EmailCapture";
import StatsSection from "@/components/StatsSection";
import { faqSchema } from "@/lib/schema";
import TryItNowWidget from "@/components/TryItNowWidget";
import HeroCallMockup from "@/components/HeroCallMockup";
import { BarChart3, AlertTriangle, Lightbulb, CheckCircle2, Lock, Check, X } from "lucide-react";

export const metadata: Metadata = {
  title: "unmissed.ai — AI Receptionist for Service Businesses",
  description:
    "Stop losing leads to voicemail. Your AI receptionist answers every call 24/7, collects lead info, and sends you an instant notification. 8,445+ calls handled.",
  openGraph: {
    title: "unmissed.ai — AI Receptionist for Service Businesses",
    description:
      "Stop losing leads to voicemail. AI agent answers every call, captures every lead, sends instant alerts. Built for service businesses.",
  },
};

async function getLiveCallCount(): Promise<number> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.unmissed.ai'
    const res = await fetch(`${appUrl}/api/public/stats`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return 0
    const { calls } = await res.json()
    return calls ?? 0
  } catch {
    return 0
  }
}

function formatCallCount(n: number): string {
  if (n < 100) return `${n}`
  return `${Math.floor(n / 50) * 50}+`
}

export default async function HomePage() {
  const callCount = await getLiveCallCount()
  const callsStat = formatCallCount(callCount)

  const stats = [
    { value: callsStat, label: "Calls Answered", sublabel: "since launch · beta" },
    { value: "62%", label: "SMBs Miss Daily" },
    { value: "85%", label: "Won't Call Back" },
    { value: "$126K", label: "Avg Lost/Year" },
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
            <div className="text-center z-10">
              {/* Live badge */}
              <div className="flex justify-center mb-6">
                <span
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono"
                  style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-live)' }} />
                  {callsStat} calls answered · live
                </span>
              </div>

              <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: 'var(--color-primary)' }}>
                AI Receptionist for Service Businesses
              </p>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight mb-6" style={{ color: 'var(--color-text-1)' }}>
                Every call answered.
                <br />
                Every lead captured.
                <br />
                <span style={{ color: 'var(--color-primary)' }}>Even at 2am.</span>
              </h1>

              <p className="text-lg md:text-xl leading-relaxed mb-4 max-w-2xl mx-auto" style={{ color: 'var(--color-text-2)' }}>
                You&apos;re on the job. A customer calls. 3 rings. They hang up.
                That&apos;s a $400 job gone — to a competitor who picked up.
              </p>
              <p className="text-lg md:text-xl font-semibold mb-10 max-w-2xl mx-auto" style={{ color: 'var(--color-text-1)' }}>
                unmissed.ai fixes that — for good.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                <Link
                  href="#demo"
                  className="px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors cursor-pointer"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Hear a Real Demo Call →
                </Link>
                <Link
                  href="/onboard"
                  className="px-8 py-4 rounded-xl font-semibold text-sm transition-colors cursor-pointer"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-2)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  Get My Agent Set Up
                </Link>
              </div>

              <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
                Trusted by service businesses in Alberta · Saskatchewan · British Columbia · Ontario · Texas
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-3)' }}>
                No contracts · Cancel anytime · 30-day money-back guarantee
              </p>
            </div>

            {/* Animated call mockup */}
            <div className="mt-14 pb-20">
              <HeroCallMockup />
            </div>
          </div>
        </section>

        {/* ── 2. PROOF NUMBERS ─────────────────────────────────── */}
        <section
          className="py-12 px-4"
          style={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}
        >
          <StatsSection stats={stats} />
        </section>

        {/* ── 3. MARQUEE STRIP ─────────────────────────────────── */}
        <ErrorBoundary>
          <MarqueeStrip />
        </ErrorBoundary>

        {/* ── 4. DEMO AUDIO PLAYER ─────────────────────────────── */}
        <ErrorBoundary>
          <DemoAudioPlayer />
        </ErrorBoundary>

        {/* ── 5. HOW IT WORKS ──────────────────────────────────── */}
        <ErrorBoundary>
          <HowItWorks />
        </ErrorBoundary>

        {/* ── 6. NICHE SELECTOR ────────────────────────────────── */}
        <ErrorBoundary>
          <NicheSelectorGrid />
        </ErrorBoundary>

        {/* ── 7. VIDEO TESTIMONIALS ────────────────────────────── */}
        <ErrorBoundary>
          <VideoTestimonialCarousel />
        </ErrorBoundary>

        {/* ── 8. LEARNING LOOP (THE DIFFERENTIATOR) ────────────── */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p
                  className="text-xs font-mono uppercase tracking-widest mb-3"
                  style={{ color: "var(--color-primary)" }}
                >
                  Only at unmissed.ai
                </p>
                <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: "var(--color-text-1)" }}>
                  Your agent gets smarter every week.
                </h2>
                <p className="text-lg leading-relaxed mb-6" style={{ color: "var(--color-text-2)" }}>
                  Every week, your agent reviews its own calls. Common questions
                  get flagged. Knowledge gaps get filled. Prompt improvements get
                  suggested automatically. No dashboard to check. No work to do.
                </p>
                <p className="font-semibold text-lg mb-4" style={{ color: "var(--color-text-1)" }}>
                  We call it: <span style={{ color: "var(--color-primary)" }}>The Learning Loop™</span>
                </p>
                <ul className="space-y-2 text-sm" style={{ color: "var(--color-text-2)" }}>
                  {[
                    "Weekly transcript analysis — automated",
                    "Unanswered questions flagged and filled",
                    "Caller confusion patterns identified",
                    "You approve changes before they go live",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span style={{ color: "var(--color-primary)" }}>→</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p
                  className="mt-4 text-xs px-3 py-1.5 rounded-full inline-block"
                  style={{ backgroundColor: "var(--color-surface)", color: "var(--color-primary)", border: "1px solid var(--color-border)" }}
                >
                  Included in Pro & Business plans
                </p>
              </div>

              {/* Visual */}
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <p className="text-xs font-mono mb-4" style={{ color: "var(--color-text-2)" }}>
                  // Weekly Learning Loop report
                </p>
                {[
                  { Icon: BarChart3, text: "47 calls reviewed this week", color: "var(--color-primary)" },
                  { Icon: AlertTriangle, text: "3 unanswered questions detected", color: "#F59E0B" },
                  { Icon: Lightbulb, text: '"What areas do you service?" — added to KB', color: "#22C55E" },
                  { Icon: Lightbulb, text: '"Do you do fleet vehicles?" — added to KB', color: "#22C55E" },
                  { Icon: CheckCircle2, text: "Agent updated. Approved by operator.", color: "#22C55E" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-2"
                    style={{ borderBottom: i < 4 ? "1px solid var(--color-border)" : "none" }}
                  >
                    <item.Icon size={16} className="flex-shrink-0 mt-0.5" style={{ color: item.color }} />
                    <p className="text-sm" style={{ color: item.color }}>
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 9. ROI CALCULATOR ────────────────────────────────── */}
        <ErrorBoundary>
          <RoiCalculator />
        </ErrorBoundary>

        {/* ── 10. COST COMPARISON ──────────────────────────────── */}
        <ErrorBoundary>
          <CostComparisonTable />
        </ErrorBoundary>

        {/* ── 11. NOT FOR YOU / IS FOR YOU ─────────────────────── */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12" style={{ color: "var(--color-text-1)" }}>
              Is unmissed.ai right for you?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* NOT for you */}
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <p className="text-red-400 font-semibold text-sm uppercase tracking-wider mb-4">
                  Not for you if…
                </p>
                <ul className="space-y-3 text-sm" style={{ color: "var(--color-text-2)" }}>
                  {[
                    "You already have a full-time receptionist",
                    "Your business gets fewer than 5 calls/week",
                    "You're looking for a chatbot or live chat",
                    "You want to stay on hold talking to customers",
                    "You're not willing to call back warm leads",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <X size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* IS for you */}
              <div
                className="rounded-2xl p-6"
                style={{
                  backgroundColor: "rgba(16,185,129,0.05)",
                  border: "1px solid rgba(16,185,129,0.2)",
                }}
              >
                <p className="font-semibold text-sm uppercase tracking-wider mb-4" style={{ color: "var(--color-cta)" }}>
                  ✓ Built for you if…
                </p>
                <ul className="space-y-3 text-sm" style={{ color: "var(--color-text-2)" }}>
                  {[
                    "You miss calls while physically doing the work",
                    "You've lost a job to a competitor who picked up",
                    "You want leads captured even at midnight",
                    "You want to call back only qualified, ready-to-buy leads",
                    "You want setup done for you in 24 hours — not weeks",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-cta)" }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── 12. PRICING PREVIEW ──────────────────────────────── */}
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

        {/* ── 13. FAQ ──────────────────────────────────────────── */}
        <ErrorBoundary>
          <FaqAccordion />
        </ErrorBoundary>

        {/* ── 14. INTEGRATION LOGOS ────────────────────────────── */}
        <ErrorBoundary>
          <IntegrationLogos />
        </ErrorBoundary>

        {/* ── 15. REVIEWS ──────────────────────────────────────── */}
        <ErrorBoundary>
          <ReviewBadges />
        </ErrorBoundary>

        {/* ── 16. URGENCY BANNER ───────────────────────────────── */}
        <section
          className="py-12 px-4"
          style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}
        >
          <div
            style={{
              backgroundColor: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.35)",
              borderRadius: "12px",
              padding: "20px 32px",
              maxWidth: "640px",
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <p className="font-bold text-lg mb-1 flex items-center justify-center gap-2" style={{ color: "var(--color-text-1)" }}>
              <Lock size={16} style={{ color: "#F59E0B" }} />
              Founding Member Pricing — $147/mo locked for life.
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--color-text-2)" }}>
              Price increases to $197/mo after the first 50 clients.
              <strong style={{ color: "#F59E0B" }}> Limited spots remaining.</strong>
            </p>
            <Link
              href="/onboard"
              className="inline-block px-8 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Claim Your Founding Spot →
            </Link>
          </div>
        </section>

        {/* ── 17. EMAIL CAPTURE ────────────────────────────────── */}
        <ErrorBoundary>
          <EmailCapture />
        </ErrorBoundary>

        {/* ── 18. LIVE DEMO LINE ───────────────────────────────── */}
        <section
          className="py-20 px-4"
          style={{ backgroundColor: "var(--color-bg)", borderTop: "1px solid var(--color-border)" }}
        >
          <div className="max-w-2xl mx-auto text-center">
            <p
              className="text-xs font-mono uppercase tracking-widest mb-2"
              style={{ color: "var(--color-primary)" }}
            >
              Try it right now
            </p>
            <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--color-text-1)" }}>
              Don&apos;t take our word for it. Call it yourself.
            </h2>
            <p className="text-lg mb-6" style={{ color: "var(--color-text-2)" }}>
              This is a live demo agent. Talk to it. Ask it anything.
              Experience exactly what your customers will hear.
            </p>
            <div
              className="inline-block px-8 py-5 rounded-2xl mb-4"
              style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <p className="text-xs mb-1" style={{ color: "var(--color-text-2)" }}>Call our live demo agent:</p>
              <a href="tel:+15873551834" className="block">
                <p className="text-3xl font-black tracking-wider hover:text-blue-400 transition-colors" style={{ color: "var(--color-text-1)" }}>
                  (587) 355-1834
                </p>
              </a>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-3)" }}>
                Live auto glass agent · Try it right now
              </p>
            </div>
            <p className="text-xs" style={{ color: "var(--color-text-3)" }}>
              Live demo agent · No obligation · Powered by unmissed.ai
            </p>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────── */}
        <section
          className="py-24 px-4 text-center"
          style={{ backgroundColor: "#0F172A" }}
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
      <TryItNowWidget />
    </>
  );
}
