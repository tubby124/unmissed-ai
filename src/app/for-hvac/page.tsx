import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LeadCard from "@/components/LeadCard";
import PricingCards from "@/components/PricingCards";
import FaqAccordion from "@/components/FaqAccordion";
import DemoAudioPlayer from "@/components/DemoAudioPlayer";
import ErrorBoundary from "@/components/ErrorBoundary";
import { nicheSchema } from "@/lib/schema";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Receptionist for HVAC Companies — unmissed.ai",
  description:
    "Never lose a furnace repair call to voicemail. Your AI agent handles calls 24/7 — even during emergency season.",
  openGraph: {
    title: "AI Receptionist for HVAC Companies — unmissed.ai",
    description: "Never lose a furnace repair call to voicemail. Your AI agent handles calls 24/7 — even during emergency season.",
  },
};

const hvacSchema = nicheSchema(
  "HVAC Receptionist AI",
  "AI receptionist for HVAC companies. Answers inbound calls, triages heating/cooling emergencies, collects system details and schedules service."
);

const collected = [
  { icon: "\u{1F3E0}", label: "Heating or cooling issue?" },
  { icon: "\u{1F321}\u{FE0F}", label: "System type (furnace, AC, heat pump)" },
  { icon: "\u{23F0}", label: "How urgent? (no heat, uncomfortable, maintenance)" },
  { icon: "\u{1F4C5}", label: "Preferred service window" },
  { icon: "\u{1F4CD}", label: "Service address" },
  { icon: "\u{1F4DE}", label: "Caller name + callback" },
  { icon: "\u{1F527}", label: "System age if known" },
];

export default function ForHvacPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hvacSchema) }}
      />

      <Navbar />

      <main style={{ backgroundColor: "#0A0A0A" }}>
        {/* Hero */}
        <section className="relative pt-32 pb-20 px-4 overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-3xl opacity-10 pointer-events-none"
            style={{ backgroundColor: "#3B82F6" }}
          />
          <div className="relative max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p
                  className="text-xs font-mono uppercase tracking-widest mb-3"
                  style={{ color: "#3B82F6" }}
                >
                  For HVAC Companies
                </p>
                <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
                  Stop losing emergency calls to voicemail.
                </h1>
                <p className="text-gray-400 text-lg leading-relaxed mb-6">
                  It&apos;s -30&deg;C and a furnace goes out at 2 AM. The homeowner calls
                  your company. 3 rings. Voicemail. They call the next HVAC company.
                  That&apos;s a $500 emergency call gone.
                </p>
                <p className="text-white font-semibold text-lg mb-8">
                  Your AI receptionist answers. Every time.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/onboard?niche=hvac"
                    className="px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "#3B82F6" }}
                  >
                    Get My HVAC Agent &rarr;
                  </Link>
                  <Link
                    href="#demo"
                    className="px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "#111111", color: "#D1D5DB", border: "1px solid #1F1F1F" }}
                  >
                    Hear a Real Call &darr;
                  </Link>
                </div>

                <p className="text-gray-600 text-xs mt-3">
                  No contracts &middot; Agent live within 24 hours
                </p>
              </div>

              {/* Lead card preview */}
              <div>
                <p className="text-gray-500 text-xs text-center mb-3">
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
          style={{ backgroundColor: "#0D0D0D", borderTop: "1px solid #1F1F1F", borderBottom: "1px solid #1F1F1F" }}
        >
          <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#3B82F6" }}>$200&ndash;$800</p>
              <p className="text-gray-500 text-sm">Avg service call value</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#EF4444" }}>5+ calls/week</p>
              <p className="text-gray-500 text-sm">Missed during peak season</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#22C55E" }}>$156,000</p>
              <p className="text-gray-500 text-sm">Annual revenue at risk</p>
            </div>
          </div>
        </div>

        {/* What your agent collects */}
        <section className="py-20 px-4" style={{ backgroundColor: "#0A0A0A" }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Your agent collects everything you need to dispatch the right tech.
              </h2>
              <p className="text-gray-500">
                Before you even call them back, you know exactly what the job involves.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {collected.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl p-4 text-center"
                  style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
                >
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <p className="text-gray-300 text-sm font-medium">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Demo audio */}
        <section id="demo">
          <ErrorBoundary>
            <DemoAudioPlayer />
          </ErrorBoundary>
        </section>

        {/* Testimonial */}
        <section className="py-16 px-4" style={{ backgroundColor: "#0D0D0D" }}>
          <div className="max-w-2xl mx-auto">
            <div
              className="rounded-2xl p-8"
              style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
            >
              <p className="text-gray-300 text-lg leading-relaxed mb-4 italic">
                &ldquo;We get slammed with no-heat calls every winter. Before, half went
                to voicemail after hours. Now every call gets answered, triaged, and I
                get a lead card before I finish the job I&apos;m on.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: "#3B82F6" }}
                >
                  M
                </div>
                <div>
                  <p className="text-white font-semibold">Mike R.</p>
                  <p className="text-gray-500 text-sm">HVAC company owner &middot; Edmonton, AB</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-20 px-4" style={{ backgroundColor: "#0A0A0A" }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-white mb-2">
                One missed service call pays for 6 months.
              </h2>
              <p className="text-gray-500">
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
        <section className="py-20 px-4 text-center" style={{ backgroundColor: "#0D0D0D" }}>
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-4">
              Never lose a service call to voicemail again.
            </h2>
            <Link
              href="/onboard?niche=hvac"
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "#3B82F6" }}
            >
              Get My HVAC Agent &rarr;
            </Link>
            <p className="text-gray-600 text-xs mt-3">
              Agent live within 24 hours &middot; No contracts &middot; 30-day guarantee
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
