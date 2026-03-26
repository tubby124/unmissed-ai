'use client'

import { useState, useRef, Suspense } from 'react'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'motion/react'
import { BRAND_NAME } from '@/lib/brand'
import { trackEvent } from '@/lib/analytics'

const spring = { type: "spring" as const, stiffness: 300, damping: 24 }

type State = 'idle' | 'loading' | 'sent' | 'error'

function ForgotPasswordContent() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const supabaseRef = useRef<SupabaseClient | null>(null)

  function getSupabase() {
    if (!supabaseRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createBrowserClient } = require('@/lib/supabase/client')
      supabaseRef.current = createBrowserClient()
    }
    return supabaseRef.current!
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setState('loading')

    const trimmedEmail = email.trim()
    const redirectTo = `${window.location.origin}/auth/confirm?next=/auth/set-password`

    trackEvent('password_reset_requested', { method: 'email' })

    const { error } = await getSupabase().auth.resetPasswordForEmail(trimmedEmail, { redirectTo })

    // Supabase returns no error for unknown emails (by design — prevents enumeration).
    // Only surface errors for rate limiting or hard failures.
    if (error) {
      const isRateLimit = error.status === 429 || error.message.toLowerCase().includes('rate')
      if (isRateLimit) {
        setErrorMsg('Too many requests. Please wait a moment and try again.')
        setState('error')
        trackEvent('password_reset_request_failed', { reason: 'rate_limit' })
        return
      }
      // For any other error, still show success to avoid leaking info
    }

    trackEvent('password_reset_request_succeeded')
    setState('sent')
  }

  return (
    <div className="min-h-dvh flex items-center justify-center py-8 px-4 bg-page">
      <div className="w-full max-w-sm">
        <Link
          href="/login"
          className="block text-center t3 text-xs mb-5 hover:opacity-80 transition-colors"
        >
          &larr; Back to sign in
        </Link>

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="flex items-center gap-2.5 justify-center mb-6"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-[0_0_24px_rgba(59,130,246,0.3)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="t1 font-semibold text-lg tracking-tight">{BRAND_NAME}</span>
        </motion.div>

        <motion.div
          className="rounded-2xl b-theme bg-page backdrop-blur-xl shadow-2xl"
          style={{ padding: 'clamp(1.25rem, 5vw, 2rem)' }}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.1 }}
        >
          <AnimatePresence mode="wait">
            {state === 'sent' ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
                className="text-center py-2"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-blue-400">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h1 className="t1 font-semibold text-lg mb-2">Check your email</h1>
                <p className="t2 text-sm mb-1">
                  If an account exists for{' '}
                  <span className="font-medium t1">{email.trim()}</span>,
                  we&apos;ve sent a password reset link.
                </p>
                <p className="t3 text-xs mt-3">
                  It can take a minute to arrive. Check your spam folder if you don&apos;t see it.
                </p>
                <Link
                  href="/login"
                  className="inline-block mt-6 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Back to sign in
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
              >
                <h1 className="t1 font-semibold text-lg mb-1">Reset your password</h1>
                <p className="t3 text-sm mb-5">
                  Enter your email and we&apos;ll send you a link to set a new password.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-2">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                      autoComplete="email"
                      inputMode="email"
                      enterKeyHint="send"
                      placeholder="you@company.com"
                      className="w-full bg-page border b-theme rounded-xl px-4 py-3 text-sm t1 placeholder:t3 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:bg-hover transition-all"
                    />
                  </div>

                  <AnimatePresence>
                    {state === 'error' && errorMsg && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                      >
                        {errorMsg}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={state === 'loading'}
                    className="w-full bg-blue-500 hover:bg-blue-400 active:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-3 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)]"
                    style={{ touchAction: 'manipulation' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {state === 'loading' ? 'Sending\u2026' : 'Send reset link'}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="text-center t3 text-xs mt-5">
          Secured by Supabase Auth &middot; {BRAND_NAME}
        </p>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-page" />}>
      <ForgotPasswordContent />
    </Suspense>
  )
}
