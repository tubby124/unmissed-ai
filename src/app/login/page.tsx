'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'motion/react'
import { BRAND_NAME, BRAND_PRODUCT } from '@/lib/brand'
import ThemeToggle from '@/components/ThemeToggle'

const spring = { type: "spring" as const, stiffness: 300, damping: 24 }

/* ── Testimonial data ──────────────────────────────────────────────── */
const testimonials = [
  {
    quote: "Our front desk used to miss 40% of after-hours calls. Now every single one gets answered.",
    name: "Sarah Chen",
    role: "Operations Manager",
    company: "Precision Auto Glass",
  },
  {
    quote: "Setup took 10 minutes. The AI handles bookings better than our old answering service.",
    name: "Marcus Williams",
    role: "Owner",
    company: "Urban Vibe Barbershop",
  },
]

/* ── Stats for the showcase panel ──────────────────────────────────── */
const stats = [
  { value: "8,400+", label: "Calls handled" },
  { value: "24/7", label: "Availability" },
  { value: "<3s", label: "Avg. pickup" },
]

/* ── Reusable glass input ──────────────────────────────────────────── */
function GlassInput({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium mb-2 t3">
        {label}
      </label>
      <input
        {...props}
        className="w-full rounded-xl px-4 py-3 text-sm bg-input b-input border transition-all placeholder:t3 t1 focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]/25 focus:border-[var(--color-border-focus)]"
      />
    </div>
  )
}

/* ── Google icon ───────────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

/* ── Phone icon for brand ──────────────────────────────────────────── */
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   SHOWCASE PANEL — left side (desktop only)
   ══════════════════════════════════════════════════════════════════════ */
