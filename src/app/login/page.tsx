'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()
  const supabase = createBrowserClient()

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

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
    })

    setLoading(false)
    if (resetError) {
      setError(resetError.message)
    } else {
      setResetSent(true)
    }
  }

  return (
    <div
      className="min-h-dvh flex items-center justify-center py-8 px-4"
      style={{ backgroundColor: '#09090b' }}
    >
      {/* Dot-grid background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, #1F1F1F 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Back to home */}
        <Link
          href="/"
          className="block text-center text-zinc-600 text-xs mb-5 hover:text-zinc-400 transition-colors"
        >
          ← Back to unmissed.ai
        </Link>

        {/* Social proof badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
            <span className="flex items-center gap-1">
              {[0,1,2,3,4].map(i => (
                <svg key={i} width="8" height="8" viewBox="0 0 12 12" fill="currentColor" className="text-amber-400">
                  <path d="M6 0l1.5 4H12l-3.5 2.5 1.3 4L6 8.5 2.2 10.5l1.3-4L0 4h4.5z"/>
                </svg>
              ))}
            </span>
            <span className="text-[11px] text-zinc-400 font-medium">8,400+ calls handled by unmissed.ai</span>
          </div>
        </div>

        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-[0_0_24px_rgba(59,130,246,0.3)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">unmissed.ai</span>
        </div>

        <div
          className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl shadow-2xl"
          style={{ padding: 'clamp(1.25rem, 5vw, 2rem)' }}
        >
          {forgotMode ? (
            <>
              <h1 className="text-white font-semibold text-lg mb-1">Reset password</h1>
              <p className="text-zinc-500 text-sm mb-5">Enter your email and we&apos;ll send a reset link</p>

              {resetSent ? (
                <div className="text-center py-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-green-400">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p className="text-zinc-300 text-sm font-medium">Reset link sent</p>
                  <p className="text-zinc-500 text-xs mt-1">Check your inbox at {email}</p>
                  <button
                    onClick={() => { setForgotMode(false); setResetSent(false) }}
                    className="mt-4 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-2">
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
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:bg-white/[0.05] transition-all"
                      placeholder="you@company.com"
                    />
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-500 hover:bg-blue-400 active:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-3 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setForgotMode(false)}
                    className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
                    style={{ touchAction: 'manipulation' }}
                  >
                    Back to sign in
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <h1 className="text-white font-semibold text-lg mb-1">Sign in</h1>
              <p className="text-zinc-500 text-sm mb-5">Access your call dashboard</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-2">
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
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:bg-white/[0.05] transition-all"
                    placeholder="you@company.com"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setForgotMode(true)}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                      style={{ touchAction: 'manipulation' }}
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
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:bg-white/[0.05] transition-all"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-400 active:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-3 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)]"
                  style={{ touchAction: 'manipulation' }}
                >
                  {loading ? 'Signing in…' : 'Sign in →'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-zinc-700 text-xs mt-5">
          Secured by Supabase Auth · unmissed.ai
        </p>
      </div>
    </div>
  )
}
