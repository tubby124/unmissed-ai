"use client";

import { useState } from "react";

const faqs = [
  {
    question: "Will customers know they're talking to AI?",
    answer:
      "Your agent sounds natural and professional — not robotic. We disclose it's an AI assistant when asked directly (required by law and good practice), but most callers are impressed, not put off. Your agent says 'I'm an AI assistant for [Your Business]' if asked. In practice, callers care more about getting their question answered than who's answering.",
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
    <section className="py-20 px-4" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "#3B82F6" }}
          >
            FAQ
          </p>
          <h2 className="text-3xl font-bold text-white">Common questions.</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid #1F1F1F" }}
            >
              <button
                className="w-full flex items-center justify-between p-5 text-left transition-colors"
                style={{
                  backgroundColor: openIndex === i ? "#111111" : "#0D0D0D",
                }}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className="text-white font-medium pr-4">{faq.question}</span>
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm transition-transform"
                  style={{
                    backgroundColor: openIndex === i ? "#3B82F6" : "#1F1F1F",
                    transform: openIndex === i ? "rotate(45deg)" : "rotate(0deg)",
                  }}
                >
                  +
                </span>
              </button>

              {openIndex === i && (
                <div
                  className="px-5 pb-5"
                  style={{ backgroundColor: "#111111" }}
                >
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
