"use client";

import { useState } from "react";
import Link from "next/link";

const plans = [
  {
    name: "Starter",
    monthly: 147,
    annual: 122,
    description: "Perfect for solo tradespeople or small shops just getting started.",
    cta: "Start Free Trial",
    ctaHref: "/onboard",
    highlighted: false,
    features: [
      "AI agent answers every call",
      "Structured lead card per call",
      "Instant Telegram notification",
      "Google Sheets call log",
      "Up to 100 calls/month",
      "48-hour setup",
      "Email support",
    ],
    notIncluded: ["SMS follow-up to caller", "Daily summary digest", "Weekly analytics"],
  },
  {
    name: "Pro",
    monthly: 247,
    annual: 206,
    description: "Best for growing service businesses ready to capture every lead.",
    cta: "Get Started",
    ctaHref: "/onboard",
    highlighted: true,
    badge: "Most Popular",
    features: [
      "Everything in Starter",
      "SMS follow-up to caller",
      "Daily summary digest",
      "Weekly analytics report",
      "Up to 300 calls/month",
      "The Learning Loop (weekly AI review)",
      "Priority support",
    ],
    notIncluded: ["Custom agent persona", "Unlimited calls"],
  },
  {
    name: "Business",
    monthly: 397,
    annual: 331,
    description: "For high-volume operations that need maximum coverage and customization.",
    cta: "Book a Call",
    ctaHref: "/onboard",
    highlighted: false,
    features: [
      "Everything in Pro",
      "Custom agent persona & voice",
      "Unlimited calls",
      "Priority 24-hour setup",
      "Multiple forwarding numbers",
      "Dedicated account manager",
      "White-glove onboarding",
    ],
    notIncluded: [],
  },
];

export default function PricingCards({ compact = false }: { compact?: boolean }) {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      {/* Annual toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className={`text-sm ${!annual ? "text-white" : "text-gray-500"}`}>Monthly</span>
        <button
          onClick={() => setAnnual(!annual)}
          className="relative w-12 h-6 rounded-full transition-colors"
          style={{ backgroundColor: annual ? "#3B82F6" : "#374151" }}
        >
          <span
            className="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
            style={{ left: annual ? "28px" : "4px" }}
          />
        </button>
        <span className={`text-sm ${annual ? "text-white" : "text-gray-500"}`}>
          Annual{" "}
          <span
            className="px-1.5 py-0.5 rounded text-xs font-semibold"
            style={{ backgroundColor: "#166534", color: "#4ADE80" }}
          >
            Save 2 months
          </span>
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className="rounded-2xl p-6 relative flex flex-col"
            style={{
              backgroundColor: plan.highlighted ? "#0D1A2E" : "#111111",
              border: `1px solid ${plan.highlighted ? "#3B82F6" : "#1F1F1F"}`,
              boxShadow: plan.highlighted ? "0 0 40px rgba(59,130,246,0.15)" : "none",
            }}
          >
            {plan.badge && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: "#3B82F6" }}
              >
                {plan.badge}
              </div>
            )}

            <div className="mb-5">
              <p className="text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">
                {plan.name}
              </p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black text-white">
                  ${annual ? plan.annual : plan.monthly}
                </span>
                <span className="text-gray-500 text-sm">/mo</span>
              </div>
              {annual && (
                <p className="text-green-400 text-xs">
                  Billed annually (${(plan.annual * 12).toLocaleString()}/yr)
                </p>
              )}
              <p className="text-gray-500 text-sm mt-2">{plan.description}</p>
            </div>

            <div className="flex-1 space-y-2 mb-6">
              {plan.features.map((f) => (
                <div key={f} className="flex items-start gap-2">
                  <span className="text-green-400 text-sm flex-shrink-0 mt-0.5">✓</span>
                  <span className="text-gray-300 text-sm">{f}</span>
                </div>
              ))}
              {!compact && plan.notIncluded.map((f) => (
                <div key={f} className="flex items-start gap-2 opacity-40">
                  <span className="text-gray-600 text-sm flex-shrink-0 mt-0.5">✗</span>
                  <span className="text-gray-500 text-sm">{f}</span>
                </div>
              ))}
            </div>

            <div>
              <Link
                href={plan.ctaHref}
                className="block w-full text-center py-3 rounded-xl font-semibold text-sm transition-colors"
                style={
                  plan.highlighted
                    ? { backgroundColor: "#3B82F6", color: "white" }
                    : { backgroundColor: "#1F1F1F", color: "#D1D5DB" }
                }
              >
                {plan.cta} →
              </Link>
              <p className="text-center text-gray-600 text-xs mt-2">
                No contracts · Cancel anytime
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
