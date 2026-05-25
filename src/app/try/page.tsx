"use client"

import { useState } from "react"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import CallMeNowWidget from "@/components/CallMeNowWidget"
import { Phone, ArrowRight, CheckCircle2, Sparkles } from "lucide-react"

const DEMOS = [
  {
    id: "voicemail_replacement",
    label: "Default demo",
    company: "Service Business",
    agent: "Zara",
    niche: "Voicemail replacement",
    description:
      "The clean EndVoicemail demo: Zara probes for the missed-call problem, roleplays a real caller, reveals the owner summary, then offers the setup link.",
    color: "#10B981",
    variant: "default" as const,
  },
  {
    id: "auto_glass",
    label: "Industry example",
    company: "Auto Glass Shop",
    agent: "Zara",
    niche: "Auto glass shop",
    description:
      "Only use this if you want the windshield-shop version: vehicle, damage, ADAS, urgency, insurance/cash, and callback priority.",
    color: "#3B82F6",
    variant: "windshield" as const,
  },
  {
    id: "property_mgmt",
    label: "Industry example",
    company: "Property Management Office",
    agent: "Zara",
    niche: "Property management",
    description:
      "Tenant/owner/prospect calls: issue, property, urgency, contact details, and a clean manager handoff.",
    color: "#8B5CF6",
    variant: "default" as const,
  },
]

type Demo = (typeof DEMOS)[number]

const VALUE_STACK = [
  ["Dream outcome", "No more digging through voicemail audio to find the one call worth returning."],
  ["Likelihood", "The demo shows the exact intake pattern: ask, wait, probe, summarize, next step."],
  ["Time delay", "Owner gets the useful version immediately — name, need, urgency, callback priority."],
  ["Effort", "Keep your number. Forward missed/busy/after-hours calls. No porting circus."],
]

const FLOW = [
  ["01", "Opens with context", "Zara explains this is a short demo and asks what kind of missed call you want to test."],
  ["02", "Probes like a receptionist", "One question at a time. No monologue. She waits, then asks the next useful question."],
  ["03", "Reveals the owner view", "You hear what the business gets: lead status, caller intent, urgency, and callback action."],
  ["04", "Asks for the next step", "$119/mo, 250 minutes, no setup fee, 30-day money-back guarantee — then offers the setup link."],
]

export default function TryPage() {
  const [selectedDemo, setSelectedDemo] = useState<Demo>(DEMOS[0])
  const isAutoGlass = selectedDemo.id === "auto_glass"

  return (
    <>
      <Navbar />

      <main style={{ backgroundColor: "var(--color-bg)" }} className="min-h-screen overflow-hidden">
        <section className="relative pt-32 pb-12 px-4">
          <div
            className="absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle, var(--color-primary), transparent 70%)" }}
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="mb-4 text-xs font-mono uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>
                Live phone demo
              </p>
              <h1 className="mb-5 text-4xl font-black leading-[1.03] tracking-[-0.04em] sm:text-5xl lg:text-6xl" style={{ color: "var(--color-text-1)" }}>
                Let Zara call you and prove voicemail is the wrong product.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed" style={{ color: "var(--color-text-2)" }}>
                The default demo is not a glass-shop script. It is the core EndVoicemail pitch: answer the missed caller, ask useful questions, show the owner summary, and make the next step obvious.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {VALUE_STACK.map(([title, body]) => (
                  <div key={title} className="rounded-2xl p-4" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                    <div className="mb-2 flex items-center gap-2">
                      <CheckCircle2 size={16} style={{ color: "var(--color-primary)" }} />
                      <p className="text-sm font-semibold" style={{ color: "var(--color-text-1)" }}>{title}</p>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-2)" }}>{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-[2rem] p-5 shadow-2xl sm:p-6"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow: "0 28px 90px rgba(15,23,42,0.14)",
              }}
            >
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest" style={{ color: selectedDemo.color }}>
                    {selectedDemo.label}
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.02em]" style={{ color: "var(--color-text-1)" }}>
                    {selectedDemo.agent} calls you
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--color-text-3)" }}>
                    Selected: {selectedDemo.niche}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: selectedDemo.color }}>
                  <Phone size={22} />
                </div>
              </div>

              <CallMeNowWidget
                compact
                niche={selectedDemo.id}
                variant={selectedDemo.variant}
                collectName
                collectShopName={isAutoGlass}
                collectPain={isAutoGlass}
              />

              <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles size={16} style={{ color: "var(--color-primary)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text-1)" }}>What to do on the call</p>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-2)" }}>
                  Answer like a real caller. Give short replies. If Zara barrels through without waiting or fails to reveal the owner summary, that is a bug — not the intended demo.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-12">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>
                  Optional demo routes
                </p>
                <h2 className="mt-1 text-2xl font-black" style={{ color: "var(--color-text-1)" }}>
                  Pick a niche only when it matches the page.
                </h2>
              </div>
              <p className="max-w-lg text-sm" style={{ color: "var(--color-text-3)" }}>
                The main landing page should stay generic. Auto-glass belongs on the auto-glass page.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {DEMOS.map((demo) => {
                const active = demo.id === selectedDemo.id
                return (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => setSelectedDemo(demo)}
                    className="rounded-2xl p-4 text-left transition-all"
                    style={{
                      backgroundColor: active ? `${demo.color}12` : "var(--color-surface)",
                      border: `1px solid ${active ? demo.color : "var(--color-border)"}`,
                      cursor: "pointer",
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-bold" style={{ color: "var(--color-text-1)" }}>{demo.niche}</p>
                      {active && <span className="text-xs font-semibold" style={{ color: demo.color }}>Selected</span>}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-2)" }}>{demo.description}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20">
          <div className="mx-auto grid max-w-6xl gap-4 rounded-[2rem] p-6 sm:grid-cols-2 lg:grid-cols-4 sm:p-8" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            {FLOW.map(([num, title, body]) => (
              <div key={num}>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: "var(--color-primary)" }}>
                  {num}
                </div>
                <h3 className="font-semibold" style={{ color: "var(--color-text-1)" }}>{title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-2)" }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 pb-24 text-center">
          <h2 className="text-3xl font-black" style={{ color: "var(--color-text-1)" }}>
            Want this replacing your actual voicemail?
          </h2>
          <p className="mx-auto mt-3 max-w-xl" style={{ color: "var(--color-text-2)" }}>
            Set up your AI number, forward missed/busy/after-hours calls, and stop losing callback context.
          </p>
          <Link
            href={`/onboard?niche=${selectedDemo.id}`}
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-7 py-4 text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Set up my AI receptionist <ArrowRight size={16} />
          </Link>
        </section>
      </main>

      <Footer />
    </>
  )
}
