import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LeadCard from "@/components/LeadCard";
import PricingCards from "@/components/PricingCards";
import FaqAccordion from "@/components/FaqAccordion";
import ErrorBoundary from "@/components/ErrorBoundary";
import { nicheSchema } from "@/lib/schema";
import Link from "next/link";
import { Home, DollarSign, BadgeCheck, Calendar, MapPin, Phone, Key } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "AI Receptionist for Real Estate Agents — unmissed.ai",
  description:
    "Handle every buyer and seller inquiry while you're showing properties. Your AI handles calls, qualifies leads, and sends instant alerts — 24/7.",
  alternates: {
    canonical: "https://unmissed.ai/for-realtors",
  },
  openGraph: {
    title: "AI Receptionist for Real Estate Agents — unmissed.ai",
    description: "Your AI that handles calls while you show properties. Qualifies buyers and sellers, sends instant lead cards — 24/7.",
  },
};

const realtySchema = nicheSchema(
  "Real Estate AI Receptionist",
  "AI receptionist and lead qualification service for real estate agents. Handles inbound buyer and seller inquiries, qualifies leads by budget, timeline, and pre-approval status, and delivers structured lead cards via Telegram/SMS."
);

const collected: { icon: LucideIcon; label: string }[] = [
  { icon: Home, label: "Buying or selling?" },
  { icon: DollarSign, label: "Budget range" },
  { icon: BadgeCheck, label: "Pre-approved?" },
  { icon: Calendar, label: "Timeline to move" },
  { icon: MapPin, label: "Preferred area" },
  { icon: Phone, label: "Name + callback number" },
  { icon: Key, label: "Bedrooms / property type" },
];

export default function ForRealtorsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(realtySchema) }}
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
                  For Real Estate Agents
                </p>
                <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight" style={{ color: "var(--color-text-1)" }}>
                  Your AI that handles calls while you show properties.
                </h1>
                <p className="text-lg leading-relaxed mb-6" style={{ color: "var(--color-text-2)" }}>
                  You&apos;re in the middle of a showing. A buyer calls about a listing.
                  You can&apos;t pick up. They call the next agent. You lost the lead.
                </p>
                <p className="font-semibold text-lg mb-4" style={{ color: "var(--color-text-1)" }}>
                  Your AI agent qualifies every inquiry — even at 11pm.
                </p>
                <p
                  className="text-sm px-3 py-2 rounded-lg mb-8 inline-block"
                  style={{ backgroundColor: "var(--color-surface)", color: "var(--color-primary)" }}
                >
                  📊 Proven: 2,082 calls handled for Hasan Sharif at eXp Realty
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/onboard?niche=realty"
                    className="px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    Get My Realtor Agent →
                  </Link>
                  <Link
                    href="/demo"
                    className="px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text-2)", border: "1px solid var(--color-border)" }}
                  >
                    Hear a Demo Call →
                  </Link>
                </div>

                <p className="text-xs mt-3" style={{ color: "var(--color-text-3)" }}>
                  🔒 No contracts · Agent live within 24 hours
                </p>
              </div>

              {/* Lead card preview */}
              <div>
                <p className="text-xs text-center mb-3" style={{ color: "var(--color-text-2)" }}>
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
          style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "var(--color-primary)" }}>2,082</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Calls handled for Hasan Sharif</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#EF4444" }}>$12,000+</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Avg deal commission</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#22C55E" }}>24/7</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Coverage — even on showings</p>
            </div>
          </div>
        </div>

        {/* What your agent collects */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
                Pre-qualified leads waiting in your Telegram.
              </h2>
              <p style={{ color: "var(--color-text-2)" }}>
                By the time you call back, you already know their budget, timeline, and readiness.
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

        {/* Pricing */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-2" style={{ color: "var(--color-text-1)" }}>
                One qualified lead pays for a year.
              </h2>
              <p style={{ color: "var(--color-text-2)" }}>
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
        <section className="py-20 px-4 text-center" style={{ backgroundColor: "var(--color-surface)" }}>
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--color-text-1)" }}>
              Never miss a buyer inquiry again.
            </h2>
            <Link
              href="/onboard?niche=realty"
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Get My Realtor Agent →
            </Link>
            <p className="text-xs mt-3" style={{ color: "var(--color-text-3)" }}>
              Agent live within 24 hours · No contracts · 30-day guarantee
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
