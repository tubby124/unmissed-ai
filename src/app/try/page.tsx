"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import DemoCall from "@/components/DemoCall"
import { Phone } from "lucide-react"
import { loadVisitor, saveVisitor, normalizePhoneNA } from "@/lib/demo-visitor"

const AGENTS = [
  {
    id: "auto_glass",
    company: "Crystal Clear Auto Glass",
    agent: "Tyler",
    niche: "Auto Glass",
    description: "Windshield repair & replacement shop receptionist. Collects vehicle info, triages chip vs crack, and gets the boss to call back with a quote.",
    color: "#3B82F6",
  },
  {
    id: "property_mgmt",
    company: "Maple Ridge Property Management",
    agent: "Nicole",
    niche: "Property Management",
    description: "Property management office assistant. Handles maintenance requests, rental inquiries, billing questions, and routes everything to the manager.",
    color: "#8B5CF6",
  },
  {
    id: "real_estate",
    company: "Hasan Sharif — EXP Realty",
    agent: "Aisha",
    niche: "Real Estate",
    description: "Real estate AI voicemail assistant. Takes messages, books showings, and makes sure the agent calls back fast.",
    color: "#10B981",
  },
]

type DemoState =
  | { step: "select" }
  | { step: "name"; agentId: string }
  | { step: "call"; agentId: string; callerName: string; callerPhone: string; callerEmail: string }

