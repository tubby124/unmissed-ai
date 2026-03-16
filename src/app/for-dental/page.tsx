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
  title: "AI Receptionist for Dental Offices — unmissed.ai",
  description:
    "Never lose a new patient to voicemail. Your AI receptionist answers calls 24/7, books appointments, and sends you instant patient cards.",
  openGraph: {
    title: "AI Receptionist for Dental Offices — unmissed.ai",
    description: "Never lose a new patient to voicemail. Your AI receptionist answers calls 24/7, books appointments, and sends you instant patient cards.",
  },
};

const dentalSchema = nicheSchema(
  "Dental Office Receptionist AI",
  "AI receptionist for dental offices. Answers calls, screens new patients, collects insurance info, and schedules appointments."
);

const collected = [
  { icon: "\u{1F9B7}", label: "New or existing patient?" },
  { icon: "\u{1F915}", label: "Reason for call (pain, cleaning, cosmetic, emergency)" },
  { icon: "\u23F0", label: "Urgency level" },
  { icon: "\u{1F6E1}\uFE0F", label: "Insurance provider" },
  { icon: "\u{1F4C5}", label: "Preferred appointment time" },
  { icon: "\u{1F4DE}", label: "Patient name + callback" },
  { icon: "\u{1F4CB}", label: "Any relevant medical notes" },
];

export default function ForDentalPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dentalSchema) }}
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
                  For Dental Offices
                </p>
                <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight" style={{ color: "var(--color-text-1)" }}>
                  Stop losing new patients to voicemail.
                </h1>
                <p className="text-lg leading-relaxed mb-6" style={{ color: "var(--color-text-2)" }}>
                  A patient has a toothache at 8 PM. They call your office.
                  Voicemail. They call the next dentist on Google and book there
                  instead. That&apos;s an $800+ new patient &mdash; and every recall
                  visit after &mdash; gone.
                </p>
                <p className="font-semibold text-lg mb-8" style={{ color: "var(--color-text-1)" }}>
                  Your AI receptionist answers. Every time.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/onboard?niche=dental"
                    className="px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    Get My Dental Agent &rarr;
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
                  {"\u{1F512}"} No contracts &middot; Agent live within 24 hours
                </p>
              </div>

              {/* Lead card preview */}
              <div>
                <p className="text-xs text-center mb-3" style={{ color: "var(--color-text-2)" }}>
                  This hits your Telegram within seconds of every call:
                </p>
                <LeadCard niche="dental" />
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
              <p className="text-3xl font-black mb-1" style={{ color: "var(--color-primary)" }}>$800&ndash;$2,000</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Avg new patient lifetime value</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#EF4444" }}>8+ calls/week</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Missed outside office hours</p>
            </div>
            <div>
              <p className="text-3xl font-black mb-1" style={{ color: "#22C55E" }}>$332,800</p>
              <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Annual revenue at risk</p>
            </div>
          </div>
        </div>

        {/* What your agent collects */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
                Your agent collects everything you need to triage and book.
              </h2>
              <p style={{ color: "var(--color-text-2)" }}>
                Before you even call them back, you know exactly what the patient needs.
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
              We&apos;re onboarding our first dental clients now. Try our live agents in the meantime:
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
                &ldquo;Our front desk was drowning in calls during lunch breaks and
                after hours. Now every call gets answered professionally, insurance
                info collected, and appointment preferences noted. We&apos;ve added
                12 new patients a month we were losing to voicemail.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  A
                </div>
                <div>
                  <p className="font-semibold" style={{ color: "var(--color-text-1)" }}>Dr. Ashley K.</p>
                  <p className="text-sm" style={{ color: "var(--color-text-2)" }}>Family Dental &middot; Saskatoon, SK</p>
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
                One new patient pays for a full year.
              </h2>
              <p style={{ color: "var(--color-text-2)" }}>
                At $800+ lifetime value, a single captured patient covers your entire plan cost.
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
              Never lose a new patient to voicemail again.
            </h2>
            <Link
              href="/onboard?niche=dental"
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Get My Dental Agent &rarr;
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
