'use client'

import { motion } from 'motion/react'
import { PhoneIncoming, Bot, BellRing, CircleCheck, type LucideIcon } from 'lucide-react'

const steps: { number: string; icon: LucideIcon; title: string; description: string }[] = [
  {
    number: "01",
    icon: PhoneIncoming,
    title: "Customer calls your number",
    description:
      "Your existing business number (or a new one) forwards to your AI agent. Zero downtime, zero configuration by you.",
  },
  {
    number: "02",
    icon: Bot,
    title: "AI agent answers — every time",
    description:
      "Your agent knows your business, your services, your pricing. It speaks naturally, collects the caller's info, and qualifies the lead.",
  },
  {
    number: "03",
    icon: BellRing,
    title: "You get an instant alert",
    description:
      "A structured lead card hits your Telegram or SMS within seconds: caller name, number, what they need, and how hot the lead is.",
  },
  {
    number: "04",
    icon: CircleCheck,
    title: "You call back only warm leads",
    description:
      "No more chasing cold voicemails. You see the full context before you dial. Close the job, not the guesswork.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-20 px-4"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "var(--color-primary)" }}
          >
            How It Works
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
            Four steps. Zero work on your end.
          </h2>
          <p className="text-lg" style={{ color: "var(--color-text-3)" }}>
            We set it all up. You just get the leads.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {steps.map((step, i) => {
            const StepIcon = step.icon
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ type: "spring", stiffness: 300, damping: 24, delay: i * 0.1 }}
                className="relative rounded-2xl p-6 cursor-pointer"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "rgba(99,102,241,0.12)" }}
                  >
                    <StepIcon size={20} style={{ color: "var(--color-primary)" }} />
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-[10px] font-mono uppercase tracking-widest mb-1"
                      style={{ color: "var(--color-text-3)" }}
                    >
                      {step.number}
                    </p>
                    <h3 className="font-semibold mb-2" style={{ color: "var(--color-text-1)" }}>{step.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-3)" }}>
                      {step.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Bottom proof line */}
        <div className="text-center mt-10">
          <p className="text-sm" style={{ color: "var(--color-text-3)" }}>
            8,445+ calls handled · 24/7 coverage · Agent live within 24 hours
          </p>
        </div>
      </div>
    </section>
  );
}
