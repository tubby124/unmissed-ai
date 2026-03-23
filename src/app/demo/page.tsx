import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DemoAudioPlayer from "@/components/DemoAudioPlayer";
import LeadCard from "@/components/LeadCard";
import ErrorBoundary from "@/components/ErrorBoundary";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Hear a Real Demo — ${BRAND_NAME}`,
  description:
    "Listen to real AI receptionist calls for auto glass, HVAC, plumbing, and more. This is exactly what your customers will hear.",
  openGraph: {
    title: `Hear a Real Demo — ${BRAND_NAME}`,
    description: "Real AI receptionist calls for auto glass, HVAC, plumbing, dental, legal, and salon businesses.",
  },
};

export default function DemoPage() {
  return (
    <>
      <Navbar />

      <main style={{ backgroundColor: "var(--color-bg)" }}>
        {/* Header */}
        <section className="pt-32 pb-8 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <p
              className="text-xs font-mono uppercase tracking-widest mb-3"
              style={{ color: "var(--color-primary)" }}
            >
              Live Demo
            </p>
            <h1 className="text-4xl md:text-5xl font-black mb-4" style={{ color: "var(--color-text-1)" }}>
              Hear it before you buy.
            </h1>
            <p className="text-xl" style={{ color: "var(--color-text-2)" }}>
              Real calls. Real agents. Real leads captured.
              Pick your industry below.
            </p>
          </div>
        </section>

        {/* Audio player */}
        <ErrorBoundary>
          <DemoAudioPlayer />
        </ErrorBoundary>

        {/* What you receive section */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--color-text-1)" }}>
                After every call, you receive this.
              </h2>
              <p style={{ color: "var(--color-text-2)" }}>
                Instant Telegram or SMS notification with a structured lead card.
              </p>
            </div>
            <ErrorBoundary>
              <LeadCard niche="auto-glass" />
            </ErrorBoundary>
          </div>
        </section>

        {/* Talk to an agent live CTA */}
        <section
          className="py-20 px-4 text-center"
          style={{ backgroundColor: "var(--color-bg)", borderTop: "1px solid var(--color-border)" }}
        >
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--color-text-1)" }}>
              Want to talk to an agent yourself?
            </h2>
            <p className="text-lg mb-6" style={{ color: "var(--color-text-2)" }}>
              Talk to a live AI agent right in your browser — no phone needed.
              Pick from auto glass, property management, or real estate.
            </p>
            <div className="flex flex-col items-center gap-4">
              <Link
                href="/try"
                className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Try an Agent Live &rarr;
              </Link>
              <Link
                href="/onboard"
                className="text-sm transition-colors"
                style={{ color: "var(--color-text-3)" }}
              >
                Or skip ahead &mdash; Get My Agent Set Up
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
