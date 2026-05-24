"use client"

import { useState } from "react"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import CallMeNowWidget from "@/components/CallMeNowWidget"
import { Phone, ArrowRight, CheckCircle2 } from "lucide-react"

const AGENTS = [
  {
    id: "auto_glass",
    company: "Auto Glass Shop",
    agent: "Aisha",
    niche: "Auto Glass",
    description: "Windshield repair and replacement calls: vehicle details, damage type, urgency, insurance/cash, and callback window.",
    color: "#3B82F6",
    variant: "windshield" as const,
  },
  {
    id: "property_mgmt",
    company: "Property Management Office",
    agent: "Nicole",
    niche: "Property Management",
    description: "Maintenance requests, tenant issues, rental inquiries, and clean summaries for the manager.",
    color: "#8B5CF6",
    variant: "default" as const,
  },
  {
    id: "real_estate",
    company: "Real Estate Team",
    agent: "Aisha",
    niche: "Real Estate",
    description: "Showing requests, buyer/seller questions, contact details, urgency, and next-step summaries.",
    color: "#10B981",
    variant: "default" as const,
  },
]

type Agent = (typeof AGENTS)[number]

export default function TryPage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent>(AGENTS[0])

  return (
    <>
      <Navbar />

      <main style={{ backgroundColor: "var(--color-bg)" }} className="min-h-screen">
        <section className="pt-32 pb-12 px-4">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p
                className="mb-4 text-xs font-mono uppercase tracking-widest"
                style={{ color: "var(--color-primary)" }}
              >
                Live phone demo
              </p>
              <h1
                className="mb-5 text-4xl font-black leading-[1.05] sm:text-5xl lg:text-6xl"
                style={{ color: "var(--color-text-1)" }}
              >
                Put in your number. The AI calls you.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed" style={{ color: "var(--color-text-2)" }}>
                No browser microphone. No fake chat widget. This is a real phone-call preview of how End Voicemail answers, qualifies, and summarizes missed calls for a business.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {[
                  "Calls your phone",
                  "Asks real intake questions",
                  "Shows the owner-summary flow",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-2)" }}>
                    <CheckCircle2 size={16} style={{ color: "var(--color-primary)" }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-3xl p-5 shadow-2xl sm:p-6"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow: "0 24px 70px rgba(15,23,42,0.10)",
              }}
            >
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>
                    Choose demo
                  </p>
                  <h2 className="mt-1 text-2xl font-bold" style={{ color: "var(--color-text-1)" }}>
                    {selectedAgent.agent} calls you
                  </h2>
                </div>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  style={{ backgroundColor: selectedAgent.color }}
                >
                  <Phone size={22} />
                </div>
              </div>

              <div className="mb-5 grid gap-2">
                {AGENTS.map((agent) => {
                  const active = agent.id === selectedAgent.id
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedAgent(agent)}
                      className="rounded-2xl p-4 text-left transition-all"
                      style={{
                        backgroundColor: active ? `${agent.color}12` : "var(--color-bg)",
                        border: `1px solid ${active ? agent.color : "var(--color-border)"}`,
                        cursor: "pointer",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--color-text-1)" }}>
                            {agent.niche}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-2)" }}>
                            {agent.description}
                          </p>
                        </div>
                        {active && <span className="text-xs font-semibold" style={{ color: agent.color }}>Selected</span>}
                      </div>
                    </button>
                  )
                })}
              </div>

              <CallMeNowWidget
                compact
                niche={selectedAgent.id}
                variant={selectedAgent.variant}
                collectName
                collectShopName={selectedAgent.id === "auto_glass"}
                collectPain={selectedAgent.id === "auto_glass"}
              />
            </div>
          </div>
        </section>

        <section className="px-4 pb-20">
          <div
            className="mx-auto grid max-w-6xl gap-4 rounded-3xl p-6 sm:grid-cols-3 sm:p-8"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            {[
              ["1", "Enter your number", "The demo places an outbound call to your phone, like a real customer callback."],
              ["2", "Act like a caller", "Give the AI a normal business scenario. It asks the intake questions one at a time."],
              ["3", "Hear the summary flow", "The AI explains what the owner receives: lead type, urgency, details, and next step."],
            ].map(([num, title, body]) => (
              <div key={num}>
                <div
                  className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
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
            Want this on your real missed calls?
          </h2>
          <p className="mx-auto mt-3 max-w-xl" style={{ color: "var(--color-text-2)" }}>
            Set up your AI number, forward missed/busy/after-hours calls, and run a real test with your business line.
          </p>
          <Link
            href={`/onboard?niche=${selectedAgent.id}`}
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
