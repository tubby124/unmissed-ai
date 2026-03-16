import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PricingCards from "@/components/PricingCards";
import CostComparisonTable from "@/components/CostComparisonTable";
import FaqAccordion from "@/components/FaqAccordion";
import ErrorBoundary from "@/components/ErrorBoundary";
import { pricingSchema } from "@/lib/schema";
import Link from "next/link";
import PricingHero, { GuaranteeBar } from "@/components/PricingHero";

export const metadata: Metadata = {
  title: "Pricing — unmissed.ai AI Receptionist",
  description:
    "Simple monthly pricing, no contracts. AI receptionist plans starting at $147/mo. Cancel anytime.",
  openGraph: {
    title: "Pricing — unmissed.ai",
    description: "AI receptionist plans from $147/mo. No contracts, no per-minute charges.",
  },
};

const perMinuteTrapRows = [
  { competitor: "Dialzara", plan: "$29/mo", minutes: "60 min", perMin: "$0.48/min", at100Calls: "$145+", at200Calls: "$290+", catch: "2 min/day limit" },
  { competitor: "Rosie", plan: "$49/mo", minutes: "250 min", perMin: "$0.20/min", at100Calls: "$49", at200Calls: "$99+", catch: "Booking requires $149/mo" },
  { competitor: "My AI Front Desk", plan: "$99/mo", minutes: "200 min", perMin: "$0.50/min", at100Calls: "$99", at200Calls: "$199+", catch: "Bilingual requires $149/mo" },
  { competitor: "Goodcall", plan: "$59/mo", minutes: "100 callers", perMin: "$0.50/caller over", at100Calls: "$59", at200Calls: "$109+", catch: "Per unique caller, not minutes" },
  { competitor: "Smith.ai", plan: "$95/mo", minutes: "50 calls", perMin: "$2.40/call over", at100Calls: "$215", at200Calls: "$455+", catch: "Human hybrid, very expensive" },
];

