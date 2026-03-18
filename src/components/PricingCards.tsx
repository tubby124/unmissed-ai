"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
      "Dashboard call log",
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
    cta: "Start Free Trial",
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
        <span
          className="text-sm"
          style={{ color: !annual ? "var(--color-text-1)" : "var(--color-text-3)" }}
        >Monthly</span>
        <button
          onClick={() => setAnnual(!annual)}
          className="relative w-12 h-6 rounded-full transition-colors"
          style={{ backgroundColor: annual ? "var(--color-primary)" : "var(--color-border)" }}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="absolute top-1 w-4 h-4 bg-white rounded-full"
            style={{ left: annual ? "28px" : "4px" }}
          />
        </button>
        <span
          className="text-sm"
          style={{ color: annual ? "var(--color-text-1)" : "var(--color-text-3)" }}
        >
          Annual{" "}
          <span
            className="px-1.5 py-0.5 rounded text-xs font-semibold"
            style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "var(--color-cta)" }}
          >
            Save 2 months
          </span>
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 300, damping: 24, delay: i * 0.1 }}
            whileHover={{
              y: -4,
              boxShadow: plan.highlighted
                ? "0 12px 40px rgba(59,130,246,0.25)"
                : "0 12px 40px rgba(0,0,0,0.2)",
            }}
            className="rounded-2xl p-6 relative flex flex-col"
            style={{
              backgroundColor: plan.highlighted ? "var(--color-surface)" : "var(--color-surface)",
              border: `1px solid ${plan.highlighted ? "var(--color-primary)" : "var(--color-border)"}`,
              boxShadow: plan.highlighted ? "0 0 40px rgba(79,70,229,0.12)" : "none",
            }}
          >
            {plan.badge && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 500, damping: 25, delay: i * 0.1 + 0.1 }}
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                {plan.badge}
              </motion.div>
            )}

            <div className="mb-5">
              <p
                className="text-xs font-mono uppercase tracking-wider mb-1"
                style={{ color: "var(--color-text-2)" }}
              >
                {plan.name}
              </p>
              <div className="flex items-baseline gap-1 mb-2">
                <span
                  className="text-4xl font-black"
                  style={{ color: "var(--color-text-1)" }}
                >
                  $
                </span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={annual ? `annual-${plan.name}` : `monthly-${plan.name}`}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="text-4xl font-black"
                    style={{ color: "var(--color-text-1)" }}
                  >
                    {annual ? plan.annual : plan.monthly}
                  </motion.span>
                </AnimatePresence>
                <span className="text-sm" style={{ color: "var(--color-text-3)" }}>/mo CAD</span>
              </div>
              {annual && (
                <p className="text-green-400 text-xs">
                  Billed annually (${(plan.annual * 12).toLocaleString()}/yr)
                </p>
              )}
              <p className="text-sm mt-2" style={{ color: "var(--color-text-3)" }}>{plan.description}</p>
            </div>

            <div className="flex-1 space-y-2 mb-6">
              {plan.features.map((f) => (
                <div key={f} className="flex items-start gap-2">
                  <Check size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm" style={{ color: "var(--color-text-2)" }}>{f}</span>
                </div>
              ))}
              {!compact && plan.notIncluded.map((f) => (
                <div key={f} className="flex items-start gap-2 opacity-40">
                  <X size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-text-3)" }} />
                  <span className="text-sm" style={{ color: "var(--color-text-3)" }}>{f}</span>
                </div>
              ))}
            </div>

            <div>
              <Link
                href={plan.ctaHref}
                className="block w-full text-center py-3 rounded-xl font-semibold text-sm transition-colors"
                style={
                  plan.highlighted
                    ? { backgroundColor: "var(--color-primary)", color: "white" }
                    : { backgroundColor: "var(--color-border)", color: "var(--color-text-2)" }
                }
              >
                {plan.cta} →
              </Link>
              <p className="text-center text-xs mt-2" style={{ color: "var(--color-text-3)" }}>
                {plan.name === "Business" ? "No contracts · Cancel anytime" : "7-day free trial · No contracts · Cancel anytime"}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
