'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'motion/react'
import { BRAND_NAME } from '@/lib/brand'

const spring = { type: "spring" as const, stiffness: 300, damping: 24 }

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null)
  if (!supabaseRef.current) {
    supabaseRef.current = createBrowserClient()
  }
  const supabase = supabaseRef.current

  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError === 'invalid_link') {
      setError('Your login link has expired or was already used. Use "Forgot password" below or sign in with Google.')
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleGoogleSignIn() {
    setError('')
    setLoading(true)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
    // On success Supabase redirects — no further action needed
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/set-password`,
    })

    setLoading(false)
    if (resetError) {
      setError(resetError.message)
    } else {
      setResetSent(true)
    }
  }

  async function handleMagicLink() {
    setError('')
    setLoading(true)

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })

    setLoading(false)
    if (otpError) {
      setError(otpError.message)
    } else {
      setMagicLinkSent(true)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center py-8 px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        {/* Back to home */}
        <Link
          href="/"
          className="block text-center text-xs mb-5 transition-colors"
          style={{ color: 'var(--color-text-3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-2)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-3)')}
        >
          ← Back to {BRAND_NAME}
        </Link>

        {/* Logo / header area */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
        >
          {/* Social proof badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <span className="flex items-center gap-1">
                {[0,1,2,3,4].map(i => (
                  <svg key={i} width="8" height="8" viewBox="0 0 12 12" fill="currentColor" className="text-amber-400">
                    <path d="M6 0l1.5 4H12l-3.5 2.5 1.3 4L6 8.5 2.2 10.5l1.3-4L0 4h4.5z"/>
                  </svg>
                ))}
              </span>
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-2)' }}>8,400+ calls handled by {BRAND_NAME}</span>
            </div>
          </div>

          {/* Logo */}
          <div className="flex items-center gap-2.5 justify-center mb-6">
            <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center" style={{ boxShadow: '0 0 24px rgba(59,130,246,0.3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-semibold text-lg tracking-tight" style={{ color: 'var(--color-text-1)' }}>{BRAND_NAME}</span>
          </div>
        </motion.div>

        {/* Login card */}
        <motion.div
          className="card-surface rounded-2xl backdrop-blur-xl"
          style={{ boxShadow: 'var(--shadow-md)', padding: 'clamp(1.25rem, 5vw, 2rem)' }}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.1 }}
        >
          <AnimatePresence mode="wait">
            {forgotMode ? (
              <motion.div
                key="reset"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
              >
                <h1 className="font-semibold text-lg mb-1" style={{ color: 'var(--color-text-1)' }}>Reset password</h1>
                <p className="text-sm mb-5" style={{ color: 'var(--color-text-3)' }}>Enter your email and we&apos;ll send a reset link</p>

                <AnimatePresence mode="wait">
                  {resetSent ? (
                    <motion.div
                      key="reset-sent"
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
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-1)' }}>Reset link sent</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-3)' }}>Check your inbox at {email}</p>
                      <p className="text-xs mt-3" style={{ color: 'var(--color-text-3)' }}>
                        Not seeing it? Check spam, or{' '}
                        <button
                          type="button"
                          onClick={handleGoogleSignIn}
                          className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                        >
                          sign in with Google
                        </button>{' '}
                        instead.
                      </p>
                      <button
                        onClick={() => { setForgotMode(false); setResetSent(false) }}
                        className="mt-4 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        style={{ touchAction: 'manipulation' }}
                      >
                        Back to sign in
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="reset-form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={spring}
                    >
                      <form onSubmit={handleForgot} className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase mb-2" style={{ color: 'var(--color-text-3)' }}>
                            Email
                          </label>
                          <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            inputMode="email"
                            enterKeyHint="go"
                            className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-all"
                            style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-1)' }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border-focus)'; e.currentTarget.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--color-border-focus) 25%, transparent)' }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-input-border)'; e.currentTarget.style.boxShadow = 'none' }}
                            placeholder="you@company.com"
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
                          className="w-full bg-blue-500 hover:bg-blue-400 active:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-3 transition-colors"
                          style={{ touchAction: 'manipulation' }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {loading ? 'Sending…' : 'Send reset link'}
                        </motion.button>

                        <button
                          type="button"
                          onClick={() => setForgotMode(false)}
                          className="w-full text-xs transition-colors py-1"
                          style={{ touchAction: 'manipulation', color: 'var(--color-text-3)' }}
                        >
                          Back to sign in
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
              >
                <h1 className="font-semibold text-lg mb-1" style={{ color: 'var(--color-text-1)' }}>Sign in</h1>
                <p className="text-sm mb-5" style={{ color: 'var(--color-text-3)' }}>Access your call dashboard</p>

                {/* Google sign-in */}
                <motion.button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 active:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-900 font-semibold text-sm rounded-xl py-3 transition-colors mb-4"
                  style={{ touchAction: 'manipulation' }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </motion.button>

                <div className="relative flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>or</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase mb-2" style={{ color: 'var(--color-text-3)' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                      autoComplete="email"
                      inputMode="email"
                      enterKeyHint="next"
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-all"
                      style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-1)' }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border-focus)'; e.currentTarget.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--color-border-focus) 25%, transparent)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-input-border)'; e.currentTarget.style.boxShadow = 'none' }}
                      placeholder="you@company.com"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--color-text-3)' }}>
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setForgotMode(true)}
                        className="text-[10px] transition-colors"
                        style={{ touchAction: 'manipulation', color: 'var(--color-text-3)' }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      enterKeyHint="go"
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-all"
                      style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-1)' }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border-focus)'; e.currentTarget.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--color-border-focus) 25%, transparent)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-input-border)'; e.currentTarget.style.boxShadow = 'none' }}
                      placeholder="••••••••"
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
                    className="w-full bg-blue-500 hover:bg-blue-400 active:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-3 transition-all shadow-lg hover:shadow-xl"
                    style={{ touchAction: 'manipulation' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? 'Signing in…' : 'Sign in →'}
                  </motion.button>
                </form>

                <div className="relative flex items-center gap-3 my-3">
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>or</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                </div>

                <motion.button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={loading || !email || magicLinkSent}
                  className="w-full disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm rounded-xl py-3 transition-all"
                  style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-2)', touchAction: 'manipulation' }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {magicLinkSent ? 'Link sent — check your inbox' : 'Email me a sign-in link'}
                </motion.button>

                <AnimatePresence>
                  {magicLinkSent && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs text-center mt-2"
                      style={{ color: 'var(--color-text-3)' }}
                    >
                      Check your inbox and spam folder. If it doesn&apos;t arrive, use <button type="button" onClick={handleGoogleSignIn} className="text-blue-400 hover:text-blue-300 underline underline-offset-2">Google sign-in</button> instead.
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="text-center text-xs mt-5" style={{ color: 'var(--color-text-3)' }}>
          {BRAND_NAME}
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" style={{ backgroundColor: 'var(--color-bg)' }} />}>
      <LoginContent />
    </Suspense>
  )
}
