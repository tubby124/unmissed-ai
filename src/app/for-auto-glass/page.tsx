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
  title: "AI Receptionist for Auto Glass Shops — unmissed.ai",
  description:
    "Never lose another windshield job to voicemail. Your AI agent handles calls while you do installs — 24/7, with instant lead cards delivered to your phone.",
  openGraph: {
    title: "AI Receptionist for Auto Glass Shops — unmissed.ai",
    description: "Stop losing $150–$800 windshield jobs to voicemail. AI agent answers every call, collects vehicle details, ADAS requirements, and sends instant alerts.",
  },
};

const autoGlassSchema = nicheSchema(
  "Auto Glass Receptionist AI",
  "AI receptionist service for auto glass shops. Answers inbound calls, collects vehicle details, damage description, and ADAS calibration requirements. Delivers structured lead cards via Telegram/SMS."
);

const collected = [
  { icon: "🚗", label: "Year, Make, Model" },
  { icon: "💥", label: "Damage type & size" },
  { icon: "📍", label: "Damage location on glass" },
  { icon: "🔧", label: "ADAS calibration required?" },
  { icon: "⏰", label: "Urgency (driving today?)" },
  { icon: "📞", label: "Caller name + callback number" },
  { icon: "🛡️", label: "Insurance or cash pay?" },
];

export default function ForAutoGlassPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(autoGlassSchema) }}
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
                  For Auto Glass Shops
                </p>
                <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
                  Stop losing windshield jobs to voicemail.
                </h1>
                <p className="text-gray-400 text-lg leading-relaxed mb-6">
                  You&apos;re in the middle of a ADAS calibration. A customer calls
                  about a cracked windshield on their 2024 F-150. 3 rings. They hang up
                  and call the next shop. That&apos;s a $600 job gone.
                </p>
                <p className="text-white font-semibold text-lg mb-8">
                  Your AI receptionist answers. Every time.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/onboard?niche=auto_glass"
                    className="px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "#3B82F6" }}
                  >
                    Get My Auto Glass Agent →
                  </Link>
                  <Link
                    href="#demo"
                    className="px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "#111111", color: "#D1D5DB", border: "1px solid #1F1F1F" }}
                  >
                    Hear a Real Call ↓
                  </Link>
                </div>

                <p className="text-gray-600 text-xs mt-3">
                  🔒 No contracts · Agent live within 24 hours
                </p>
              </div>

              {/* Lead card preview */}
              <div>
                <p className="text-gray-500 text-xs text-center mb-3">
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
          style={{ backgroundColor: "#0D0D0D", borderTop: "1px solid #1F1F1F", borderBottom: "1px solid #1F1F1F" }}
        >
          <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#3B82F6" }}>$150–$800</p>
              <p className="text-gray-500 text-sm">Avg glass job value</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#EF4444" }}>3 jobs/week</p>
              <p className="text-gray-500 text-sm">Typical missed calls per shop</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#22C55E" }}>$93,600</p>
              <p className="text-gray-500 text-sm">Annual revenue at risk</p>
            </div>
          </div>
        </div>

        {/* What your agent collects */}
        <section className="py-20 px-4" style={{ backgroundColor: "#0A0A0A" }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Your agent collects everything you need to quote the job.
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
                &ldquo;I used to lose 3–4 windshield jobs a week to voicemail while I was
                doing installs. My agent catches everything now — even at 11pm.
                The lead card hits my phone before I&apos;m done with the job I&apos;m on.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: "#3B82F6" }}
                >
                  M
                </div>
                <div>
                  <p className="text-white font-semibold">Mark T.</p>
                  <p className="text-gray-500 text-sm">Windshield Hub Auto Glass · Calgary, AB</p>
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
                One missed job pays for 6 months.
              </h2>
              <p className="text-gray-500">
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
        <section className="py-20 px-4 text-center" style={{ backgroundColor: "#0D0D0D" }}>
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-4">
              Never lose a windshield job to voicemail again.
            </h2>
            <Link
              href="/onboard?niche=auto_glass"
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "#3B82F6" }}
            >
              Get My Auto Glass Agent →
            </Link>
            <p className="text-gray-600 text-xs mt-3">
              Agent live within 24 hours · No contracts · 30-day guarantee
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
