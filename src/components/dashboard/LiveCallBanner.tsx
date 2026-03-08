'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Link from 'next/link'

interface LiveCall {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  started_at: string
  business_name?: string | null
}

const BARS = [0.35, 0.8, 0.55, 1, 0.65, 0.9, 0.4, 0.75, 0.5, 0.85, 0.45, 0.7]

function LiveDuration({ startedAt }: { startedAt: string }) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  )

  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const m = Math.floor(secs / 60)
  const s = secs % 60
  return <span className="tabular-nums">{m}:{String(s).padStart(2, '0')}</span>
}

export default function LiveCallBanner({ calls }: { calls: LiveCall[] }) {
  return (
    <AnimatePresence>
      {calls.length > 0 && (
        <motion.div
          key="live-banner"
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          {calls.map((call, idx) => (
            <div
              key={call.id}
              className="relative overflow-hidden rounded-2xl border border-green-500/30 bg-[#050e08] p-4 mb-2 last:mb-0"
              style={{
                boxShadow: '0 0 0 1px rgba(34,197,94,0.08), 0 0 40px rgba(34,197,94,0.07), inset 0 1px 0 rgba(34,197,94,0.08)',
              }}
            >
              {/* Ambient glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(34,197,94,0.08) 0%, transparent 70%)',
                }}
              />

              <div className="relative flex items-center gap-4 flex-wrap sm:flex-nowrap">
                {/* Live pulse */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="relative flex w-2.5 h-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                  <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-green-400">
                    Signal Active
                  </span>
                </div>

                {/* Waveform equalizer */}
                <div className="flex items-center gap-px h-6 shrink-0">
                  {BARS.map((peak, i) => (
                    <motion.span
                      key={i}
                      className="w-[3px] rounded-full bg-green-400/70"
                      animate={{ scaleY: [0.15, peak, 0.15] }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.65 + (i % 4) * 0.12,
                        delay: i * 0.06,
                        ease: 'easeInOut',
                      }}
                      style={{
                        height: '100%',
                        transformOrigin: 'center',
                        display: 'inline-block',
                      }}
                    />
                  ))}
                </div>

                {/* Caller info */}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-green-200 font-medium truncate">
                    {call.caller_phone || 'Unknown caller'}
                  </p>
                  {call.business_name && (
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{call.business_name}</p>
                  )}
                </div>

                {/* Timer */}
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Duration</p>
                  <p className="text-base font-mono text-green-300 font-semibold">
                    <LiveDuration startedAt={call.started_at} />
                  </p>
                </div>

                {/* Other live calls count */}
                {idx === 0 && calls.length > 1 && (
                  <span className="text-xs text-green-500/50 shrink-0 hidden sm:block">
                    +{calls.length - 1} more
                  </span>
                )}

                {/* View link */}
                <Link
                  href={`/dashboard/calls/${call.ultravox_call_id}`}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 hover:border-green-500/35 transition-all"
                >
                  Monitor →
                </Link>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
