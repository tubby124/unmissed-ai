"use client"

import { useState } from "react"
import { Phone, X } from "lucide-react"
import DemoCall from "./DemoCall"

const AGENTS = [
  {
    id: "auto_glass",
    company: "Crystal Clear Auto Glass",
    agent: "Tyler",
    niche: "Auto Glass",
    color: "#3B82F6",
  },
  {
    id: "property_mgmt",
    company: "Maple Ridge Property Mgmt",
    agent: "Nicole",
    niche: "Property Mgmt",
    color: "#8B5CF6",
  },
  {
    id: "real_estate",
    company: "Hasan Sharif — EXP Realty",
    agent: "Aisha",
    niche: "Real Estate",
    color: "#10B981",
  },
]

type Step = "closed" | "select" | "name" | "call"

interface State {
  step: Step
  agentId?: string
  callerName?: string
}

export default function TryItNowWidget() {
  const [state, setState] = useState<State>({ step: "closed" })
  const [nameInput, setNameInput] = useState("")

  const selectedAgent = state.agentId ? AGENTS.find(a => a.id === state.agentId) : null

  function close() {
    setState({ step: "closed" })
    setNameInput("")
  }

  return (
    <>
      {/* Floating button — only when closed */}
      {state.step === "closed" && (
        <button
          onClick={() => setState({ step: "select" })}
          aria-label="Try the AI demo"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full font-semibold text-sm text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{ backgroundColor: "var(--color-cta)" }}
        >
          <Phone size={16} />
          Try It Free
        </button>
      )}

      {/* Modal */}
      {state.step !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          <div
            className="w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 pt-5 pb-3"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <p className="font-bold text-sm" style={{ color: "var(--color-text-1)" }}>
                {state.step === "select" && "Pick an agent to try"}
                {state.step === "name" && `Talk to ${selectedAgent?.agent}`}
                {state.step === "call" && `${selectedAgent?.agent} · ${selectedAgent?.company}`}
              </p>
              <button onClick={close} style={{ color: "var(--color-text-3)" }}>
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              {/* Step 1: Select agent */}
              {state.step === "select" && (
                <div className="space-y-3">
                  {AGENTS.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => setState({ step: "name", agentId: agent.id })}
                      className="w-full text-left rounded-xl px-4 py-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
                      style={{
                        backgroundColor: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                          style={{ backgroundColor: agent.color }}
                        >
                          {agent.agent[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--color-text-1)" }}>
                            {agent.company}
                          </p>
                          <p className="text-xs" style={{ color: "var(--color-text-3)" }}>
                            {agent.niche} · Talk to {agent.agent}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                  <p className="text-xs text-center pt-1" style={{ color: "var(--color-text-3)" }}>
                    Uses your mic · No sign-up required
                  </p>
                </div>
              )}

              {/* Step 2: Enter name */}
              {state.step === "name" && selectedAgent && (
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    setState({ step: "call", agentId: state.agentId, callerName: nameInput.trim() || "Friend" })
                  }}
                  className="space-y-4"
                >
                  <input
                    type="text"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    placeholder="Your first name (optional)"
                    autoFocus
                    className="w-full px-4 py-3 rounded-lg text-sm outline-none"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-1)",
                    }}
                  />
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    Start 2-Minute Demo
                  </button>
                  <button
                    type="button"
                    onClick={() => setState({ step: "select" })}
                    className="w-full text-xs"
                    style={{ color: "var(--color-text-3)" }}
                  >
                    ← Pick a different agent
                  </button>
                </form>
              )}

              {/* Step 3: Active call */}
              {state.step === "call" && selectedAgent && (
                <DemoCall
                  demoId={state.agentId!}
                  callerName={state.callerName!}
                  agentName={selectedAgent.agent}
                  companyName={selectedAgent.company}
                  onEnd={close}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