function ShowcasePanel() {
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTestimonial(prev => (prev + 1) % testimonials.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="hidden lg:flex relative flex-col justify-between overflow-hidden rounded-3xl p-10 xl:p-14"
      style={{
        background: 'linear-gradient(135deg, var(--color-primary) 0%, #7c3aed 50%, #a855f7 100%)',
        minHeight: '100%',
      }}
    >
      {/* Decorative grid overlay */}
      <div className="absolute inset-0 opacity-[0.07]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }} />

      {/* Floating glow orbs */}
      <div className="absolute top-20 right-20 w-64 h-64 rounded-full blur-3xl" style={{
        background: 'rgba(255,255,255,0.08)',
        animation: 'pulseGlow 4s ease-in-out infinite',
      }} />
      <div className="absolute bottom-32 left-10 w-48 h-48 rounded-full blur-3xl" style={{
        background: 'rgba(255,255,255,0.05)',
        animation: 'pulseGlow 5s ease-in-out infinite 1s',
      }} />

      {/* Top: brand + tagline */}
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6" style={{ animation: 'slideRightIn 0.6s ease-out' }}>
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
            <PhoneIcon className="text-white" />
          </div>
          <span className="font-semibold text-lg text-white tracking-tight">{BRAND_NAME}</span>
        </div>

        <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-3" style={{ animation: 'slideRightIn 0.6s ease-out 0.1s both' }}>
          Your {BRAND_PRODUCT},<br />always on.
        </h2>
        <p className="text-white/70 text-base max-w-sm" style={{ animation: 'slideRightIn 0.6s ease-out 0.2s both' }}>
          Never miss a call again. AI answers, books, and follows up — while you focus on what matters.
        </p>
      </div>

      {/* Middle: floating UI mockup card */}
      <div className="relative z-10 my-8" style={{ animation: 'fadeSlideIn 0.8s ease-out 0.3s both' }}>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 p-5 max-w-sm" style={{ animation: 'gridFloat 6s ease-in-out infinite' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-green-400/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-green-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">Incoming call</p>
              <p className="text-white/50 text-xs">+1 (306) 555-0142</p>
            </div>
            <div className="ml-auto text-xs text-white/40 tabular-nums">0:34</div>
          </div>
          <div className="space-y-2">
            <div className="bg-white/10 rounded-lg px-3 py-2">
              <p className="text-white/80 text-xs">&quot;I&apos;d like to book an appointment for Thursday afternoon.&quot;</p>
            </div>
            <div className="bg-white/15 rounded-lg px-3 py-2 ml-8">
              <p className="text-white/90 text-xs">&quot;I have 2:00 PM and 3:30 PM available on Thursday. Which works better for you?&quot;</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: testimonial + stats */}
      <div className="relative z-10">
        {/* Testimonial */}
        <div className="mb-8" style={{ animation: 'testimonialIn 0.7s ease-out 0.5s both' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTestimonial}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              <blockquote className="text-white/90 text-sm leading-relaxed mb-4">
                &ldquo;{testimonials[activeTestimonial].quote}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
                  {testimonials[activeTestimonial].name[0]}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{testimonials[activeTestimonial].name}</p>
                  <p className="text-white/50 text-xs">{testimonials[activeTestimonial].role}, {testimonials[activeTestimonial].company}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div className="flex gap-1.5 mt-4">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTestimonial(i)}
                className="transition-all duration-300"
                style={{
                  width: i === activeTestimonial ? 24 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === activeTestimonial ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-8" style={{ animation: 'fadeSlideIn 0.6s ease-out 0.6s both' }}>
          {stats.map(stat => (
            <div key={stat.label}>
              <p className="text-white font-bold text-lg">{stat.value}</p>
              <p className="text-white/50 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   LOGIN FORM — right side
   ══════════════════════════════════════════════════════════════════════ */
function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showRecoveryHint, setShowRecoveryHint] = useState(false)
  const [isNewAccount, setIsNewAccount] = useState(false)
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
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
      setError('This link has expired or was already used.')
      setShowRecoveryHint(true)
    } else if (urlError === 'auth_callback_failed') {
      setError('Sign-in failed. Please try again or use a different method.')
    }
    const urlEmail = searchParams.get('email')
    if (urlEmail) {
      setEmail(decodeURIComponent(urlEmail))
      setIsNewAccount(true)
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

  async function handleMagicLink() {
    if (!email) { setError('Enter your email first, then click this link.'); return }
    setError('')
    setMagicLinkLoading(true)
    const { error: otpError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    setMagicLinkLoading(false)
    if (otpError) {
      setError(otpError.message)
    } else {
      setMagicLinkSent(true)
    }
  }

  // D44: Google OAuth — requires two redirect URIs in Google Console:
  // 1. https://unmissed-ai-production.up.railway.app/auth/callback
  // 2. Future custom domain /auth/callback
  // See memory/google-oauth-pattern.md
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
  }

  return (
    <div className="min-h-dvh bg-page flex">
      {/* ── Left: Showcase Panel (lg+) ── */}
      <div className="hidden lg:block w-1/2 p-4">
        <ShowcasePanel />
      </div>

      {/* ── Right: Sign-in Form ── */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-6 py-10 sm:px-12 relative lg:border-l" style={{ borderColor: 'var(--color-border-subtle)' }}>
        {/* Theme toggle — top right */}
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[400px]">

          {/* Mobile-only logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden" style={{ animation: 'fadeSlideIn 0.5s ease-out' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, var(--color-primary), #7c3aed)',
              boxShadow: '0 0 20px color-mix(in srgb, var(--color-primary) 30%, transparent)',
            }}>
              <PhoneIcon className="text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight t1">{BRAND_NAME}</span>
          </div>

          {/* Back link (desktop) */}
          <Link href="/" className="hidden lg:inline-flex items-center gap-1.5 text-xs t2 hover:t1 transition-colors mb-8">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            Back to {BRAND_NAME}
          </Link>

          {/* Form card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.05 }}
          >
            <h1 className="text-2xl font-bold t1 mb-1">Welcome back</h1>
            <p className="text-sm t3 mb-8">Sign in to your {BRAND_PRODUCT} dashboard</p>

            {/* Google OAuth — primary CTA */}
            <motion.button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 font-semibold text-sm rounded-xl py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-6 t1"
              style={{
                backgroundColor: 'var(--color-bg-raised)',
                border: '1px solid var(--color-border-strong)',
                boxShadow: 'var(--shadow-sm)',
                touchAction: 'manipulation',
              }}
              whileHover={{ scale: 1.01, boxShadow: 'var(--shadow-md)' }}
              whileTap={{ scale: 0.98 }}
            >
              <GoogleIcon />
              Continue with Google
            </motion.button>

            {/* Divider */}
            <div className="relative flex items-center gap-4 mb-6">
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
              <span className="text-xs font-medium t3">or continue with email</span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
            </div>

            {isNewAccount && (
              <div className="mb-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-300">
                Welcome! Your temporary password is <strong>QWERTY123</strong> — you can change it after logging in.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <GlassInput
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus={!isNewAccount}
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
                placeholder="you@company.com"
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium t3">Password</label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs t3 hover:t1 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  enterKeyHint="go"
                  placeholder="Enter your password"
                  className="w-full rounded-xl px-4 py-3 text-sm bg-input b-input border transition-all placeholder:t3 t1 focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]/25 focus:border-[var(--color-border-focus)]"
                />
              </div>

              <ErrorMessage error={error} />

              {showRecoveryHint && (
                <div className="text-center -mt-1">
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    Send me a new reset link &rarr;
                  </Link>
                </div>
              )}

              <motion.button
                type="submit"
                disabled={loading}
                className="w-full font-semibold text-sm rounded-xl py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary), #7c3aed)',
                  boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 35%, transparent)',
                  touchAction: 'manipulation',
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </motion.button>

              {magicLinkSent ? (
                <p className="text-center text-sm t2">Check your email — we sent a sign-in link.</p>
              ) : (
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={magicLinkLoading}
                  className="w-full text-sm t3 hover:t1 transition-colors text-center disabled:opacity-50"
                >
                  {magicLinkLoading ? 'Sending...' : 'Email me a sign-in link instead'}
                </button>
              )}
            </form>
          </motion.div>

          {/* Footer */}
          <p className="text-center text-xs t3 mt-8">{BRAND_NAME}</p>
        </div>
      </div>
    </div>
  )
}

/* ── Error banner ──────────────────────────────────────────────────── */
function ErrorMessage({ error }: { error: string }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-start gap-2 text-sm rounded-xl px-3.5 py-2.5"
          style={{
            backgroundColor: 'var(--color-error-tint)',
            border: '1px solid color-mix(in srgb, var(--color-error) 20%, transparent)',
            color: 'var(--color-error)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-page" />}>
      <LoginContent />
    </Suspense>
  )
}
