'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Link from 'next/link'
import LiveDuration from './LiveDuration'
import { formatPhone } from '@/lib/format-phone'

interface LiveCall {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  started_at: string
  business_name?: string | null
  transfer_status?: string | null
}

const BARS = [0.35, 0.8, 0.55, 1, 0.65, 0.9, 0.4, 0.75, 0.5, 0.85, 0.45, 0.7]

export default function LiveCallBanner({ calls }: { calls: LiveCall[] }) {
  const [ending, setEnding] = useState<Record<string, boolean>>({})
  const [transferring, setTransferring] = useState<Record<string, boolean>>({})
  const [transferError, setTransferError] = useState<Record<string, string>>({})

  async function handleEndCall(ultravoxCallId: string) {
    if (ending[ultravoxCallId]) return
    setEnding(prev => ({ ...prev, [ultravoxCallId]: true }))
    try {
      await fetch(`/api/dashboard/calls/${ultravoxCallId}/whisper`, { method: 'DELETE' })
    } catch {
      // fire-and-forget; poll will update banner when call disappears
    } finally {
      setEnding(prev => ({ ...prev, [ultravoxCallId]: false }))
    }
  }

  async function handleTakeCall(ultravoxCallId: string) {
    if (transferring[ultravoxCallId]) return
    setTransferring(prev => ({ ...prev, [ultravoxCallId]: true }))
    setTransferError(prev => ({ ...prev, [ultravoxCallId]: '' }))
    try {
      const res = await fetch(`/api/dashboard/calls/${ultravoxCallId}/transfer-now`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = (body as { error?: string }).error || 'Could not transfer the call.'
        setTransferError(prev => ({ ...prev, [ultravoxCallId]: msg }))
      }
      // On success: realtime channel picks up transfer_status='transferring' and
      // the existing overlay at lines below renders automatically. The button
      // hides itself because we render based on call.transfer_status.
    } catch {
      setTransferError(prev => ({ ...prev, [ultravoxCallId]: 'Network error. Please try again.' }))
    } finally {
      setTransferring(prev => ({ ...prev, [ultravoxCallId]: false }))
    }
  }

  return (
    <AnimatePresence>
      {calls.length > 0 && (
        <motion.div
          key="live-banner"
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          {/* Header label */}
          <div className="flex items-center gap-2 mb-2 px-0.5">
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-green-500">
              {calls.length === 1 ? 'Active Call' : `${calls.length} Active Calls`}
            </span>
          </div>

          {calls.map((call) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="relative overflow-hidden rounded-2xl mb-2 last:mb-0"
              style={{
                background: 'linear-gradient(135deg, #030e06 0%, #050f08 60%, #040e07 100%)',
                boxShadow: '0 0 0 1px rgba(34,197,94,0.2), 0 0 60px rgba(34,197,94,0.08), inset 0 1px 0 rgba(34,197,94,0.12)',
              }}
            >
              {/* Animated border pulse via pseudo-overlay */}
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                style={{
                  boxShadow: 'inset 0 0 0 1px rgba(34,197,94,0.3)',
                }}
              />

              {/* Top ambient glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(34,197,94,0.1) 0%, transparent 60%)',
                }}
              />

              {/* Scanline sweep */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'linear', repeatDelay: 3 }}
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.06) 50%, transparent 100%)',
                  width: '50%',
                }}
              />

              <div className="relative p-4">
                {/* Top row: business name + timer */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    {call.business_name ? (
                      <>
                        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-green-400/80 mb-0.5">
                          {call.business_name}
                        </p>
                        <p className="font-mono text-base text-green-100 font-semibold tracking-tight truncate">
                          {formatPhone(call.caller_phone)}
                        </p>
                      </>
                    ) : (
                      <p className="font-mono text-base text-green-100 font-semibold tracking-tight truncate">
                        {formatPhone(call.caller_phone)}
                      </p>
                    )}
                  </div>

                  {/* Timer — right aligned, large */}
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-green-500/50 uppercase tracking-wider leading-none mb-1">Duration</p>
                    <p className="text-2xl font-mono text-green-300 font-bold leading-none tabular-nums">
                      <LiveDuration startedAt={call.started_at} />
                    </p>
                  </div>
                </div>

                {/* Transfer overlay */}
                {call.transfer_status === 'transferring' && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <span className="relative flex w-2 h-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
                    </span>
                    <span className="text-xs font-medium text-blue-300">Transferring to owner...</span>
                  </div>
                )}

                {/* Bottom row: waveform + monitor button */}
                <div className="flex items-center justify-between gap-3">
                  {/* Waveform equalizer */}
                  <div className="flex items-center gap-px h-5 shrink-0">
                    {BARS.map((peak, i) => (
                      <motion.span
                        key={i}
                        className="w-[3px] rounded-full bg-green-400/60"
                        animate={{ scaleY: [0.12, peak, 0.12] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.6 + (i % 4) * 0.11,
                          delay: i * 0.055,
                          ease: 'easeInOut',
                        }}
                        style={{ height: '100%', transformOrigin: 'center', display: 'inline-block' }}
                      />
                    ))}
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* End call — D378 */}
                    <button
                      onClick={() => handleEndCall(call.ultravox_call_id)}
                      disabled={!!ending[call.ultravox_call_id]}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-40"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      {ending[call.ultravox_call_id] ? 'Ending…' : 'End'}
                    </button>

                    {/* Take this call (manual mid-call transfer) — hidden once transfer is in-flight */}
                    {call.transfer_status !== 'transferring' && (
                      <button
                        onClick={() => handleTakeCall(call.ultravox_call_id)}
                        disabled={!!transferring[call.ultravox_call_id]}
                        title="Pull the caller off the agent and ring your phone"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/35 hover:bg-blue-500/25 hover:border-blue-500/55 hover:text-blue-200 transition-all disabled:opacity-40"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        {transferring[call.ultravox_call_id] ? 'Transferring…' : 'Take this call'}
                      </button>
                    )}

                    {/* Monitor CTA */}
                    <Link
                      href={`/dashboard/calls/${call.ultravox_call_id}`}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/35 hover:bg-green-500/30 hover:border-green-500/55 hover:text-green-200 transition-all"
                    >
                      <span className="relative flex w-1.5 h-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                      </span>
                      Just listen
                    </Link>
                  </div>
                </div>

                {/* Transfer error — surfaces 412/409/502 messages from /transfer-now */}
                {transferError[call.ultravox_call_id] && (
                  <div className="px-4 pb-3">
                    <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
                      {transferError[call.ultravox_call_id]}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
