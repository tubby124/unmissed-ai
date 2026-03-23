"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { DEMOS } from "./demo-data"
import DemoCallCard from "./DemoCallCard"
import DemoOutcome from "./DemoOutcome"

export default function DemoAudioPlayer() {
  const [activeTab, setActiveTab] = useState("auto-glass")
  const [visibleCount, setVisibleCount] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [showOutcome, setShowOutcome] = useState(false)
  const [elapsedSecs, setElapsedSecs] = useState(0)
  const [callStage, setCallStage] = useState<"ringing" | "live" | "ended">("ringing")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const demo = DEMOS.find((d) => d.id === activeTab)!

  // Call timer
  useEffect(() => {
    if (callStage === "live") {
      intervalRef.current = setInterval(() => {
        setElapsedSecs((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [callStage])

  // Animate messages one by one
  const animate = useCallback(() => {
    const msgs = demo.messages
    let idx = 0

    setCallStage("ringing")
    timerRef.current = setTimeout(() => {
      setCallStage("live")

      const showNext = () => {
        if (idx >= msgs.length) {
          setIsTyping(false)
          timerRef.current = setTimeout(() => {
            setCallStage("ended")
            setShowOutcome(true)
          }, 600)
          return
        }

        const msg = msgs[idx]
        if (msg.role === "agent") {
          setIsTyping(true)
          timerRef.current = setTimeout(() => {
            setIsTyping(false)
            idx++
            setVisibleCount(idx)
            timerRef.current = setTimeout(showNext, 400)
          }, 800 + Math.random() * 400)
        } else {
          idx++
          setVisibleCount(idx)
          timerRef.current = setTimeout(showNext, 500 + Math.random() * 300)
        }
      }

      timerRef.current = setTimeout(showNext, 600)
    }, 1200)
  }, [demo.messages])

  // Start animation on mount or tab switch
  useEffect(() => {
    setVisibleCount(0)
    setIsTyping(false)
    setShowOutcome(false)
    setElapsedSecs(0)
    setCallStage("ringing")

    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)

    const startTimer = setTimeout(() => {
      animate()
    }, 300)

    return () => {
      clearTimeout(startTimer)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [activeTab, animate])

  const switchTab = (id: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    setActiveTab(id)
  }

  return (
    <section id="demo" className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-10">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "var(--color-primary)" }}
          >
            Live Demo
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold mb-3"
            style={{ color: "var(--color-text-1)" }}
          >
            See it in action.
          </h2>
          <p className="text-lg" style={{ color: "var(--color-text-2)" }}>
            Real conversations your AI receptionist handles — every call captured, every lead saved.
          </p>
        </div>

        {/* Niche tabs */}
        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {DEMOS.map((d) => (
            <button
              key={d.id}
              onClick={() => switchTab(d.id)}
              className="px-5 py-2 rounded-full text-sm font-medium transition-all cursor-pointer"
              style={
                activeTab === d.id
                  ? {
                      backgroundColor: "rgba(99,102,241,0.12)",
                      color: "var(--color-primary)",
                      border: "1px solid rgba(99,102,241,0.25)",
                    }
                  : {
                      backgroundColor: "transparent",
                      color: "var(--color-text-3)",
                      border: "1px solid var(--color-border)",
                    }
              }
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Two-column layout: call card left, outcome right */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-3">
            <DemoCallCard
              demo={demo}
              activeTab={activeTab}
              callStage={callStage}
              isTyping={isTyping}
              visibleCount={visibleCount}
              elapsedSecs={elapsedSecs}
            />
          </div>

          <div className="lg:col-span-2">
            <DemoOutcome demo={demo} showOutcome={showOutcome} />
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-center mt-10"
        >
          <Link
            href="/try"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer"
            style={{ backgroundColor: "var(--color-cta)" }}
          >
            Talk to an AI Agent Live
            <ArrowRight size={16} />
          </Link>
          <p className="text-xs mt-2" style={{ color: "var(--color-text-3)" }}>
            No sign-up needed · Uses your microphone · 5-minute demo
          </p>
        </motion.div>
      </div>
    </section>
  )
}
