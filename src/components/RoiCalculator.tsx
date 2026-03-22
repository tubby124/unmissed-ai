"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { BRAND_NAME } from "@/lib/brand";

function formatCurrency(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

export default function RoiCalculator() {
  const [callsPerWeek, setCallsPerWeek] = useState(30);
  const [jobValue, setJobValue] = useState(400);
  const [missRate, setMissRate] = useState(62);

  const missedPerWeek = Math.round(callsPerWeek * (missRate / 100));
  const lostPerWeek = missedPerWeek * jobValue;
  const lostPerMonth = lostPerWeek * 4.33;
  const agentCost = 247;
  const roi = Math.round((lostPerMonth - agentCost) / agentCost * 100);

  return (
    <section
      id="roi"
      className="py-20 px-4"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "var(--color-primary)" }}
          >
            ROI Calculator
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
            Find out what missed calls are costing you.
          </h2>
          <p style={{ color: "var(--color-text-2)" }}>
            Move the sliders to see your real number.
          </p>
        </div>

        <motion.div
          className="rounded-2xl p-6 md:p-8"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
        >
          {/* Slider: calls per week */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium" style={{ color: "var(--color-text-2)" }}>
                Calls per week
              </label>
              <span className="font-bold text-lg" style={{ color: "var(--color-text-1)" }}>{callsPerWeek}</span>
            </div>
            <input
              type="range"
              min={1}
              max={200}
              value={callsPerWeek}
              onChange={(e) => setCallsPerWeek(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: "var(--color-text-3)" }}>
              <span>1</span>
              <span>200</span>
            </div>
          </div>

          {/* Slider: job value */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium" style={{ color: "var(--color-text-2)" }}>
                Average job value
              </label>
              <span className="font-bold text-lg" style={{ color: "var(--color-text-1)" }}>
                ${jobValue.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={5000}
              step={50}
              value={jobValue}
              onChange={(e) => setJobValue(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: "var(--color-text-3)" }}>
              <span>$50</span>
              <span>$5,000</span>
            </div>
          </div>

          {/* Slider: miss rate */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium" style={{ color: "var(--color-text-2)" }}>
                Current miss rate
              </label>
              <span className="font-bold text-lg" style={{ color: "var(--color-text-1)" }}>{missRate}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={missRate}
              onChange={(e) => setMissRate(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: "var(--color-text-3)" }}>
              <span>10%</span>
              <span>100% (all calls missed)</span>
            </div>
          </div>

          {/* Results */}
          <div
            className="rounded-xl p-5 mb-6"
            style={{ backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)" }}
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--color-text-2)" }}>Calls missed/week</p>
                <p className="text-2xl font-bold" style={{ color: "var(--color-text-1)" }}>
                  <motion.span
                    key={missedPerWeek}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    {missedPerWeek}
                  </motion.span>
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--color-text-2)" }}>Lost revenue/week</p>
                <p className="text-2xl font-bold" style={{ color: "#EF4444" }}>
                  <motion.span
                    key={lostPerWeek}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    {formatCurrency(lostPerWeek)}
                  </motion.span>
                </p>
              </div>
            </div>
            <div
              className="rounded-lg p-4 text-center"
              style={{ backgroundColor: "var(--color-surface)" }}
            >
              <p className="text-sm mb-1" style={{ color: "var(--color-text-2)" }}>
                You&apos;re losing approximately
              </p>
              <p
                className="text-4xl font-black mb-1"
                style={{ color: "#EF4444" }}
              >
                <motion.span
                  key={Math.round(lostPerMonth)}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  {formatCurrency(lostPerMonth)}
                </motion.span>
                /month
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-2)" }}>to missed calls</p>
            </div>
            <div
              className="mt-3 rounded-lg p-3 flex items-center justify-between"
              style={{ backgroundColor: "#0D1F0D" }}
            >
              <div>
                <p className="text-green-400 text-sm font-semibold">
                  {BRAND_NAME} Pro Plan
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-2)" }}>${agentCost}/month</p>
              </div>
              <div className="text-right">
                <p className="text-green-400 font-bold text-lg">
                  <motion.span
                    key={roi}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    {roi > 999 ? "1000%+" : `${roi}%`} ROI
                  </motion.span>
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-2)" }}>payback in week 1</p>
              </div>
            </div>
          </div>

          <motion.div whileHover={{ scale: 1.02 }}>
            <Link
              href="/onboard"
              className="block w-full text-center py-3.5 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Stop the bleeding — Get My Agent Set Up →
            </Link>
          </motion.div>
          <p className="text-center text-xs mt-2" style={{ color: "var(--color-text-3)" }}>
            No contracts · Cancel anytime · Agent live within 24 hours
          </p>
        </motion.div>

        {/* noscript fallback */}
        <noscript>
          <div
            className="mt-4 rounded-xl p-5 text-center"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-sm" style={{ color: "var(--color-text-2)" }}>
              Example: 30 calls/week × 62% miss rate × $400/job ={" "}
              <strong className="text-red-400">$32,136/month lost</strong>.
              Your agent costs $247/month. ROI: week 1.
            </p>
          </div>
        </noscript>
      </div>
    </section>
  );
}
