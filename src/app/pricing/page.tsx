import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PricingCards from "@/components/PricingCards";
import CostComparisonTable from "@/components/CostComparisonTable";
import FaqAccordion from "@/components/FaqAccordion";
import ErrorBoundary from "@/components/ErrorBoundary";
import { pricingSchema } from "@/lib/schema";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing — unmissed.ai AI Receptionist",
  description:
    "Simple monthly pricing, no contracts. AI receptionist plans starting at $147/mo. Cancel anytime.",
  openGraph: {
    title: "Pricing — unmissed.ai",
    description: "AI receptionist plans from $147/mo. No contracts, no per-minute charges.",
  },
};

const comparisonRows = [
  { feature: "Pricing", dialzara: "$29+/mo (per minute)", smithai: "$255+/mo (per minute)", unmissed: "$147–$397 flat" },
  { feature: "Per-minute charges", dialzara: "Yes — caps at 60 min", smithai: "Yes — expensive overages", unmissed: "Never" },
  { feature: "Done-for-you setup", dialzara: "Self-serve", smithai: "Assisted", unmissed: "100% done for you" },
  { feature: "Custom agent persona", dialzara: "Limited", smithai: "Yes (higher tiers)", unmissed: "Yes (Pro+)" },
  { feature: "Learns from its own calls", dialzara: "No", smithai: "No", unmissed: "Yes — The Learning Loop" },
  { feature: "Telegram/SMS alerts", dialzara: "Email only", smithai: "Email + SMS", unmissed: "Telegram + SMS" },
  { feature: "Google Sheets integration", dialzara: "No", smithai: "No", unmissed: "Yes — your data, your sheet" },
];

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSchema) }}
      />

      <Navbar />

      <main style={{ backgroundColor: "#0A0A0A" }}>
        {/* Header */}
        <section className="pt-32 pb-16 px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <p
              className="text-xs font-mono uppercase tracking-widest mb-3"
              style={{ color: "#3B82F6" }}
            >
              Pricing
            </p>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
              Simple, honest pricing.
            </h1>
            <p className="text-gray-400 text-xl leading-relaxed mb-6">
              No per-minute charges. No setup fees. No long-term contracts.
              Your agent is live within 24 hours.
            </p>
            <div
              className="inline-block px-4 py-2 rounded-full text-sm font-semibold"
              style={{ backgroundColor: "#0D1A2E", color: "#60A5FA", border: "1px solid #1E3A5F" }}
            >
              🔒 Founding Member Pricing — locked for life for the first 50 clients
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="pb-16 px-4">
          <div className="max-w-5xl mx-auto">
            <ErrorBoundary>
              <PricingCards />
            </ErrorBoundary>
          </div>
        </section>

        {/* Guarantee bar */}
        <div
          className="py-6 px-4 text-center"
          style={{ backgroundColor: "#0D1F0D", borderTop: "1px solid #166534", borderBottom: "1px solid #166534" }}
        >
          <p className="text-green-400 font-semibold text-sm">
            ✅ 30-day money-back guarantee · No contracts · Cancel anytime with 30 days notice
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Your call log data lives in your Google Sheet — you keep it if you ever leave.
          </p>
        </div>

        {/* Competitor comparison */}
        <section className="py-20 px-4" style={{ backgroundColor: "#0D0D0D" }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-white mb-3">
                Why not use Dialzara or Smith.ai?
              </h2>
              <p className="text-gray-500">
                They charge per minute. We charge per month. The math isn&apos;t complicated.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #1F1F1F" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "#111111", borderBottom: "1px solid #1F1F1F" }}>
                    <th className="text-left p-4 text-gray-400 font-medium">Feature</th>
                    <th className="text-center p-4 text-gray-400 font-medium">Dialzara</th>
                    <th className="text-center p-4 text-gray-400 font-medium">Smith.ai</th>
                    <th
                      className="text-center p-4 font-semibold"
                      style={{ color: "#3B82F6", backgroundColor: "#0D1A2E" }}
                    >
                      unmissed.ai ⭐
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        backgroundColor: i % 2 === 0 ? "#0A0A0A" : "#0D0D0D",
                        borderBottom: "1px solid #1F1F1F",
                      }}
                    >
                      <td className="p-4 text-gray-300 font-medium">{row.feature}</td>
                      <td className="p-4 text-center text-gray-500">{row.dialzara}</td>
                      <td className="p-4 text-center text-gray-500">{row.smithai}</td>
                      <td
                        className="p-4 text-center font-semibold"
                        style={{ color: "#22C55E", backgroundColor: "rgba(34,197,94,0.04)" }}
                      >
                        {row.unmissed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Human vs AI comparison */}
        <ErrorBoundary>
          <CostComparisonTable />
        </ErrorBoundary>

        {/* FAQ */}
        <ErrorBoundary>
          <FaqAccordion />
        </ErrorBoundary>

        {/* Final CTA */}
        <section className="py-20 px-4 text-center" style={{ backgroundColor: "#0D0D0D" }}>
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to stop missing calls?
            </h2>
            <Link
              href="/onboard"
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "#3B82F6" }}
            >
              Get My Agent Set Up →
            </Link>
            <p className="text-gray-600 text-xs mt-3">
              Agent live within 24 hours · No contracts
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
