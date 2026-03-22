'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  VoiceOrb,
  WaveformBars,
  StatusBadge,
  CallTimer,
  TranscriptBubble,
  EndCallButton,
  createSoundCues,
  type AgentStatus,
  type TranscriptEntry,
} from '@/components/DemoCallVisuals'
import ImprovementHints from './ImprovementHints'
import { analyzeTranscriptClient, type CallInsight } from '@/lib/transcript-analysis'

let UltravoxSession: typeof import('ultravox-client').UltravoxSession | null = null
let UltravoxSessionStatus: typeof import('ultravox-client').UltravoxSessionStatus | null = null

type CallState = 'idle' | 'requesting' | 'connecting' | 'active' | 'ended' | 'error'

export interface AgentKnowledge {
  agentName?: string
  hasFacts: boolean
  hasFaqs: boolean
  hasHours: boolean
  hasBooking: boolean
  hasTransfer: boolean
  hasSms: boolean
  hasKnowledge: boolean
  hasWebsite: boolean
}

interface AgentVoiceTestProps {
  clientId: string
  isAdmin: boolean
  knowledge?: AgentKnowledge
  onEnd?: () => void
  onScrollTo?: (section: string) => void
}

export default function AgentVoiceTest({ clientId, isAdmin, knowledge, onEnd, onScrollTo }: AgentVoiceTestProps) {
  const [callState, setCallState] = useState<CallState>('idle')
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle')
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(300)
  const [agentName, setAgentName] = useState('Your Agent')
  const [energy, setEnergy] = useState(0.3)
  const [callInsight, setCallInsight] = useState<CallInsight | null>(null)

  const sessionRef = useRef<InstanceType<typeof import('ultravox-client').UltravoxSession> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptContainerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const energyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const soundRef = useRef<ReturnType<typeof createSoundCues> | null>(null)
  const agentStatusDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-scroll transcript
  useEffect(() => {
    const c = transcriptContainerRef.current
    if (c) c.scrollTop = c.scrollHeight
  }, [transcripts])

  // Simulated audio energy
  useEffect(() => {
    if (energyIntervalRef.current) clearInterval(energyIntervalRef.current)
    if (callState !== 'active') { setEnergy(0.3); return }

    energyIntervalRef.current = setInterval(() => {
      setEnergy(() => {
        if (agentStatus === 'speaking') return 0.6 + Math.random() * 0.4
        if (agentStatus === 'listening') return 0.1 + Math.random() * 0.3
        return 0.3
      })
    }, 120)

    return () => { if (energyIntervalRef.current) clearInterval(energyIntervalRef.current) }
  }, [callState, agentStatus])

  // Countdown timer
  useEffect(() => {
    if (callState === 'active') {
      timerRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) { handleEndCall(); return 0 }
          return prev - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState])

  const handleEndCall = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (energyIntervalRef.current) clearInterval(energyIntervalRef.current)
    soundRef.current?.endTone()
    try { await sessionRef.current?.leaveCall() } catch { /* ignore */ }
    sessionRef.current = null
    setCallState('ended')
  }, [])

  const startCall = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setCallState('requesting')
    setError(null)
    setTranscripts([])
    setSecondsLeft(300)
    setCallInsight(null)

    if (!soundRef.current) soundRef.current = createSoundCues()

    try {
      // Lazy-load SDK
      if (!UltravoxSession) {
        const mod = await import('ultravox-client')
        UltravoxSession = mod.UltravoxSession
        UltravoxSessionStatus = mod.UltravoxSessionStatus
      }

      if (controller.signal.aborted) return

      // Request mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())

      if (controller.signal.aborted) return

      // Create call via authenticated API
      const body: Record<string, unknown> = {}
      if (isAdmin) body.client_id = clientId
      const res = await fetch('/api/dashboard/agent-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to start test call' }))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      if (controller.signal.aborted) return

      const { joinUrl, agentName: name } = await res.json()
      if (name) setAgentName(name)

      if (controller.signal.aborted) return

      // Connect WebRTC
      setCallState('connecting')
      const session = new UltravoxSession!()
      sessionRef.current = session

      session.addEventListener('status', () => {
        const status = session.status

        if (agentStatusDebounceRef.current) clearTimeout(agentStatusDebounceRef.current)
        agentStatusDebounceRef.current = setTimeout(() => {
          if (status === UltravoxSessionStatus!.SPEAKING) setAgentStatus('speaking')
          else if (status === UltravoxSessionStatus!.LISTENING) setAgentStatus('listening')
          else if (status === UltravoxSessionStatus!.THINKING) setAgentStatus('thinking')
          else setAgentStatus('idle')
        }, 150)

        if (
          status === UltravoxSessionStatus!.IDLE ||
          status === UltravoxSessionStatus!.LISTENING ||
          status === UltravoxSessionStatus!.SPEAKING
        ) {
          setCallState(prev => {
            if (prev !== 'active') soundRef.current?.connectChime()
            return 'active'
          })
        } else if (status === UltravoxSessionStatus!.DISCONNECTED) {
          setCallState('ended')
          if (timerRef.current) clearInterval(timerRef.current)
        }
      })

      session.addEventListener('transcripts', () => {
        const all = session.transcripts.map(t => ({
          speaker: t.speaker === 'user' ? ('user' as const) : ('agent' as const),
          text: t.text,
          isFinal: t.isFinal,
        }))
        setTranscripts(all)
      })

      session.joinCall(joinUrl)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setError('Microphone access is required. Please allow mic access and try again.')
      } else {
        setError(msg)
      }
      setCallState('error')
    }
  }, [clientId, isAdmin])

  // L5/R1: Client-side transcript analysis — runs instantly when call ends
  useEffect(() => {
    if (callState !== 'ended' || !knowledge || transcripts.length === 0) return
    try {
      const insight = analyzeTranscriptClient(transcripts, knowledge)
      setCallInsight(insight)
    } catch {
      // Analysis failure is non-critical — config hints still show
    }
  }, [callState, knowledge, transcripts])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      sessionRef.current?.leaveCall().catch(() => {})
      if (timerRef.current) clearInterval(timerRef.current)
      if (energyIntervalRef.current) clearInterval(energyIntervalRef.current)
      if (agentStatusDebounceRef.current) clearTimeout(agentStatusDebounceRef.current)
    }
  }, [])

  const finalTranscripts = transcripts.filter(t => t.isFinal)

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {/* ── Idle — Start Button ── */}
        {callState === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-6"
          >
            <button
              onClick={startCall}
              className="group relative cursor-pointer"
            >
              <VoiceOrb status="idle" energy={0.3} size="md" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-indigo-300 group-hover:text-white transition-colors">
                  <path d="M12 18.75a6.75 6.75 0 006.75-6.75V6a6.75 6.75 0 00-13.5 0v6A6.75 6.75 0 0012 18.75z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 22.5v-3.75M8.25 22.5h7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </button>
            <p className="text-xs t3 text-center">
              Tap to start a conversation
            </p>
            {/* Pre-call: what to try */}
            {knowledge && (
              <div className="w-full space-y-1 mt-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider t3 text-center">Try asking</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {knowledge.hasHours && <TryChip text="What are your hours?" />}
                  {knowledge.hasBooking && <TryChip text="Can I book an appointment?" />}
                  {(knowledge.hasFacts || knowledge.hasFaqs) && <TryChip text="Tell me about your business" />}
                  {knowledge.hasKnowledge && <TryChip text="Ask a detailed question" />}
                  {!knowledge.hasHours && !knowledge.hasBooking && !knowledge.hasFacts && !knowledge.hasFaqs && (
                    <TryChip text="Hi, how can you help me?" />
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Requesting / Connecting ── */}
        {(callState === 'requesting' || callState === 'connecting') && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-6"
          >
            <VoiceOrb status="idle" energy={0.3} size="md" connecting={callState === 'connecting'} />
            <motion.p
              className="text-sm font-medium t1"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              {callState === 'requesting' ? 'Starting call...' : `Connecting to ${agentName}...`}
            </motion.p>
            <p className="text-[11px] t3">Make sure your microphone is enabled</p>
          </motion.div>
        )}

        {/* ── Active Call ── */}
        {callState === 'active' && (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className="rounded-2xl p-4"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(24px)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-sm t1">Talking to {agentName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={agentStatus} callState="active" />
                  <CallTimer secondsLeft={secondsLeft} totalSeconds={300} />
                </div>
              </div>

              {/* Orb + Waveform */}
              <div className="flex flex-col items-center gap-3 mb-4">
                <VoiceOrb status={agentStatus} energy={energy} size="md" />
                <WaveformBars status={agentStatus} energy={energy} />
              </div>

              {/* Transcripts */}
              <div
                ref={transcriptContainerRef}
                className="h-40 overflow-y-auto space-y-2 mb-3 px-1"
              >
                {transcripts.length === 0 && (
                  <p className="text-sm italic text-center pt-4 t3">
                    Waiting for {agentName} to speak...
                  </p>
                )}
                {transcripts.map((t, i) => (
                  <TranscriptBubble
                    key={i}
                    entry={t}
                    agentName={agentName}
                    showLabel={i === 0 || transcripts[i - 1].speaker !== t.speaker}
                  />
                ))}
              </div>

              {/* End call */}
              <EndCallButton onEnd={handleEndCall} />
            </div>
          </motion.div>
        )}

        {/* ── Call Ended ── */}
        {callState === 'ended' && (
          <motion.div
            key="ended"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 py-4"
          >
            <div className="relative w-14 h-14">
              <div
                className="w-full h-full rounded-full flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle at 35% 35%, rgba(16,185,129,0.3), rgba(15,23,42,0.8))',
                  boxShadow: '0 0 20px rgba(16,185,129,0.12)',
                }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-emerald-400">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-base font-semibold t1">Call complete</p>
              <p className="text-[11px] t3 mt-0.5">
                {finalTranscripts.length} messages exchanged
              </p>
            </div>

            {/* Mini transcript preview */}
            {finalTranscripts.length > 0 && (
              <div className="w-full rounded-xl border b-theme bg-white/[0.02] p-3 max-h-32 overflow-y-auto space-y-1.5">
                {finalTranscripts.slice(-6).map((t, i) => (
                  <div key={i} className="text-[11px] leading-relaxed">
                    <span className="font-mono t3 mr-1">{t.speaker === 'agent' ? agentName : 'You'}:</span>
                    <span className="t2">{t.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Post-call improvement hints (L5: transcript-aware + config-aware) */}
            {knowledge && (
              <ImprovementHints knowledge={knowledge} callInsight={callInsight} onScrollTo={onScrollTo} />
            )}

            <div className="flex gap-2 w-full">
              <button
                onClick={() => { setCallState('idle'); setTranscripts([]); setCallInsight(null) }}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white transition-colors cursor-pointer"
              >
                Talk Again
              </button>
              {onEnd && (
                <button
                  onClick={onEnd}
                  className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-hover t3 border b-theme cursor-pointer"
                >
                  Done
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Error ── */}
        {callState === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 py-6"
          >
            <VoiceOrb status="idle" energy={0.1} size="sm" />
            <p className="text-sm font-medium text-red-400">Could not connect</p>
            <p className="text-[11px] t3 text-center">{error}</p>
            <button
              onClick={() => { setCallState('idle'); startCall() }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white cursor-pointer"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Helper components ── */

function TryChip({ text }: { text: string }) {
  return (
    <span className="inline-block px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] t3">
      &ldquo;{text}&rdquo;
    </span>
  )
}

// ImprovementHints extracted to ./ImprovementHints.tsx (L5)
