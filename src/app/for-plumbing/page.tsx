import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LeadCard from "@/components/LeadCard";
import PricingCards from "@/components/PricingCards";
import FaqAccordion from "@/components/FaqAccordion";
import ErrorBoundary from "@/components/ErrorBoundary";
import TryDemoPopup from "@/components/TryDemoPopup";
import { nicheSchema } from "@/lib/schema";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Receptionist for Plumbers — unmissed.ai",
  description:
    "Never lose a plumbing emergency to voicemail. Your AI handles calls 24/7 — triages leaks, collects details, sends you instant alerts.",
  openGraph: {
    title: "AI Receptionist for Plumbers — unmissed.ai",
    description: "Never lose a plumbing emergency to voicemail. Your AI handles calls 24/7 — triages leaks, collects details, sends you instant alerts.",
  },
};

const plumbingSchema = nicheSchema(
  "Plumbing Receptionist AI",
  "AI receptionist for plumbing companies. Triages emergency calls, collects issue details, and delivers structured lead cards."
);

const collected = [
  { icon: "\u{1F6BF}", label: "Type of issue (leak, clog, water heater, sewer)" },
  { icon: "\u{26A0}\u{FE0F}", label: "Emergency level (flooding, no water, can wait)" },
  { icon: "\u{1F3E0}", label: "Residential or commercial?" },
  { icon: "\u{1F4CD}", label: "Service address" },
  { icon: "\u{1F4C5}", label: "Preferred timing" },
  { icon: "\u{1F4DE}", label: "Caller name + callback" },
  { icon: "\u{1F527}", label: "Anything they've already tried" },
];

export default function ForPlumbingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(plumbingSchema) }}
      />

      <Navbar />

      <main style={{ backgroundColor: "var(--color-bg)" }}>
        {/* Hero */}
        <section className="relative pt-32 pb-20 px-4 overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-3xl opacity-10 pointer-events-none"
            style={{ backgroundColor: "var(--color-primary)" }}
          />
          <div className="relative max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p
                  className="text-xs font-mono uppercase tracking-widest mb-3"
                  style={{ color: "var(--color-primary)" }}
                >
                  For Plumbers
                </p>
                <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight" style={{ color: "var(--color-text-1)" }}>
                  Stop losing emergency jobs to voicemail.
                </h1>
                <p className="text-lg leading-relaxed mb-6" style={{ color: "var(--color-text-2)" }}>
                  A pipe bursts at midnight. The homeowner is panicking, water everywhere.
                  They call your company. Voicemail. They call the next plumber on Google.
                  That&apos;s a $400+ emergency job gone.
                </p>
                <p className="font-semibold text-lg mb-8" style={{ color: "var(--color-text-1)" }}>
                  Your AI receptionist answers. Every time.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/onboard?niche=plumbing"
                    className="px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    Get My Plumbing Agent &rarr;
                  </Link>
                  <Link
                    href="/try"
                    className="px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text-2)", border: "1px solid var(--color-border)" }}
                  >
                    Try a Live Demo
                  </Link>
                </div>

                <p className="text-xs mt-3" style={{ color: "var(--color-text-3)" }}>
                  No contracts &middot; Agent live within 24 hours
                </p>
              </div>

              {/* Lead card preview */}
              <div>
                <p className="text-xs text-center mb-3" style={{ color: "var(--color-text-2)" }}>
                  This hits your Telegram within seconds of every call:
                </p>
                <LeadCard niche="plumbing" />
              </div>
            </div>
          </div>
        </section>

        {/* Niche stat bar */}
        <div
          className="py-8 px-4"
          style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "var(--color-primary)" }}>$200&ndash;$600</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Avg service call value</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#EF4444" }}>4 calls/week</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Missed after hours</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#22C55E" }}>$124,800</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Annual revenue at risk</p>
            </div>
          </div>
        </div>

        {/* What your agent collects */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
                Your agent collects everything you need to dispatch the right plumber.
              </h2>
              <p style={{ color: "var(--color-text-2)" }}>
                Before you even call them back, you know exactly what the job involves.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {collected.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl p-4 text-center"
                  style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-1)" }}>{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Demo link */}
        <section id="demo" className="py-12 px-4">
          <div
            className="max-w-2xl mx-auto rounded-xl p-6 text-center"
            style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            <p className="text-amber-400 font-semibold text-sm mb-1">Coming Soon</p>
            <p style={{ color: "var(--color-text-2)" }} className="text-sm mb-3">
              We&apos;re onboarding our first plumbing clients now. Try our live agents in the meantime:
            </p>
            <Link
              href="/try"
              className="inline-block px-6 py-2.5 rounded-xl text-white font-semibold text-sm"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Try a Live Demo Agent
            </Link>
          </div>
        </section>

        {/* Testimonial */}
        <section className="py-16 px-4" style={{ backgroundColor: "var(--color-surface)" }}>
          <div className="max-w-2xl mx-auto">
            <div
              className="rounded-2xl p-8"
              style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <p className="text-lg leading-relaxed mb-4 italic" style={{ color: "var(--color-text-1)" }}>
                &ldquo;Plumbing emergencies don&apos;t wait for business hours. My agent
                catches the 2 AM pipe burst calls, the weekend toilet overflows &mdash;
                all of it. I wake up to a lead card with every detail I need.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  D
                </div>
                <div>
                  <p className="font-semibold" style={{ color: "var(--color-text-1)" }}>Dave P.</p>
                  <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Plumbing company owner &middot; Calgary, AB</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-2" style={{ color: "var(--color-text-1)" }}>
                One missed emergency pays for 6 months.
              </h2>
              <p style={{ color: "var(--color-text-2)" }}>
                At $400/avg job, a single captured lead covers your entire plan cost.
              </p>
            </div>
            <ErrorBoundary>
              <PricingCards compact />
            </ErrorBoundary>
          </div>
        </section>

        {/* FAQ */}
        <ErrorBoundary>
          <FaqAccordion />
        </ErrorBoundary>

        {/* Final CTA */}
        <section className="py-20 px-4 text-center" style={{ backgroundColor: "var(--color-surface)" }}>
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--color-text-1)" }}>
              Never lose a plumbing job to voicemail again.
            </h2>
            <Link
              href="/onboard?niche=plumbing"
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Get My Plumbing Agent &rarr;
            </Link>
            <p className="text-xs mt-3" style={{ color: "var(--color-text-3)" }}>
              Agent live within 24 hours &middot; No contracts &middot; 30-day guarantee
            </p>
          </div>
        </section>
      </main>

      <Footer />
      <TryDemoPopup />
    </>
  );
}
