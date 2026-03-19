"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  SETUP,
  TRIAL,
  BASE_PLAN,
  BETA_PROMO,
  ALL_FEATURES,
  FUTURE_TIERS,
  POLICIES,
  CURRENCY,
} from "@/lib/pricing";

export default function PricingCards({ compact = false }: { compact?: boolean }) {
  const [showAnnual] = useState(false); // reserved for future annual toggle

  const effectivePrice = BETA_PROMO.enabled ? BETA_PROMO.monthly : BASE_PLAN.monthly;

  return (
    <div>
      {/* Cards */}
      <div className={`grid gap-5 ${compact ? "grid-cols-1 max-w-lg mx-auto" : "grid-cols-1 md:grid-cols-3"}`}>
        {/* Coming Soon — Growth (left, only on full page) */}
        {!compact && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="rounded-2xl p-6 relative flex flex-col opacity-60"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="mb-5">
              <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--color-text-3)" }}>
                {FUTURE_TIERS[0].name}
              </p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black" style={{ color: "var(--color-text-3)" }}>
                  ${FUTURE_TIERS[0].price}
                </span>
                <span className="text-sm" style={{ color: "var(--color-text-3)" }}>/mo {CURRENCY}</span>
              </div>
              <p className="text-sm mt-2" style={{ color: "var(--color-text-3)" }}>
                More minutes, priority support, and advanced features.
              </p>
            </div>
            <div className="flex-1 flex items-center justify-center py-8">
              <p className="text-sm font-medium" style={{ color: "var(--color-text-3)" }}>Coming Soon</p>
            </div>
            <div>
              <button
                disabled
                className="block w-full text-center py-3 rounded-xl font-semibold text-sm cursor-not-allowed"
                style={{ backgroundColor: "var(--color-border)", color: "var(--color-text-3)" }}
              >
                Notify Me
              </button>
            </div>
          </motion.div>
        )}

        {/* Main Card — Beta / Starter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 300, damping: 24, delay: compact ? 0 : 0.1 }}
          whileHover={{
            y: -4,
            boxShadow: "0 12px 40px rgba(59,130,246,0.25)",
          }}
          className="rounded-2xl p-6 relative flex flex-col"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-primary)",
            boxShadow: "0 0 40px rgba(79,70,229,0.12)",
          }}
        >
          {/* Badge */}
          {BETA_PROMO.enabled && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 500, damping: 25, delay: 0.2 }}
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <Sparkles size={12} />
              {BETA_PROMO.badge}
            </motion.div>
          )}

          <div className="mb-5">
            <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--color-text-2)" }}>
              {BASE_PLAN.name}
            </p>

            <div className="flex items-baseline gap-2 mb-2">
              {BETA_PROMO.enabled && (
                <span className="text-2xl font-bold line-through" style={{ color: "var(--color-text-3)" }}>
                  ${BASE_PLAN.monthly}
                </span>
              )}
              <AnimatePresence mode="wait">
                <motion.span
                  key={effectivePrice}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="text-4xl font-black"
                  style={{ color: "var(--color-text-1)" }}
                >
                  ${effectivePrice}
                </motion.span>
              </AnimatePresence>
              <span className="text-sm" style={{ color: "var(--color-text-3)" }}>/mo {CURRENCY}</span>
            </div>

            {BETA_PROMO.enabled && (
              <p className="text-xs mb-2" style={{ color: "var(--color-cta)" }}>
                {BETA_PROMO.description}
              </p>
            )}

            <p className="text-sm" style={{ color: "var(--color-text-3)" }}>
              {BASE_PLAN.description}
            </p>

            {/* Setup fee callout */}
            <div
              className="mt-3 px-3 py-2 rounded-lg text-xs"
              style={{ backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
            >
              <span style={{ color: "var(--color-primary)" }} className="font-semibold">{SETUP.label}</span>
              <span style={{ color: "var(--color-text-2)" }}> — {SETUP.includes}</span>
            </div>
          </div>

          {/* Features */}
          <div className="flex-1 space-y-2 mb-6">
            {ALL_FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-2">
                <Check size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm" style={{ color: "var(--color-text-2)" }}>{f}</span>
              </div>
            ))}
            <div className="flex items-start gap-2">
              <Check size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm" style={{ color: "var(--color-text-2)" }}>
                {BETA_PROMO.enabled ? BETA_PROMO.minutes : BASE_PLAN.minutes} minutes/month included
              </span>
            </div>
          </div>

          <div>
            <Link
              href="/onboard"
              className="block w-full text-center py-3 rounded-xl font-semibold text-sm transition-colors"
              style={{ backgroundColor: "var(--color-primary)", color: "white" }}
            >
              Start {TRIAL.days}-Day Free Trial →
            </Link>
            <p className="text-center text-xs mt-2" style={{ color: "var(--color-text-3)" }}>
              {TRIAL.label} · {POLICIES.contracts}
            </p>
          </div>
        </motion.div>

        {/* Coming Soon — Pro (right, only on full page) */}
        {!compact && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.2 }}
            className="rounded-2xl p-6 relative flex flex-col opacity-60"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="mb-5">
              <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--color-text-3)" }}>
                {FUTURE_TIERS[1].name}
              </p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black" style={{ color: "var(--color-text-3)" }}>
                  ${FUTURE_TIERS[1].price}
                </span>
                <span className="text-sm" style={{ color: "var(--color-text-3)" }}>/mo {CURRENCY}</span>
              </div>
              <p className="text-sm mt-2" style={{ color: "var(--color-text-3)" }}>
                Unlimited calls, custom integrations, and dedicated support.
              </p>
            </div>
            <div className="flex-1 flex items-center justify-center py-8">
              <p className="text-sm font-medium" style={{ color: "var(--color-text-3)" }}>Coming Soon</p>
            </div>
            <div>
              <button
                disabled
                className="block w-full text-center py-3 rounded-xl font-semibold text-sm cursor-not-allowed"
                style={{ backgroundColor: "var(--color-border)", color: "var(--color-text-3)" }}
              >
                Notify Me
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
