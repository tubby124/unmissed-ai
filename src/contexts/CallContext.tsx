"use client"

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react"
import { useUltravoxCall, type CallState } from "@/hooks/useUltravoxCall"
import type { AgentStatus, TranscriptEntry } from "@/components/DemoCallVisuals"
import { usePathname } from "next/navigation"

interface CallMeta {
  agentName: string
  businessName: string
  /** Route where the call was started — used for "Return to call" navigation */
  sourceRoute: string
}

interface CallContextValue {
  // Call state (from useUltravoxCall)
  callState: CallState
  agentStatus: AgentStatus
  transcripts: TranscriptEntry[]
  energy: number
  secondsLeft: number
  error: string | null
  startCall: (joinUrl: string) => Promise<void>
  endCall: () => Promise<void>
  /** Reset call + meta back to idle. Use for dismiss buttons. */
  resetCall: () => void
  transcriptContainerRef: React.RefObject<HTMLDivElement | null>

  // Call metadata
  meta: CallMeta | null
  setMeta: (meta: CallMeta) => void

  // PiP state
  isMinimized: boolean
  /** Whether the user is currently on the page where the call was started */
  isOnSourceRoute: boolean
}

const CallContext = createContext<CallContextValue | null>(null)

export function useCallContext() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error("useCallContext must be used within CallProvider")
  return ctx
}

/** Optional hook that returns null outside provider (for components that may or may not be in dashboard) */
export function useCallContextSafe() {
  return useContext(CallContext)
}

export function CallProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [meta, setMeta] = useState<CallMeta | null>(null)
  const metaRef = useRef<CallMeta | null>(null)

  const ultravox = useUltravoxCall({ maxSeconds: 300 })

  // Keep meta ref in sync
  const updateMeta = useCallback((m: CallMeta) => {
    metaRef.current = m
    setMeta(m)
  }, [])

  // Reset everything back to idle
  const resetCall = useCallback(() => {
    setMeta(null)
    metaRef.current = null
    ultravox.resetToIdle()
  }, [ultravox.resetToIdle])

  // Determine if the user is on the source route
  const isOnSourceRoute = !!(meta?.sourceRoute && pathname === meta.sourceRoute)

  // Minimized = call is active but user navigated away from source route
  const isMinimized = (ultravox.callState === "active" || ultravox.callState === "connecting") && !isOnSourceRoute && !!meta

  const value: CallContextValue = {
    callState: ultravox.callState,
    agentStatus: ultravox.agentStatus,
    transcripts: ultravox.transcripts,
    energy: ultravox.energy,
    secondsLeft: ultravox.secondsLeft,
    error: ultravox.error,
    startCall: ultravox.startCall,
    endCall: ultravox.endCall,
    resetCall,
    transcriptContainerRef: ultravox.transcriptContainerRef,
    meta,
    setMeta: updateMeta,
    isMinimized,
    isOnSourceRoute,
  }

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  )
}
