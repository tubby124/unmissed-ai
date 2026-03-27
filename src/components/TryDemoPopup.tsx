"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"

export default function TryDemoPopup() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed this session
    if (sessionStorage.getItem("tryDemoDismissed")) return

    const timer = setTimeout(() => setVisible(true), 5000)
    return () => clearTimeout(timer)
  }, [])

  const dismiss = () => {
    setVisible(false)
    sessionStorage.setItem("tryDemoDismissed", "1")
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-80 z-50"
          style={{ willChange: "transform, opacity" }}
        >
          <div
            className="rounded-2xl p-4 shadow-2xl backdrop-blur-sm"
            style={{
              backgroundColor: "rgba(20, 20, 20, 0.95)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
            }}
          >
            {/* Dismiss */}
            <button
              onClick={dismiss}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Dismiss"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>

            <div className="flex items-start gap-3">
              {/* Headset icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(59, 130, 246, 0.15)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 18v-6a9 9 0 0118 0v6" />
                  <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-semibold leading-tight">
                  Talk to Zara, our AI receptionist
                </p>
                <p className="text-gray-400 text-xs mt-0.5">
                  Free, no sign-up. Browser call, no phone needed.
                </p>

                <Link
                  href="/try"
                  onClick={dismiss}
                  className="inline-block mt-2.5 px-4 py-1.5 rounded-lg text-white text-xs font-semibold transition-colors"
                  style={{ backgroundColor: "#3B82F6" }}
                >
                  Try it now
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
