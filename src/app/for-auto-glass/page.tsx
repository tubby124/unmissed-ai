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
import { Car, Zap, MapPin, Wrench, Clock, Phone, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
    description: "Stop losing $150–$800 windshield jobs to voicemail. AI agent answers every call, collects vehicle details, ADAS requirements, and sends instant alerts.",
  },
};

const autoGlassSchema = nicheSchema(
  "Auto Glass Receptionist AI",
  "AI receptionist service for auto glass shops. Answers inbound calls, collects vehicle details, damage description, and ADAS calibration requirements. Delivers structured lead cards via Telegram/SMS."
);

const collected: { icon: LucideIcon; label: string }[] = [
  { icon: Car, label: "Year, Make, Model" },
  { icon: Zap, label: "Damage type & size" },
  { icon: MapPin, label: "Damage location on glass" },
  { icon: Wrench, label: "ADAS calibration required?" },
  { icon: Clock, label: "Urgency (driving today?)" },
  { icon: Phone, label: "Caller name + callback number" },
  { icon: Shield, label: "Insurance or cash pay?" },
];

export default function ForAutoGlassPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(autoGlassSchema) }}
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
                  For Auto Glass Shops
                </p>
                <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight" style={{ color: "var(--color-text-1)" }}>
                  Stop losing windshield jobs to voicemail.
                </h1>
                <p className="text-lg leading-relaxed mb-6" style={{ color: "var(--color-text-2)" }}>
                  You&apos;re in the middle of a ADAS calibration. A customer calls
                  about a cracked windshield on their 2024 F-150. 3 rings. They hang up
                  and call the next shop. That&apos;s a $600 job gone.
                </p>
                <p className="font-semibold text-lg mb-8" style={{ color: "var(--color-text-1)" }}>
                  Your AI receptionist answers. Every time.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/onboard?niche=auto_glass"
                    className="px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    Get My Auto Glass Agent →
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
                  🔒 No contracts · Agent live within 24 hours
                </p>
              </div>

              {/* Lead card preview */}
              <div>
                <p className="text-xs text-center mb-3" style={{ color: "var(--color-text-2)" }}>
                  This hits your Telegram within seconds of every call:
                </p>
                <LeadCard niche="auto-glass" />
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
              <p className="text-3xl font-black mb-1" style={{ color: "var(--color-primary)" }}>$150–$800</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Avg glass job value</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#EF4444" }}>3 jobs/week</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Typical missed calls per shop</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#22C55E" }}>$93,600</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Annual revenue at risk</p>
            </div>
          </div>
        </div>

        {/* What your agent collects */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
                Your agent collects everything you need to quote the job.
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
                  <div className="flex justify-center mb-2"><item.icon size={22} style={{ color: "var(--color-primary)" }} /></div>
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
            style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            <p className="text-emerald-400 font-semibold text-sm mb-1">Live Agent</p>
            <p style={{ color: "var(--color-text-2)" }} className="text-sm mb-3">
              Talk to our auto glass AI agent right now — free, no sign-up:
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

        {/* Pricing */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-2" style={{ color: "var(--color-text-1)" }}>
                One missed job pays for 6 months.
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
              Never lose a windshield job to voicemail again.
            </h2>
            <Link
              href="/onboard?niche=auto_glass"
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Get My Auto Glass Agent →
            </Link>
            <p className="text-xs mt-3" style={{ color: "var(--color-text-3)" }}>
              Agent live within 24 hours · No contracts · 30-day guarantee
            </p>
          </div>
        </section>
      </main>

      <Footer />
      <TryDemoPopup />
    </>
  );
}
