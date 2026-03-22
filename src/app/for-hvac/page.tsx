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
import { Home, Thermometer, Clock, Calendar, MapPin, Phone, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `AI Receptionist for HVAC Companies — ${BRAND_NAME}`,
  description:
    "Never lose a furnace repair call to voicemail. Your AI agent handles calls 24/7 — even during emergency season.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-hvac`,
  },
  openGraph: {
    title: `AI Receptionist for HVAC Companies — ${BRAND_NAME}`,
    description: "Never lose a furnace repair call to voicemail. Your AI agent handles calls 24/7 — even during emergency season.",
  },
};

const hvacSchema = nicheSchema(
  "HVAC Receptionist AI",
  "AI receptionist for HVAC companies. Answers inbound calls, triages heating/cooling emergencies, collects system details and schedules service."
);

const collected: { icon: LucideIcon; label: string }[] = [
  { icon: Home, label: "Heating or cooling issue?" },
  { icon: Thermometer, label: "System type (furnace, AC, heat pump)" },
  { icon: Clock, label: "How urgent? (no heat, uncomfortable, maintenance)" },
  { icon: Calendar, label: "Preferred service window" },
  { icon: MapPin, label: "Service address" },
  { icon: Phone, label: "Caller name + callback" },
  { icon: Wrench, label: "System age if known" },
];

export default function ForHvacPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hvacSchema) }}
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
                  For HVAC Companies
                </p>
                <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight" style={{ color: "var(--color-text-1)" }}>
                  Stop losing emergency calls to voicemail.
                </h1>
                <p className="text-lg leading-relaxed mb-6" style={{ color: "var(--color-text-2)" }}>
                  It&apos;s -30&deg;C and a furnace goes out at 2 AM. The homeowner calls
                  your company. 3 rings. Voicemail. They call the next HVAC company.
                  That&apos;s a $500 emergency call gone.
                </p>
                <p className="font-semibold text-lg mb-8" style={{ color: "var(--color-text-1)" }}>
                  Your AI receptionist answers. Every time.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/onboard?niche=hvac"
                    className="px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    Get My HVAC Agent &rarr;
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
                <LeadCard niche="hvac" />
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
              <p className="text-3xl font-black mb-1" style={{ color: "var(--color-primary)" }}>$200&ndash;$800</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Avg service call value</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#EF4444" }}>5+ calls/week</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Missed during peak season</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#22C55E" }}>$156,000</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Annual revenue at risk</p>
            </div>
          </div>
        </div>

        {/* What your agent collects */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
                Your agent collects everything you need to dispatch the right tech.
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
            style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            <p className="text-amber-400 font-semibold text-sm mb-1">Coming Soon</p>
            <p style={{ color: "var(--color-text-2)" }} className="text-sm mb-3">
              We&apos;re onboarding our first HVAC clients now. Try our live agents in the meantime:
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
                One missed service call pays for 6 months.
              </h2>
              <p style={{ color: "var(--color-text-2)" }}>
                At $500/avg job, a single captured lead covers your entire plan cost.
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
              Never lose a service call to voicemail again.
            </h2>
            <Link
              href="/onboard?niche=hvac"
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Get My HVAC Agent &rarr;
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
