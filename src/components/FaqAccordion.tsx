"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SETUP, TRIAL, PLANS, MINUTE_RELOAD, POLICIES } from "@/lib/pricing";
import { BRAND_NAME } from "@/lib/brand";

const faqs = [
  {
    question: "Will customers know they're talking to AI?",
    answer:
      "Your agent sounds natural and professional — not robotic. We disclose it's an AI assistant when asked directly (required by law and good practice), but most callers are impressed, not put off. Your agent says 'I'm an AI assistant for [Your Business]' if asked. In practice, callers care more about getting their question answered than who's answering.",
  },
  {
    question: `What makes ${BRAND_NAME} worth it?`,
    answer:
      `Every plan includes generous minutes, niche-specific AI prompts, instant notifications, and our Learning Loop that improves your agent from real calls every week. There's no per-minute billing — you pay a flat rate starting at $${PLANS[0].monthly}/mo and know exactly what your bill will be. Need more minutes? Reload packs are just $${MINUTE_RELOAD.price} for ${MINUTE_RELOAD.minutes} minutes.`,
  },
  {
    question: "How are you different from Dialzara, Rosie, or My AI Front Desk?",
    answer:
      `Three ways. First, pricing: they all charge per minute or per caller — your bill spikes when you're busy. We charge a flat rate per plan starting at $${PLANS[0].monthly}/mo. Second, setup: they're self-serve platforms where you configure everything yourself. We build your agent for you with industry-specific scripts tested on real calls. Third, depth: each plan includes generous minutes and core AI features. Booking, live transfer, and advanced features are available on Core ($${PLANS[1].monthly}/mo) and Pro ($${PLANS[2].monthly}/mo) plans.`,
  },
  {
    question: "What does the $25 setup fee cover?",
    answer:
      `The ${SETUP.label} covers building your custom AI agent — we tune it to your specific business, niche, hours, and services. It includes ${SETUP.includes}. You don't configure anything yourself — we handle it all and have your agent live within 48 hours.`,
  },
  {
    question: "What if the agent says something wrong?",
    answer:
      "Your agent only answers questions using what we program into its knowledge base — your services, pricing, hours, policies. If a caller asks something outside that scope, it politely says it'll have you follow up directly. It never makes up information. And through The Learning Loop, any knowledge gaps are flagged weekly so you can add to it.",
  },
  {
    question: "Does it work after hours and on weekends?",
    answer:
      "That's the whole point. Your agent answers every call, 24/7/365 — including 2am emergencies, Christmas Day, and while you're elbow-deep in a job. You'll get an instant Telegram or SMS notification so you can decide whether to call back immediately or in the morning.",
  },
  {
    question: "How do I update what my agent knows?",
    answer:
      "We handle updates for you. Just message us what changed (new pricing, new service area, whatever) and we'll update your agent's knowledge base within 24 hours. No dashboard to log into. No prompts to write. That's the done-for-you difference.",
  },
  {
    question: "What if I want to cancel?",
    answer:
      `${POLICIES.cancellation} No contracts, no cancellation fees. Your call logs stay in your dashboard, so you keep your data either way. We're confident you won't want to cancel once you see the leads you were missing.`,
  },
];

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
          {faqs.map((faq, i) => (
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
