import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PricingCards from "@/components/PricingCards";
import CostComparisonTable from "@/components/CostComparisonTable";
import RoiCalculator from "@/components/RoiCalculator";
import FaqAccordion from "@/components/FaqAccordion";
import ErrorBoundary from "@/components/ErrorBoundary";
import { pricingSchema } from "@/lib/schema";
import Link from "next/link";
import PricingHero, { GuaranteeBar } from "@/components/PricingHero";
import {
  PLANS,
  TRIAL,
  COMPETITORS,
  FEATURE_COMPARISON,
  POLICIES,
} from "@/lib/pricing";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Pricing — ${BRAND_NAME} AI Receptionist`,
  description: `Simple flat-rate pricing, no contracts. AI receptionist from $${PLANS[0].monthly}/mo CAD. ${TRIAL.label}. Cancel anytime.`,
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/pricing`,
  },
  openGraph: {
    title: `Pricing — ${BRAND_NAME}`,
    description: `AI receptionist from $${PLANS[0].monthly}/mo CAD. ${TRIAL.label}. No contracts, no per-minute charges.`,
  },
};

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
              <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
                $29/mo sounds cheap. Until the phone rings.
              </h2>
              <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--color-text-2)" }}>
                Most AI receptionists advertise low prices — then bill you per minute,
                per call, or per unique caller. The busier your business gets,
                the more you pay. Here&apos;s what that actually looks like:
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl mb-6" style={{ border: "1px solid var(--color-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
                    <th className="text-left p-4 font-medium" style={{ color: "var(--color-text-2)" }}>Competitor</th>
                    <th className="text-center p-4 font-medium" style={{ color: "var(--color-text-2)" }}>Advertised</th>
                    <th className="text-center p-4 font-medium" style={{ color: "var(--color-text-2)" }}>Included</th>
                    <th className="text-center p-4 font-medium" style={{ color: "var(--color-text-2)" }}>At 200 calls/mo</th>
                    <th className="text-center p-4 font-medium" style={{ color: "var(--color-text-2)" }}>The catch</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPETITORS.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        backgroundColor: i % 2 === 0 ? "var(--color-bg)" : "var(--color-surface)",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <td className="p-4 font-medium" style={{ color: "var(--color-text-1)" }}>{row.name}</td>
                      <td className="p-4 text-center" style={{ color: "var(--color-text-2)" }}>{row.plan}</td>
                      <td className="p-4 text-center" style={{ color: "var(--color-text-2)" }}>{row.minutes}</td>
                      <td className="p-4 text-center font-semibold text-red-500">{row.at200Calls}</td>
                      <td className="p-4 text-center text-xs" style={{ color: "var(--color-text-2)" }}>{row.catch}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "var(--color-accent,#EEF2FF)", borderBottom: "1px solid var(--color-border)" }}>
                    <td className="p-4 font-semibold" style={{ color: "var(--color-primary)" }}>{BRAND_NAME}</td>
                    <td className="p-4 text-center font-semibold" style={{ color: "#22C55E" }}>from ${PLANS[0].monthly}/mo</td>
                    <td className="p-4 text-center font-semibold" style={{ color: "#22C55E" }}>Flat rate</td>
                    <td className="p-4 text-center font-semibold" style={{ color: "#22C55E" }}>Same price</td>
                    <td className="p-4 text-center font-semibold" style={{ color: "#22C55E" }}>No catch</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              className="rounded-xl p-5 text-center"
              style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)" }}
            >
              <p className="font-semibold text-sm" style={{ color: "var(--color-cta,#059669)" }}>
                {BRAND_NAME} is flat-rate. Your bill stays the same no matter how many calls come in.
                Every competitor charges more the busier you get — sometimes 5x more.
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
              <h2 className="text-3xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
                How we stack up against every alternative.
              </h2>
              <p style={{ color: "var(--color-text-2)" }}>
                Real features. Real pricing. No marketing spin.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--color-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
                    <th className="text-left p-3 font-medium text-xs" style={{ color: "var(--color-text-2)" }}>Feature</th>
                    <th className="text-center p-3 font-medium text-xs" style={{ color: "var(--color-text-2)" }}>My AI Front Desk</th>
                    <th className="text-center p-3 font-medium text-xs" style={{ color: "var(--color-text-2)" }}>Goodcall</th>
                    <th className="text-center p-3 font-medium text-xs" style={{ color: "var(--color-text-2)" }}>Rosie</th>
                    <th className="text-center p-3 font-medium text-xs" style={{ color: "var(--color-text-2)" }}>Smith.ai</th>
                    <th className="text-center p-3 font-medium text-xs" style={{ color: "var(--color-text-2)" }}>Ask Benny</th>
                    <th
                      className="text-center p-3 font-semibold text-xs"
                      style={{ color: "var(--color-primary)", backgroundColor: "var(--color-accent,#EEF2FF)" }}
                    >
                      {BRAND_NAME}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_COMPARISON.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        backgroundColor: i % 2 === 0 ? "var(--color-bg)" : "var(--color-surface)",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <td className="p-3 font-medium text-xs" style={{ color: "var(--color-text-1)" }}>{row.feature}</td>
                      <td className="p-3 text-center text-xs" style={{ color: "var(--color-text-2)" }}>{row.myai}</td>
                      <td className="p-3 text-center text-xs" style={{ color: "var(--color-text-2)" }}>{row.goodcall}</td>
                      <td className="p-3 text-center text-xs" style={{ color: "var(--color-text-2)" }}>{row.rosie}</td>
                      <td className="p-3 text-center text-xs" style={{ color: "var(--color-text-2)" }}>{row.smithai}</td>
                      <td className="p-3 text-center text-xs" style={{ color: "var(--color-text-2)" }}>{row.askbenny}</td>
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

        {/* ROI Calculator */}
        <ErrorBoundary>
          <RoiCalculator />
        </ErrorBoundary>

        {/* FAQ */}
        <ErrorBoundary>
          <FaqAccordion />
        </ErrorBoundary>

        {/* Is {BRAND_NAME} right for you? */}
        <section className="py-16 px-4" style={{ backgroundColor: "var(--color-surface)" }}>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--color-text-1)" }}>
              Is {BRAND_NAME} right for you?
            </h2>
            <p className="mb-8" style={{ color: "var(--color-text-2)" }}>
              Great fit if you answer yes to any of these:
            </p>
            <ul className="text-left space-y-3 mb-8">
              {[
                "You're often on a job site and can't answer the phone",
                "You've lost a customer because they called a competitor when you didn't pick up",
                "You rely on voicemail but most callers don't leave a message",
                "You want to know which leads are hot before you call back",
                "You run a service business with 1–20 employees",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 flex-shrink-0 mt-0.5"
                    style={{ color: "var(--color-primary)" }}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span style={{ color: "var(--color-text-1)" }}>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/onboard"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-white font-semibold transition-colors"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Start {TRIAL.days}-Day Free Trial
            </Link>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-4 text-center" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--color-text-1)" }}>
              Ready to stop missing calls?
            </h2>
            <Link
              href="/onboard"
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Start Free Trial →
            </Link>
            <p className="text-xs mt-3" style={{ color: "var(--color-text-3)" }}>
              {POLICIES.setupTime} · {POLICIES.contracts}
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
