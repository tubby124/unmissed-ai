"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FAQ_ITEMS } from "@/lib/marketing-content";

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "var(--color-primary)" }}
          >
            FAQ
          </p>
          <h2 className="text-3xl font-bold" style={{ color: "var(--color-text-1)" }}>Common questions.</h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 300, damping: 24, delay: i * 0.05 }}
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--color-border)" }}
            >
              <button
                className="w-full flex items-center justify-between p-5 text-left transition-colors"
                style={{
                  backgroundColor: openIndex === i ? "var(--color-surface)" : "var(--color-bg)",
                }}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className="font-medium pr-4" style={{ color: "var(--color-text-1)" }}>{faq.question}</span>
                <motion.span
                  animate={{ rotate: openIndex === i ? 45 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    width: "1.5rem",
                    height: "1.5rem",
                    borderRadius: "9999px",
                    color: "white",
                    fontSize: "0.875rem",
                    backgroundColor: openIndex === i ? "var(--color-primary)" : "var(--color-border)",
                  }}
                >
                  +
                </motion.span>
              </button>

              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      className="px-5 pb-5"
                      style={{ backgroundColor: "var(--color-surface)" }}
                    >
                      <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-2)" }}>
                        {faq.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
