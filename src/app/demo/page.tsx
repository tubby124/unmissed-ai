import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DemoAudioPlayer from "@/components/DemoAudioPlayer";
import LeadCard from "@/components/LeadCard";
import ErrorBoundary from "@/components/ErrorBoundary";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Hear a Phone Demo — ${BRAND_NAME}`,
  description:
    "See how EndVoicemail replaces voicemail with a receptionist-style demo flow: ask, wait, probe, summarize, and convert missed calls into callback-ready leads.",
  openGraph: {
    title: `Hear a Phone Demo — ${BRAND_NAME}`,
    description: "Real phone demos and missed-call summaries for auto glass, HVAC, plumbing, dental, legal, and salon businesses.",
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
              Phone Demo
            </p>
            <h1 className="text-4xl md:text-5xl font-black mb-4" style={{ color: "var(--color-text-1)" }}>
              Hear voicemail get replaced.
            </h1>
            <p className="text-xl" style={{ color: "var(--color-text-2)" }}>
              Hear the demo flow we actually want: Zara asks one useful question, waits, probes, then turns the call into a clean owner summary.
              Industry tabs are examples — the default is generic voicemail replacement.
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
                Instant email summary, with Telegram available for faster lead alerts.
              </p>
            </div>
            <ErrorBoundary>
              <LeadCard niche="voicemail" />
            </ErrorBoundary>
          </div>
        </section>

        {/* Phone demo CTA */}
        <section
          className="py-20 px-4 text-center"
          style={{ backgroundColor: "var(--color-bg)", borderTop: "1px solid var(--color-border)" }}
        >
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--color-text-1)" }}>
              Want Zara to call your phone?
            </h2>
            <p className="text-lg mb-6" style={{ color: "var(--color-text-2)" }}>
              Enter your number and Zara calls you with the demo — no app install, no fake chat demo.
            </p>
            <div className="flex flex-col items-center gap-4">
              <Link
                href="/try"
                className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Get a Phone Demo Call &rarr;
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
