import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";
import StickyMobileCta from "@/components/StickyMobileCta";
import ActivityTicker from "@/components/ActivityTicker";
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
import { faqSchema } from "@/lib/schema";

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

const stats = [
  // TODO: Pull from real call count API
  { value: "8,445+", label: "Calls Handled" },
  { value: "62%", label: "SMBs Miss Daily" },
  { value: "85%", label: "Won't Call Back" },
  { value: "$126K", label: "Avg Lost/Year" },
];

export default function HomePage() {
  return (
    <>
      {/* FAQ JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <Navbar />
      <StickyMobileCta />

      <main style={{ backgroundColor: "#0A0A0A" }}>
        {/* ── 1. HERO ──────────────────────────────────────────── */}
        <section className="relative pt-32 pb-20 px-4 overflow-hidden">
          {/* Background glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-3xl opacity-10 pointer-events-none"
            style={{ backgroundColor: "#3B82F6" }}
          />

          <div className="relative max-w-4xl mx-auto text-center">
            {/* Live ticker */}
            <div className="flex justify-center mb-6">
              <ErrorBoundary>
                <ActivityTicker />
              </ErrorBoundary>
            </div>

            <p
              className="text-xs font-mono uppercase tracking-widest mb-4"
              style={{ color: "#3B82F6" }}
            >
              AI Receptionist for Service Businesses
            </p>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight mb-6">
              Every call answered.
              <br />
              Every lead captured.
              <br />
              <span style={{ color: "#3B82F6" }}>Even at 2am.</span>
            </h1>

            <p className="text-gray-400 text-lg md:text-xl leading-relaxed mb-4 max-w-2xl mx-auto">
              You&apos;re on the job. A customer calls. 3 rings. They hang up.
              That&apos;s a $400 job gone — to a competitor who picked up.
            </p>
            <p className="text-white text-lg md:text-xl font-semibold mb-10 max-w-2xl mx-auto">
              unmissed.ai fixes that — for good.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="#demo"
                className="px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
                style={{ backgroundColor: "#3B82F6" }}
              >
                Hear a Real Demo Call →
              </Link>
              <Link
                href="/onboard"
                className="px-8 py-4 rounded-xl font-semibold text-sm transition-colors"
                style={{
                  backgroundColor: "#111111",
                  color: "#D1D5DB",
                  border: "1px solid #1F1F1F",
                }}
              >
                Get My Agent Set Up
              </Link>
            </div>

            <p className="text-gray-600 text-xs">
              Trusted by service businesses in Alberta · Saskatchewan · British Columbia · Ontario · Texas
            </p>

            {/* Guarantee badge */}
            <p className="text-gray-600 text-xs mt-2">
              🔒 No contracts · Cancel anytime · 30-day money-back guarantee
            </p>
          </div>
        </section>

        {/* ── 2. PROOF NUMBERS ─────────────────────────────────── */}
        <section
          className="py-12 px-4"
          style={{ borderTop: "1px solid #1F1F1F", borderBottom: "1px solid #1F1F1F" }}
        >
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((s) => (
              <div key={s.value}>
                <p
                  className="text-3xl md:text-4xl font-black mb-1"
                  style={{ color: "#3B82F6" }}
                >
                  {s.value}
                </p>
                <p className="text-gray-500 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
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
        <section className="py-20 px-4" style={{ backgroundColor: "#0D0D0D" }}>
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p
                  className="text-xs font-mono uppercase tracking-widest mb-3"
                  style={{ color: "#06B6D4" }}
                >
                  Only at unmissed.ai
                </p>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Your agent gets smarter every week.
                </h2>
                <p className="text-gray-400 text-lg leading-relaxed mb-6">
                  Every week, your agent reviews its own calls. Common questions
                  get flagged. Knowledge gaps get filled. Prompt improvements get
                  suggested automatically. No dashboard to check. No work to do.
                </p>
                <p className="text-white font-semibold text-lg mb-4">
                  We call it: <span style={{ color: "#06B6D4" }}>The Learning Loop™</span>
                </p>
                <ul className="space-y-2 text-gray-400 text-sm">
                  {[
                    "Weekly transcript analysis — automated",
                    "Unanswered questions flagged and filled",
                    "Caller confusion patterns identified",
                    "You approve changes before they go live",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span style={{ color: "#06B6D4" }}>→</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p
                  className="mt-4 text-xs px-3 py-1.5 rounded-full inline-block"
                  style={{ backgroundColor: "#0D1F2A", color: "#06B6D4", border: "1px solid #06B6D433" }}
                >
                  Included in Pro & Business plans
                </p>
              </div>

              {/* Visual */}
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
              >
                <p className="text-gray-500 text-xs font-mono mb-4">
                  // Weekly Learning Loop report
                </p>
                {[
                  { icon: "📊", text: "47 calls reviewed this week", color: "#3B82F6" },
                  { icon: "⚠️", text: "3 unanswered questions detected", color: "#F59E0B" },
                  { icon: "💡", text: '"What areas do you service?" — added to KB', color: "#22C55E" },
                  { icon: "💡", text: '"Do you do fleet vehicles?" — added to KB', color: "#22C55E" },
                  { icon: "✅", text: "Agent updated. Approved by operator.", color: "#22C55E" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-2"
                    style={{ borderBottom: i < 4 ? "1px solid #1F1F1F" : "none" }}
                  >
                    <span className="text-base flex-shrink-0">{item.icon}</span>
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
        <section className="py-20 px-4" style={{ backgroundColor: "#0D0D0D" }}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              Is unmissed.ai right for you?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* NOT for you */}
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
              >
                <p className="text-red-400 font-semibold text-sm uppercase tracking-wider mb-4">
                  ✗ Not for you if…
                </p>
                <ul className="space-y-3 text-gray-500 text-sm">
                  {[
                    "You already have a full-time receptionist",
                    "Your business gets fewer than 5 calls/week",
                    "You're looking for a chatbot or live chat",
                    "You want to stay on hold talking to customers",
                    "You're not willing to call back warm leads",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-red-500 flex-shrink-0">✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* IS for you */}
              <div
                className="rounded-2xl p-6"
                style={{
                  backgroundColor: "#0D1F0D",
                  border: "1px solid #166534",
                }}
              >
                <p className="text-green-400 font-semibold text-sm uppercase tracking-wider mb-4">
                  ✓ Built for you if…
                </p>
                <ul className="space-y-3 text-gray-300 text-sm">
                  {[
                    "You miss calls while physically doing the work",
                    "You've lost a job to a competitor who picked up",
                    "You want leads captured even at midnight",
                    "You want to call back only qualified, ready-to-buy leads",
                    "You want setup done for you in 24 hours — not weeks",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-green-400 flex-shrink-0">✓</span>
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
          style={{ backgroundColor: "#0A0A0A" }}
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p
                className="text-xs font-mono uppercase tracking-widest mb-2"
                style={{ color: "#3B82F6" }}
              >
                Pricing
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                Simple, honest pricing.
              </h2>
              <p className="text-gray-500 text-lg">
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
                style={{ color: "#3B82F6" }}
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
          style={{ backgroundColor: "#0D1A2E", borderTop: "1px solid #1E3A5F" }}
        >
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-white font-bold text-lg mb-1">
              🔒 Founding Member Pricing — $147/mo locked for life.
            </p>
            <p className="text-gray-400 text-sm mb-4">
              Price increases to $197/mo after the first 50 clients.
              <strong className="text-white"> Limited spots remaining.</strong>
            </p>
            <Link
              href="/onboard"
              className="inline-block px-8 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "#3B82F6" }}
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
          style={{ backgroundColor: "#0A0A0A", borderTop: "1px solid #1F1F1F" }}
        >
          <div className="max-w-2xl mx-auto text-center">
            <p
              className="text-xs font-mono uppercase tracking-widest mb-2"
              style={{ color: "#3B82F6" }}
            >
              Try it right now
            </p>
            <h2 className="text-3xl font-bold text-white mb-4">
              Don&apos;t take our word for it. Call it yourself.
            </h2>
            <p className="text-gray-500 text-lg mb-6">
              This is a live demo agent. Talk to it. Ask it anything.
              Experience exactly what your customers will hear.
            </p>
            <div
              className="inline-block px-8 py-5 rounded-2xl mb-4"
              style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
            >
              <p className="text-gray-500 text-xs mb-1">Call our live demo agent:</p>
              <p className="text-3xl font-black text-white tracking-wider">
                Coming Soon
              </p>
              <p className="text-gray-600 text-xs mt-1">
                Demo line being set up — check back soon
              </p>
            </div>
            <p className="text-gray-600 text-xs">
              Live demo agent · No obligation · Powered by unmissed.ai
            </p>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────── */}
        <section
          className="py-24 px-4 text-center"
          style={{ backgroundColor: "#0D0D0D", borderTop: "1px solid #1F1F1F" }}
        >
          <div className="max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Stop leaving money on the table.
            </h2>
            <p className="text-gray-400 text-xl mb-8">
              Every call you miss is a job that went to someone who picked up.
            </p>
            <Link
              href="/onboard"
              className="inline-block px-10 py-4 rounded-xl text-white font-bold text-lg transition-colors"
              style={{ backgroundColor: "#3B82F6" }}
            >
              Get My Agent Set Up →
            </Link>
            <p className="text-gray-600 text-xs mt-3">
              Agent live within 24 hours · No contracts · 30-day money-back guarantee
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
