'use client'

import { useState, useCallback } from 'react'
import { motion } from 'motion/react'
import ShimmerButton from '@/components/ui/shimmer-button'
import type { CardMode } from './usePatchSettings'

interface TestCallCardProps {
  clientId: string
  isAdmin: boolean
  previewMode?: boolean
  mode?: CardMode
}

export default function TestCallCard({ clientId, isAdmin, previewMode, mode = 'settings' }: TestCallCardProps) {
  const [phone, setPhone] = useState('')
  const [callState, setCallState] = useState<'idle' | 'calling' | 'done' | 'error'>('idle')
  const [callResult, setCallResult] = useState<{ callId?: string; twilio_sid?: string } | null>(null)
  const [callError, setCallError] = useState('')

  const fireTestCall = useCallback(async () => {
    if (!phone.trim()) return
    setCallState('calling')
    setCallResult(null)
    setCallError('')
    const body: Record<string, unknown> = { to_phone: phone.trim() }
    if (isAdmin) body.client_id = clientId
    try {
      const res = await fetch('/api/dashboard/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setCallState('done')
        setCallResult({ callId: data.callId, twilio_sid: data.twilio_sid })
      } else {
        setCallState('error')
        setCallError(data.error || 'Failed to start test call')
      }
    } catch {
      setCallState('error')
      setCallError('Network error')
    }
  }, [phone, clientId, isAdmin])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.02 }}
    >
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-1">{mode === 'onboarding' ? 'Hear Your Agent' : 'Test Your Agent'}</p>
        <p className="text-[11px] t3 mb-4">
          {mode === 'onboarding'
            ? 'Enter your phone number and your agent will call you. Hear exactly what callers experience.'
            : isAdmin
              ? 'Trigger the agent to call a phone number. Use after prompt changes to verify the agent sounds right. Logged as a test call in Call Logs.'
              : 'Hear your agent in action — enter your phone number and your agent will call you.'}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fireTestCall()}
            placeholder="+14031234567"
            disabled={callState === 'calling' || previewMode}
            className="flex-1 bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 font-mono focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40"
          />
          <ShimmerButton
            onClick={fireTestCall}
            disabled={!phone.trim() || callState === 'calling' || previewMode}
            borderRadius="12px"
            shimmerColor="rgba(99,102,241,0.5)"
            background="rgba(59,130,246,1)"
            className="px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 shrink-0"
          >
            {callState === 'calling' ? 'Dialing\u2026' : 'Call Me'}
          </ShimmerButton>
        </div>

        {callState === 'done' && callResult && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/[0.07] border border-green-500/20">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[11px] text-green-400/90">
              Call started — SID: <span className="font-mono">{callResult.twilio_sid?.slice(-8)}</span>
            </span>
            <button
              onClick={() => setCallState('idle')}
              className="ml-auto text-[10px] t3 hover:t2"
            >
              Dismiss
            </button>
          </div>
        )}

        {callState === 'error' && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/[0.07] border border-red-500/20">
            <span className="text-[11px] text-red-400/90 flex-1">{callError}</span>
            <button
              onClick={() => setCallState('idle')}
              className="text-[10px] t3 hover:t2"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
