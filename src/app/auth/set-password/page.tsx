'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'motion/react'

const spring = { type: "spring" as const, stiffness: 300, damping: 24 }

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabaseRef = useRef<SupabaseClient | null>(null)

  function getSupabase() {
    if (!supabaseRef.current) {
      // Lazy-init: only runs in browser (never during SSR prerender)
      const { createBrowserClient } = require('@/lib/supabase/client')
      supabaseRef.current = createBrowserClient()
    }
    return supabaseRef.current!
  }

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login')
      } else {
        setChecking(false)
      }
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    const { error: updateError } = await getSupabase().auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1500)
  }

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-zinc-950">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex items-center justify-center py-8 px-4 bg-zinc-950">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="block text-center text-zinc-600 text-xs mb-5 hover:text-zinc-400 transition-colors"
        >
          &larr; Back to unmissed.ai
        </Link>

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
        >
          <div className="flex items-center gap-2.5 justify-center mb-6">
            <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-[0_0_24px_rgba(59,130,246,0.3)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">unmissed.ai</span>
          </div>
        </motion.div>

        <motion.div
          className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl shadow-2xl"
          style={{ padding: 'clamp(1.25rem, 5vw, 2rem)' }}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.1 }}
        >
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
                className="text-center py-4"
              >
                <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-green-400">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-zinc-300 text-sm font-medium">Password set</p>
                <p className="text-zinc-500 text-xs mt-1">Redirecting to dashboard&hellip;</p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
              >
                <h1 className="text-white font-semibold text-lg mb-1">Set your password</h1>
                <p className="text-zinc-500 text-sm mb-5">Choose a password for your account</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-2">
                      New password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoFocus
                      autoComplete="new-password"
                      enterKeyHint="next"
                      minLength={8}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:bg-white/[0.05] transition-all"
                      placeholder="At least 8 characters"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-2">
                      Confirm password
                    </label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                      enterKeyHint="go"
                      minLength={8}
                      className="w-full bg-white/[0.08] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:bg-white/[0.05] transition-all"
                      placeholder="Re-enter password"
                    />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-500 hover:bg-blue-400 active:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-3 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)]"
                    style={{ touchAction: 'manipulation' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? 'Setting password\u2026' : 'Set password'}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="text-center text-zinc-700 text-xs mt-5">
          Secured by Supabase Auth &middot; unmissed.ai
        </p>
      </div>
    </div>
  )
}
