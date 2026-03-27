"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, Star } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PLANS, TRIAL, POLICIES, CURRENCY, FOUNDING_PROMO } from "@/lib/pricing";

export default function PricingCards({ compact = false }: { compact?: boolean }) {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div>
      {/* Annual/Monthly toggle */}
      {!compact && (
        <div className="flex items-center justify-center gap-2 mb-10">
          <button
            onClick={() => setIsAnnual(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={
              !isAnnual
                ? { backgroundColor: "var(--color-primary)", color: "white" }
                : { color: "var(--color-text-3)" }
            }
          >
            Monthly
          </button>
          <button
            onClick={() => setIsAnnual(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            style={
              isAnnual
                ? { backgroundColor: "var(--color-primary)", color: "white" }
                : { color: "var(--color-text-3)" }
            }
          >
            Annual
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded"
              style={
                isAnnual
                  ? { backgroundColor: "rgba(255,255,255,0.2)", color: "white" }
                  : { backgroundColor: "rgba(16,185,129,0.15)", color: "#10B981" }
              }
            >
              Save 20%
            </span>
          </button>
        </div>
      )}

      {/* Cards */}
      <div
        className={`grid gap-5 ${
          compact ? "grid-cols-1 max-w-lg mx-auto" : "grid-cols-1 md:grid-cols-3"
        }`}
      >
        {PLANS.map((plan, index) => {
          const displayPrice = !isAnnual && FOUNDING_PROMO.enabled && plan.foundingMonthly
          ? plan.foundingMonthly
          : isAnnual ? plan.annual : plan.monthly;
        const price = displayPrice;
        const isFoundingRate = !isAnnual && FOUNDING_PROMO.enabled && !!plan.foundingMonthly;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 24,
                delay: compact ? 0 : index * 0.08,
              }}
              whileHover={
                plan.isPopular
                  ? { y: -6, boxShadow: "0 20px 48px rgba(99,102,241,0.28)" }
                  : { y: -3 }
              }
              className={`rounded-2xl p-6 relative flex flex-col ${
                !plan.isPopular && !compact ? "md:mt-5" : ""
              }`}
              style={{
                backgroundColor: "var(--color-surface)",
                border: plan.isPopular
                  ? "2px solid var(--color-primary)"
                  : "1px solid var(--color-border)",
                boxShadow: plan.isPopular
                  ? "0 0 40px rgba(79,70,229,0.12)"
                  : undefined,
              }}
            >
              {/* Founding rate badge */}
              {isFoundingRate && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold text-white whitespace-nowrap" style={{ backgroundColor: "#059669" }}>
                  Founding Rate — locks in forever
                </div>
              )}

              {/* Popular badge */}
              {plan.isPopular && !isFoundingRate && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 500, damping: 25, delay: 0.2 }}
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  <Star size={11} fill="currentColor" />
                  Most Popular
                </motion.div>
              )}

              {/* Plan name + tagline */}
              <div className="mb-5">
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: "var(--color-text-2)" }}
                >
                  {plan.name}
                </p>
                <p
                  className="text-sm mb-4"
                  style={{ color: "var(--color-text-3)" }}
                >
                  {plan.tagline}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-2 mb-1">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={price}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="text-4xl font-black"
                      style={{ color: "var(--color-text-1)" }}
                    >
                      ${price}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-sm" style={{ color: "var(--color-text-3)" }}>
                    /mo {CURRENCY}
                  </span>
                  {isFoundingRate && (
                    <span className="text-sm line-through" style={{ color: "var(--color-text-3)" }}>
                      ${plan.monthly}
                    </span>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  <motion.p
                    key={isAnnual ? "annual" : "monthly"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs"
                    style={{ color: "var(--color-text-3)" }}
                  >
                    {isAnnual
                      ? `billed $${plan.annualBilledTotal}/yr`
                      : "billed monthly"}
                  </motion.p>
                </AnimatePresence>

                <p className="text-sm mt-3" style={{ color: "var(--color-text-2)" }}>
                  {plan.description}
                </p>
              </div>

              {/* Features */}
              <div className="flex-1 space-y-2 mb-6">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <Check
                      size={14}
                      className="text-emerald-500 flex-shrink-0 mt-0.5"
                    />
                    <span
                      className="text-sm"
                      style={{ color: "var(--color-text-2)" }}
                    >
                      {f}
                    </span>
                  </div>
                ))}
                {plan.notIncluded.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <X
                      size={14}
                      className="flex-shrink-0 mt-0.5"
                      style={{ color: "var(--color-text-3)" }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: "var(--color-text-3)" }}
                    >
                      {f}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div>
                <Link
                  href={plan.href}
                  className="block w-full text-center py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90"
                  style={
                    plan.isPopular
                      ? { backgroundColor: "var(--color-primary)", color: "white" }
                      : {
                          backgroundColor: "var(--color-border)",
                          color: "var(--color-text-1)",
                        }
                  }
                >
                  {plan.cta} →
                </Link>
                <p
                  className="text-center text-xs mt-2"
                  style={{ color: "var(--color-text-3)" }}
                >
                  {TRIAL.label} · {POLICIES.contracts}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
