import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DemoAudioPlayer from "@/components/DemoAudioPlayer";
import LeadCard from "@/components/LeadCard";
import ErrorBoundary from "@/components/ErrorBoundary";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hear a Real Demo — unmissed.ai",
  description:
    "Listen to real AI receptionist calls for auto glass, HVAC, plumbing, and more. This is exactly what your customers will hear.",
  openGraph: {
    title: "Hear a Real Demo — unmissed.ai",
    description: "Real AI receptionist calls for auto glass, HVAC, plumbing, dental, legal, and salon businesses.",
  },
};

export default function DemoPage() {
  return (
    <>
      <Navbar />

      <main style={{ backgroundColor: "#0A0A0A" }}>
        {/* Header */}
        <section className="pt-32 pb-8 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <p
              className="text-xs font-mono uppercase tracking-widest mb-3"
              style={{ color: "#3B82F6" }}
            >
              Live Demo
            </p>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
              Hear it before you buy.
            </h1>
            <p className="text-gray-400 text-xl">
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
        <section className="py-20 px-4" style={{ backgroundColor: "#0D0D0D" }}>
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-white mb-2">
                After every call, you receive this.
              </h2>
              <p className="text-gray-500">
                Instant Telegram or SMS notification with a structured lead card.
              </p>
            </div>
            <ErrorBoundary>
              <LeadCard niche="auto-glass" />
            </ErrorBoundary>
          </div>
        </section>

        {/* Call yourself CTA */}
        <section
          className="py-20 px-4 text-center"
          style={{ backgroundColor: "#0A0A0A", borderTop: "1px solid #1F1F1F" }}
        >
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-4">
              Want to talk to the agent yourself?
            </h2>
            <p className="text-gray-500 text-lg mb-6">
              Our live demo line is being set up. Check back soon — you&apos;ll be able to
              call and experience it firsthand.
            </p>
            <div
              className="inline-block px-8 py-5 rounded-2xl mb-6"
              style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
            >
              <p className="text-gray-500 text-xs mb-1">Live demo line:</p>
              <p className="text-2xl font-black text-white">Coming Soon</p>
            </div>
            <div>
              <Link
                href="/onboard"
                className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
                style={{ backgroundColor: "#3B82F6" }}
              >
                Ready? Get My Agent Set Up →
              </Link>
              <p className="text-gray-600 text-xs mt-2">
                Agent live within 24 hours · No contracts
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