const comparisonRows = [
  { feature: "Pricing model", myai: "Per minute", goodcall: "Per caller", rosie: "Per minute", smithai: "Per call", unmissed: "Flat rate" },
  { feature: "Starting price", myai: "$99/mo (200 min)", goodcall: "$59/mo (100 callers)", rosie: "$49/mo (250 min)", smithai: "$95/mo (50 calls)", unmissed: "$147/mo (unlimited)" },
  { feature: "Setup", myai: "Self-serve", goodcall: "Self-serve", rosie: "Self-serve", smithai: "Assisted", unmissed: "Done for you (24hr)" },
  { feature: "All features included", myai: "No — tiered", goodcall: "No — tiered", rosie: "No — tiered", smithai: "No — tiered", unmissed: "Yes" },
  { feature: "Booking on all plans", myai: "No ($149+)", goodcall: "No ($99+)", rosie: "No ($149+)", smithai: "No ($270+)", unmissed: "Add-on available" },
  { feature: "Bilingual", myai: "No ($149+)", goodcall: "Limited", rosie: "Yes", smithai: "Yes", unmissed: "Yes" },
  { feature: "Learns from calls", myai: "No", goodcall: "No", rosie: "No", smithai: "No", unmissed: "Yes (Learning Loop)" },
  { feature: "Your data, your sheet", myai: "No", goodcall: "No", rosie: "No", smithai: "No", unmissed: "Google Sheets" },
  { feature: "Instant mobile alerts", myai: "Email", goodcall: "Email", rosie: "Email", smithai: "Email + SMS", unmissed: "Telegram + SMS" },
  { feature: "Contracts", myai: "Monthly", goodcall: "Monthly", rosie: "Monthly", smithai: "Monthly", unmissed: "None — cancel anytime" },
];

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSchema) }}
      />

      <Navbar />

      <main style={{ backgroundColor: "var(--color-bg)" }}>
        {/* Header */}
        <PricingHero />

        {/* Pricing Cards */}
        <section className="pb-16 px-4">
          <div className="max-w-5xl mx-auto">
            <ErrorBoundary>
              <PricingCards />
            </ErrorBoundary>
          </div>
        </section>

        {/* Guarantee bar */}
        <GuaranteeBar />

        {/* The Per-Minute Trap */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p
                className="text-xs font-mono uppercase tracking-widest mb-3"
                style={{ color: "#F59E0B" }}
              >
                The per-minute trap
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                $29/mo sounds cheap. Until the phone rings.
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Most AI receptionists advertise low prices — then bill you per minute,
                per call, or per unique caller. The busier your business gets,
                the more you pay. Here&apos;s what that actually looks like:
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl mb-6" style={{ border: "1px solid var(--color-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
                    <th className="text-left p-4 text-gray-400 font-medium">Competitor</th>
                    <th className="text-center p-4 text-gray-400 font-medium">Advertised</th>
                    <th className="text-center p-4 text-gray-400 font-medium">Included</th>
                    <th className="text-center p-4 text-gray-400 font-medium">At 200 calls/mo</th>
                    <th className="text-center p-4 text-gray-400 font-medium">The catch</th>
                  </tr>
                </thead>
                <tbody>
                  {perMinuteTrapRows.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        backgroundColor: i % 2 === 0 ? "var(--color-bg)" : "var(--color-surface)",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <td className="p-4 text-gray-300 font-medium">{row.competitor}</td>
                      <td className="p-4 text-center text-gray-400">{row.plan}</td>
                      <td className="p-4 text-center text-gray-500">{row.minutes}</td>
                      <td className="p-4 text-center text-red-400 font-semibold">{row.at200Calls}</td>
                      <td className="p-4 text-center text-gray-500 text-xs">{row.catch}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "#0d0d0d", borderBottom: "1px solid #1f1f1f" }}>
                    <td className="p-4 font-semibold" style={{ color: "var(--color-primary)" }}>unmissed.ai</td>
                    <td className="p-4 text-center font-semibold" style={{ color: "#22C55E" }}>$147/mo</td>
                    <td className="p-4 text-center font-semibold" style={{ color: "#22C55E" }}>All calls</td>
                    <td className="p-4 text-center font-semibold" style={{ color: "#22C55E" }}>$147</td>
                    <td className="p-4 text-center font-semibold" style={{ color: "#22C55E" }}>No catch</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              className="rounded-xl p-5 text-center"
              style={{ backgroundColor: "#0D1F0D", border: "1px solid #166534" }}
            >
              <p className="text-green-400 font-semibold text-sm">
                With unmissed.ai, you pay the same whether you get 10 calls or 1,000.
                The more your phone rings, the more value you get — not the more you owe.
              </p>
            </div>
          </div>
        </section>

        {/* Full competitor comparison */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <p
                className="text-xs font-mono uppercase tracking-widest mb-3"
                style={{ color: "var(--color-primary)" }}
              >
                Feature comparison
              </p>
              <h2 className="text-3xl font-bold text-white mb-3">
                How we stack up against every alternative.
              </h2>
              <p className="text-gray-500">
                Real features. Real pricing. No marketing spin.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--color-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
                    <th className="text-left p-3 text-gray-400 font-medium text-xs">Feature</th>
                    <th className="text-center p-3 text-gray-400 font-medium text-xs">My AI Front Desk</th>
                    <th className="text-center p-3 text-gray-400 font-medium text-xs">Goodcall</th>
                    <th className="text-center p-3 text-gray-400 font-medium text-xs">Rosie</th>
                    <th className="text-center p-3 text-gray-400 font-medium text-xs">Smith.ai</th>
                    <th
                      className="text-center p-3 font-semibold text-xs"
                      style={{ color: "var(--color-primary)", backgroundColor: "#0d0d0d" }}
                    >
                      unmissed.ai
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        backgroundColor: i % 2 === 0 ? "var(--color-bg)" : "var(--color-surface)",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <td className="p-3 text-gray-300 font-medium text-xs">{row.feature}</td>
                      <td className="p-3 text-center text-gray-500 text-xs">{row.myai}</td>
                      <td className="p-3 text-center text-gray-500 text-xs">{row.goodcall}</td>
                      <td className="p-3 text-center text-gray-500 text-xs">{row.rosie}</td>
                      <td className="p-3 text-center text-gray-500 text-xs">{row.smithai}</td>
                      <td
                        className="p-3 text-center font-semibold text-xs"
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
        <section className="py-20 px-4 text-center" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to stop missing calls?
            </h2>
            <Link
              href="/onboard"
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "var(--color-primary)" }}
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
