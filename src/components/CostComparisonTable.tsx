"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { BRAND_NAME } from "@/lib/brand";

const rows = [
  {
    feature: "Monthly cost",
    human: "$3,500+",
    answering: "$300–$500 + overage",
    unmissed: "$147–$397",
    best: "unmissed",
  },
  {
    feature: "Hours covered",
    human: "Business hours only",
    answering: "Limited",
    unmissed: "24/7/365",
    best: "unmissed",
  },
  {
    feature: "After-hours calls",
    human: "❌ No",
    answering: "Sometimes",
    unmissed: "✅ Always",
    best: "unmissed",
  },
  {
    feature: "Sick days / no-shows",
    human: "Yes — gaps happen",
    answering: "Rare",
    unmissed: "✅ Never",
    best: "unmissed",
  },
  {
    feature: "Lead card (structured data)",
    human: "Hit or miss",
    answering: "❌ No",
    unmissed: "✅ Every call",
    best: "unmissed",
  },
  {
    feature: "Instant Telegram/SMS alert",
    human: "❌ No",
    answering: "❌ No",
    unmissed: "✅ Yes",
    best: "unmissed",
  },
  {
    feature: "Learns from its own calls",
    human: "With training",
    answering: "❌ No",
    unmissed: "✅ Weekly (The Learning Loop)",
    best: "unmissed",
  },
  {
    feature: "Setup time",
    human: "2–4 weeks + HR",
    answering: "1–3 days",
    unmissed: "✅ 24 hours",
    best: "unmissed",
  },
];

export default function CostComparisonTable() {
  return (
    <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "var(--color-primary)" }}
          >
            Why not just hire someone?
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
            The honest comparison.
          </h2>
          <p className="text-lg" style={{ color: "var(--color-text-2)" }}>
            A part-time receptionist costs more and works less.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--color-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
                <th className="text-left p-4 font-medium w-1/4" style={{ color: "var(--color-text-2)" }}>Feature</th>
                <th className="text-center p-4 font-medium" style={{ color: "var(--color-text-2)" }}>Human Receptionist</th>
                <th className="text-center p-4 font-medium" style={{ color: "var(--color-text-2)" }}>Answering Service</th>
                <th
                  className="text-center p-4 font-semibold rounded-t-none"
                  style={{ color: "var(--color-primary)", backgroundColor: "var(--color-surface)" }}
                >
                  {BRAND_NAME} ⭐
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 300, damping: 24, delay: i * 0.05 }}
                  style={{
                    backgroundColor: i % 2 === 0 ? "var(--color-bg)" : "var(--color-bg)",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <td className="p-4 font-medium" style={{ color: "var(--color-text-2)" }}>{row.feature}</td>
                  <td className="p-4 text-center" style={{ color: "var(--color-text-2)" }}>{row.human}</td>
                  <td className="p-4 text-center" style={{ color: "var(--color-text-2)" }}>{row.answering}</td>
                  <motion.td
                    className="p-4 text-center font-semibold"
                    initial={{ backgroundColor: "rgba(34,197,94,0.04)" }}
                    whileInView={{ backgroundColor: ["rgba(34,197,94,0.04)", "rgba(34,197,94,0.14)", "rgba(34,197,94,0.04)"] }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 + 0.3, duration: 0.6, ease: "easeOut" }}
                    style={{ color: "#22C55E" }}
                  >
                    {row.unmissed}
                  </motion.td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/onboard"
            className="inline-block px-8 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Get My Agent Set Up →
          </Link>
          <p className="text-xs mt-2" style={{ color: "var(--color-text-3)" }}>
            No contracts · No hiring · No training
          </p>
        </div>
      </div>
    </section>
  );
}
