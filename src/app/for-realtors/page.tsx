import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LeadCard from "@/components/LeadCard";
import PricingCards from "@/components/PricingCards";
import FaqAccordion from "@/components/FaqAccordion";
import ErrorBoundary from "@/components/ErrorBoundary";
import { nicheSchema } from "@/lib/schema";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Receptionist for Real Estate Agents — unmissed.ai",
  description:
    "Handle every buyer and seller inquiry while you're showing properties. Your AI handles calls, qualifies leads, and sends instant alerts. 2,082+ calls handled for realtors.",
  openGraph: {
    title: "AI Receptionist for Real Estate Agents — unmissed.ai",
    description: "Your AI that handles calls while you show properties. 2,082 calls handled for Hasan Sharif at eXp Realty.",
  },
};

const realtySchema = nicheSchema(
  "Real Estate AI Receptionist",
  "AI receptionist and lead qualification service for real estate agents. Handles inbound buyer and seller inquiries, qualifies leads by budget, timeline, and pre-approval status, and delivers structured lead cards via Telegram/SMS."
);

const collected = [
  { icon: "🏠", label: "Buying or selling?" },
  { icon: "💰", label: "Budget range" },
  { icon: "✅", label: "Pre-approved?" },
  { icon: "📅", label: "Timeline to move" },
  { icon: "📍", label: "Preferred area" },
  { icon: "📞", label: "Name + callback number" },
  { icon: "🔑", label: "Bedrooms / property type" },
];

export default function ForRealtorsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(realtySchema) }}
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
                  For Real Estate Agents
                </p>
                <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
                  Your AI that handles calls while you show properties.
                </h1>
                <p className="text-gray-400 text-lg leading-relaxed mb-6">
                  You&apos;re in the middle of a showing. A buyer calls about a listing.
                  You can&apos;t pick up. They call the next agent. You lost the lead.
                </p>
                <p className="text-white font-semibold text-lg mb-4">
                  Your AI agent qualifies every inquiry — even at 11pm.
                </p>
                <p
                  className="text-sm px-3 py-2 rounded-lg mb-8 inline-block"
                  style={{ backgroundColor: "#0D1A2E", color: "#60A5FA" }}
                >
                  📊 Proven: 2,082 calls handled for Hasan Sharif at eXp Realty
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/onboard?niche=realty"
                    className="px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "#3B82F6" }}
                  >
                    Get My Realtor Agent →
                  </Link>
                  <Link
                    href="/demo"
                    className="px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "#111111", color: "#D1D5DB", border: "1px solid #1F1F1F" }}
                  >
                    Hear a Demo Call →
                  </Link>
                </div>

                <p className="text-gray-600 text-xs mt-3">
                  🔒 No contracts · Agent live within 24 hours
                </p>
              </div>

              {/* Lead card preview */}
              <div>
                <p className="text-gray-500 text-xs text-center mb-3">
                  This hits your Telegram within seconds of every inquiry:
                </p>
                <LeadCard niche="realty" />
              </div>
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <div
          className="py-8 px-4"
          style={{ backgroundColor: "#0D0D0D", borderTop: "1px solid #1F1F1F", borderBottom: "1px solid #1F1F1F" }}
        >
          <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#3B82F6" }}>2,082</p>
              <p className="text-gray-500 text-sm">Calls handled for Hasan Sharif</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#EF4444" }}>$12,000+</p>
              <p className="text-gray-500 text-sm">Avg deal commission</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#22C55E" }}>24/7</p>
              <p className="text-gray-500 text-sm">Coverage — even on showings</p>
            </div>
          </div>
        </div>

        {/* What your agent collects */}
        <section className="py-20 px-4" style={{ backgroundColor: "#0A0A0A" }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Pre-qualified leads waiting in your Telegram.
              </h2>
              <p className="text-gray-500">
                By the time you call back, you already know their budget, timeline, and readiness.
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

        {/* Case study — Hasan */}
        <section className="py-16 px-4" style={{ backgroundColor: "#0D0D0D" }}>
          <div className="max-w-3xl mx-auto">
            <div
              className="rounded-2xl p-8"
              style={{ backgroundColor: "#0D1A2E", border: "1px solid #1E3A5F" }}
            >
              <p
                className="text-xs font-mono uppercase tracking-widest mb-3"
                style={{ color: "#60A5FA" }}
              >
                Live Client Case Study
              </p>
              <p className="text-white text-xl font-bold mb-4">
                Hasan Sharif — eXp Realty, Saskatoon SK
              </p>
              <p className="text-gray-300 text-lg leading-relaxed mb-4 italic">
                &ldquo;Aisha handled 2,082 calls while I was showing properties. Every lead card
                hit my Telegram before I was done with the walkthrough. I know exactly who
                called, what they&apos;re looking for, and whether they&apos;re pre-approved
                before I even call back.&rdquo;
              </p>
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6" style={{ borderTop: "1px solid #1E3A5F" }}>
                <div className="text-center">
                  <p className="text-2xl font-black text-white">2,082</p>
                  <p className="text-gray-400 text-xs">Calls handled</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-white">0</p>
                  <p className="text-gray-400 text-xs">Missed inquiries</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-white">24/7</p>
                  <p className="text-gray-400 text-xs">Coverage</p>
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
                One qualified lead pays for a year.
              </h2>
              <p className="text-gray-500">
                At $12,000+ avg commission, the math is obvious.
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
              Never miss a buyer inquiry again.
            </h2>
            <Link
              href="/onboard?niche=realty"
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "#3B82F6" }}
            >
              Get My Realtor Agent →
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
