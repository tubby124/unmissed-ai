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
  PUBLIC_PLANS,
  TRIAL,
  POLICIES,
  getPlanDisplayMonthly,
} from "@/lib/pricing";
import { BRAND_NAME, BRAND_DOMAIN } from "@/lib/brand";
import { BOOK_WALKTHROUGH_HREF } from "@/lib/booking";

export const metadata: Metadata = {
  title: `Pricing — ${BRAND_NAME} AI Receptionist`,
  description: `Simple flat-rate pricing, no contracts. AI receptionist from $${getPlanDisplayMonthly(PUBLIC_PLANS[0])}/mo CAD founding rate. ${TRIAL.label}. Cancel anytime.`,
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/pricing`,
  },
  openGraph: {
    title: `Pricing — ${BRAND_NAME}`,
    description: `AI receptionist from $${getPlanDisplayMonthly(PUBLIC_PLANS[0])}/mo CAD founding rate. ${TRIAL.label}. No contracts, no surprise overages.`,
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
                "You want to know who's worth calling back before you dial",
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
              Get Your AI Number
            </Link>
            <p className="mt-3">
              <a
                href={BOOK_WALKTHROUGH_HREF}
                className="text-xs underline underline-offset-2 transition-colors"
                style={{ color: "var(--color-text-3)" }}
              >
                Prefer a walkthrough? Book one
              </a>
            </p>
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
              Get Your AI Number →
            </Link>
            <p className="mt-3">
              <a
                href={BOOK_WALKTHROUGH_HREF}
                className="text-xs underline underline-offset-2 transition-colors"
                style={{ color: "var(--color-text-3)" }}
              >
                Prefer a walkthrough? Book one
              </a>
            </p>
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
