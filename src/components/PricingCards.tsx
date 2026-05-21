"use client";

import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PUBLIC_PLANS, TRIAL, POLICIES, CURRENCY, FOUNDING_PROMO, getPlanDisplayMonthly } from "@/lib/pricing";

export default function PricingCards({ compact = false }: { compact?: boolean }) {
  const isAnnual = false;
  const shouldReduceMotion = useReducedMotion();

  return (
    <div>
      {!compact && (
        <div
          className="flex items-center justify-center px-4 py-2 rounded-xl mb-10 w-fit mx-auto text-sm font-medium"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          Monthly billing. Annual plans coming later.
        </div>
      )}

      {/* Cards */}
      <div
        className="grid gap-5 grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto"
      >
        {PUBLIC_PLANS.map((plan, index) => {
          const isFoundingRate =
            !isAnnual && FOUNDING_PROMO.enabled && !!plan.foundingMonthly;
          const displayPrice = isFoundingRate
            ? getPlanDisplayMonthly(plan)
            : isAnnual
            ? plan.annual
            : plan.monthly;

          return (
            <motion.div
              key={plan.id}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : {
                      type: "spring",
                      stiffness: 300,
                      damping: 24,
                      delay: compact ? 0 : index * 0.08,
                    }
              }
              whileHover={
                shouldReduceMotion
                  ? {}
                  : plan.isPopular
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
                <div
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold text-white whitespace-nowrap"
                  style={{ backgroundColor: "#059669" }}
                >
                  Founding Rate — locks in forever
                </div>
              )}

              {/* Most Popular badge */}
              {plan.isPopular && !isFoundingRate && (
                <motion.div
                  initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 500, damping: 25, delay: 0.2 }
                  }
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold text-white whitespace-nowrap"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  Most Popular
                </motion.div>
              )}

              {/* Plan badge + tagline */}
              <div className="mb-5">
                <Badge variant="secondary" className="mb-2 text-xs font-semibold">
                  {plan.name}
                </Badge>
                <p className="text-sm mb-4" style={{ color: "var(--color-text-3)" }}>
                  {plan.tagline}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-2 mb-1">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={displayPrice}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="text-4xl font-black"
                      style={{ color: "var(--color-text-1)" }}
                    >
                      ${displayPrice}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-sm" style={{ color: "var(--color-text-3)" }}>
                    /mo {CURRENCY}
                  </span>
                  {isFoundingRate && !plan.hidden && (
                    <span
                      className="text-sm line-through"
                      style={{ color: "var(--color-text-3)" }}
                    >
                      ${plan.monthly}
                    </span>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  <motion.p
                    key={isAnnual ? "annual" : "monthly"}
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={shouldReduceMotion ? {} : { opacity: 0 }}
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

              {/* Features (positives only) */}
              <div className="flex-1 space-y-2 mb-6">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <CircleCheck
                      size={14}
                      className="text-emerald-500 flex-shrink-0 mt-0.5"
                    />
                    <span className="text-sm" style={{ color: "var(--color-text-2)" }}>
                      {f}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div>
                <Button
                  asChild
                  className="w-full font-semibold text-sm"
                  style={
                    plan.isPopular
                      ? {
                          backgroundColor: "var(--color-primary)",
                          color: "white",
                          borderColor: "transparent",
                        }
                      : {
                          backgroundColor: "var(--color-border)",
                          color: "var(--color-text-1)",
                          borderColor: "transparent",
                        }
                  }
                >
                  <Link href={plan.href}>{plan.cta} →</Link>
                </Button>
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
