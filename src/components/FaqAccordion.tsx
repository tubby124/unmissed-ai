"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const faqs = [
  {
    question: "Will customers know they're talking to AI?",
    answer:
      "Your agent sounds natural and professional — not robotic. We disclose it's an AI assistant when asked directly (required by law and good practice), but most callers are impressed, not put off. Your agent says 'I'm an AI assistant for [Your Business]' if asked. In practice, callers care more about getting their question answered than who's answering.",
  },
  {
    question: "Why don't you charge per minute like other AI receptionists?",
    answer:
      "Because per-minute billing punishes success. Dialzara's $29/mo plan gives you 60 minutes — that's about 2 minutes per day. My AI Front Desk caps you at 200 minutes for $99/mo. Smith.ai charges $2.40 per call after 50 calls. The busier your business gets, the more you pay. We think that's backwards. With unmissed.ai, you pay one flat rate whether you get 10 calls or 500. Your success should make you money, not cost you more.",
  },
  {
    question: "Why is unmissed.ai more expensive than $29/mo competitors?",
    answer:
      "It's not — once you do the math. Those $29-49/mo plans include 60-250 minutes. A busy service business handles 100-300+ calls per month. At 200 calls, Dialzara costs $290+, Rosie costs $99+, and Smith.ai costs $455+. We're $147 flat — no matter how many calls you get. Plus, we set up your entire agent for you. With competitors, you're configuring it yourself. Our price includes the service, not just the software.",
  },
  {
    question: "How are you different from Goodcall, My AI Front Desk, or Rosie?",
    answer:
      "Three ways. First, pricing: they all charge per minute or per caller. We charge flat. Second, setup: they're self-serve platforms where you configure everything yourself. We build your agent for you with industry-specific scripts tested on real calls. Third, features: they gate booking, bilingual support, and integrations behind higher tiers. We include everything on every plan.",
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
      "No contracts, no cancellation fees. Cancel anytime with 30 days notice — just message us. Your call logs stay in your own Google Sheet, so you keep your data either way. We're confident you won't want to cancel once you see the leads you were missing.",
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
