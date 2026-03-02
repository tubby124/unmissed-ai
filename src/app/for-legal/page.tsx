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
  title: "AI Receptionist for Law Firms — unmissed.ai",
  description:
    "Never lose a potential client to voicemail. Your AI receptionist screens calls, collects case details, and sends instant consultation requests.",
  openGraph: {
    title: "AI Receptionist for Law Firms — unmissed.ai",
    description: "Never lose a potential client to voicemail. Your AI receptionist screens calls, collects case details, and sends instant consultation requests.",
  },
};

const legalSchema = nicheSchema(
  "Law Firm Receptionist AI",
  "AI receptionist for law firms. Screens potential clients, collects case type and details, and delivers structured intake cards."
);

const collected = [
  { icon: "\u2696\uFE0F", label: "Area of law (PI, family, criminal, business, real estate)" },
  { icon: "\u{1F4CB}", label: "Brief case description" },
  { icon: "\u23F0", label: "Urgency (active case, deadline, general inquiry)" },
  { icon: "\u{1F4C5}", label: "Consultation preference" },
  { icon: "\u{1F4DE}", label: "Caller name + callback" },
  { icon: "\u{1F91D}", label: "Have they spoken to other firms?" },
  { icon: "\u{1F4CD}", label: "Jurisdiction / location" },
];

export default function ForLegalPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(legalSchema) }}
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
                  For Law Firms
                </p>
                <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
                  Stop losing clients to voicemail.
                </h1>
                <p className="text-gray-400 text-lg leading-relaxed mb-6">
                  Someone just got in a car accident. They need a personal injury
                  lawyer now. They call your firm at 6 PM. Voicemail. They call the
                  next firm. That&apos;s a $3,000&ndash;$50,000 retainer gone.
                </p>
                <p className="text-white font-semibold text-lg mb-8">
                  Your AI receptionist answers. Every time.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/onboard?niche=legal"
                    className="px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "#3B82F6" }}
                  >
                    Get My Law Firm Agent &rarr;
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
                  {"\u{1F512}"} No contracts &middot; Agent live within 24 hours
                </p>
              </div>

              {/* Lead card preview */}
              <div>
                <p className="text-gray-500 text-xs text-center mb-3">
                  This hits your Telegram within seconds of every call:
                </p>
                <LeadCard niche="legal" />
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
              <p className="text-3xl font-black mb-1" style={{ color: "#3B82F6" }}>$3,000&ndash;$10,000</p>
              <p className="text-gray-500 text-sm">Avg retainer value</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#EF4444" }}>6+ calls/week</p>
              <p className="text-gray-500 text-sm">Missed after hours</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#22C55E" }}>$936,000</p>
              <p className="text-gray-500 text-sm">Annual revenue at risk</p>
            </div>
          </div>
        </div>

        {/* What your agent collects */}
        <section className="py-20 px-4" style={{ backgroundColor: "#0A0A0A" }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Your agent collects everything you need to qualify the lead.
              </h2>
              <p className="text-gray-500">
                Before you even call them back, you know exactly what the case involves.
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
                &ldquo;Personal injury leads don&apos;t call during business hours. My
                agent screens every call, collects case details, and I wake up to a
                full intake card. We&apos;ve signed 3 extra clients a month we would
                have lost.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: "#3B82F6" }}
                >
                  J
                </div>
                <div>
                  <p className="text-white font-semibold">Jordan M.</p>
                  <p className="text-gray-500 text-sm">Personal injury firm &middot; Calgary, AB</p>
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
                One signed client pays for years of service.
              </h2>
              <p className="text-gray-500">
                At $3,000+ per retainer, a single captured lead covers your entire plan cost many times over.
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
              Never lose a client to voicemail again.
            </h2>
            <Link
              href="/onboard?niche=legal"
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "#3B82F6" }}
            >
              Get My Law Firm Agent &rarr;
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