export default function TryPage() {
  const [state, setState] = useState<DemoState>({ step: "select" })
  const [nameInput, setNameInput] = useState("")
  const [emailInput, setEmailInput] = useState("")
  const [phoneInput, setPhoneInput] = useState("")

  // Load saved visitor info on mount
  useEffect(() => {
    const saved = loadVisitor()
    if (saved) {
      setNameInput(saved.name)
      setEmailInput(saved.email)
      setPhoneInput(saved.phone)
    }
  }, [])

  const demoNumber = process.env.NEXT_PUBLIC_DEMO_TWILIO_NUMBER

  const selectedAgent = state.step !== "select"
    ? AGENTS.find(a => a.id === state.agentId)!
    : null

  return (
    <>
      <Navbar />

      <main style={{ backgroundColor: "var(--color-bg)" }} className="min-h-screen">
        {/* Header */}
        <section className="pt-32 pb-8 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <p
              className="text-xs font-mono uppercase tracking-widest mb-3"
              style={{ color: "var(--color-primary)" }}
            >
              Try It Free
            </p>
            <h1 className="text-4xl md:text-5xl font-black mb-4" style={{ color: "var(--color-text-1)" }}>
              Talk to an AI agent right now.
            </h1>
            <p className="text-lg" style={{ color: "var(--color-text-2)" }}>
              No sign-up. No credit card. Pick an agent below, say your name, and start talking.
              This is exactly what your customers will hear.
            </p>
          </div>
        </section>

        <section className="pb-20 px-4">
          <div className="max-w-3xl mx-auto">
            {/* Step 1: Select an agent */}
            {state.step === "select" && (
              <div className="space-y-4">
                <p className="text-sm text-center mb-6" style={{ color: "var(--color-text-3)" }}>Choose an industry to try:</p>
                {AGENTS.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => setState({ step: "name", agentId: agent.id })}
                    className="w-full text-left rounded-xl p-5 transition-all duration-200 hover:scale-[1.01] cursor-pointer"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 24px ${agent.color}22, 0 0 0 1px ${agent.color}33`
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-xs font-mono px-2 py-0.5 rounded"
                            style={{ backgroundColor: agent.color + "20", color: agent.color }}
                          >
                            {agent.niche}
                          </span>
                        </div>
                        <h3 className="font-semibold text-lg" style={{ color: "var(--color-text-1)" }}>{agent.company}</h3>
                        <p className="text-sm mt-1" style={{ color: "var(--color-text-2)" }}>{agent.description}</p>
                      </div>
                      <div className="shrink-0 mt-2">
                        <div className="relative">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm relative z-10"
                            style={{ backgroundColor: agent.color }}
                          >
                            {agent.agent[0]}
                          </div>
                          {/* Pulse ring around avatar */}
                          <div
                            className="absolute inset-0 rounded-full animate-ping"
                            style={{
                              backgroundColor: agent.color,
                              opacity: 0.15,
                              animationDuration: "2.5s",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs mt-3" style={{ color: "var(--color-text-3)" }}>
                      You&apos;ll talk to {agent.agent} — tap to start
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Enter your name */}
            {state.step === "name" && selectedAgent && (
              <div className="max-w-md mx-auto text-center">
                <button
                  onClick={() => setState({ step: "select" })}
                  className="text-sm transition-colors mb-6 inline-block"
                  style={{ color: "var(--color-text-3)" }}
                >
                  &larr; Pick a different agent
                </button>

                <div
                  className="rounded-xl p-6"
                  style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4"
                    style={{ backgroundColor: selectedAgent.color }}
                  >
                    {selectedAgent.agent[0]}
                  </div>
                  <h3 className="font-semibold text-lg mb-1" style={{ color: "var(--color-text-1)" }}>
                    Talk to {selectedAgent.agent}
                  </h3>
                  <p className="text-sm mb-6" style={{ color: "var(--color-text-2)" }}>
                    {selectedAgent.company}
                  </p>

                  <form
                    onSubmit={e => {
                      e.preventDefault()
                      const name = nameInput.trim() || "Friend"
                      const rawPhone = phoneInput.trim()
                      const phone = normalizePhoneNA(rawPhone) || rawPhone
                      const email = emailInput.trim()
                      saveVisitor({ name: nameInput.trim(), email, phone: rawPhone })
                      setState({ step: "call", agentId: state.agentId, callerName: name, callerPhone: phone, callerEmail: email })
                    }}
                  >
                    <input
                      type="text"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      placeholder="Your first name (optional)"
                      className="w-full px-4 py-3 rounded-lg text-sm mb-3 outline-none focus:ring-2"
                      style={{
                        color: "var(--color-text-1)",
                        backgroundColor: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                      }}
                      autoFocus
                    />
                    <input
                      type="email"
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      placeholder="Email (optional — we'll send you details)"
                      className="w-full px-4 py-3 rounded-lg text-sm mb-3 outline-none focus:ring-2"
                      style={{
                        color: "var(--color-text-1)",
                        backgroundColor: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                      }}
                    />
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value)}
                      placeholder="Phone (optional — enables live SMS demo)"
                      className="w-full px-4 py-3 rounded-lg text-sm mb-4 outline-none focus:ring-2"
                      style={{
                        color: "var(--color-text-1)",
                        backgroundColor: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                      }}
                    />
                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-colors"
                      style={{ backgroundColor: "var(--color-primary)" }}
                    >
                      Start 5-Minute Demo Call
                    </button>
                  </form>

                  <p className="text-xs mt-3" style={{ color: "var(--color-text-3)" }}>
                    Uses your microphone. 5-minute limit per demo.
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Active call */}
            {state.step === "call" && selectedAgent && (
              <DemoCall
                demoId={state.agentId}
                callerName={state.callerName}
                agentName={selectedAgent.agent}
                companyName={selectedAgent.company}
                agentColor={selectedAgent.color}
                extraBody={{
                  ...(state.callerPhone ? { callerPhone: state.callerPhone } : {}),
                  ...(state.callerEmail ? { callerEmail: state.callerEmail } : {}),
                }}
                onEnd={() => {
                  setState({ step: "select" })
                }}
              />
            )}
          </div>
        </section>

        {/* Phone demo CTA */}
        <section
          className="py-16 px-4 text-center"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
              Prefer to call from your phone?
            </h2>
            <p className="mb-6" style={{ color: "var(--color-text-2)" }}>
              Call our demo line and press 1 for auto glass, 2 for property management, or 3 for a real estate agent.
            </p>
            {demoNumber ? (
              <a
                href={`tel:${demoNumber}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-colors"
                style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-1)" }}
              >
                <Phone size={16} />
                {demoNumber}
              </a>
            ) : null}
          </div>
        </section>

        {/* Bottom CTA */}
        <section
          className="py-16 px-4 text-center"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
              Ready to get your own agent?
            </h2>
            <p className="mb-6" style={{ color: "var(--color-text-2)" }}>
              Set up takes under 5 minutes. Your agent is live within 24 hours.
            </p>
            <Link
              href="/onboard"
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Get My Agent Set Up &rarr;
            </Link>
            <p className="text-xs mt-2" style={{ color: "var(--color-text-3)" }}>
              No contracts &middot; Cancel anytime
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
