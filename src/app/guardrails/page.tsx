import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { BRAND_NAME, BRAND_DOMAIN } from '@/lib/brand'

export const metadata: Metadata = {
  title: `What Your AI Agent Won't Do — ${BRAND_NAME} Guardrails`,
  description: `Your agent only says what you trained it on. It can't make pricing promises, won't make up information, and every call is logged and reviewable.`,
  alternates: { canonical: `https://${BRAND_DOMAIN}/guardrails` },
  openGraph: {
    title: `What Your AI Agent Won't Do — ${BRAND_NAME}`,
    description: `Trained on your info. Logs every call. Never makes up a price or a promise.`,
  },
}

interface GuardRail {
  title: string
  body: string
}

const RAILS: GuardRail[] = [
  {
    title: `It only says what you told it`,
    body: `The agent is trained on your services, hours, pricing, and policies — pulled from your Google Business Profile, website, and the onboarding questions you answered. If a caller asks something outside that scope, it politely says "let me have them call you back" instead of guessing.`,
  },
  {
    title: `It never makes up prices`,
    body: `If you didn't publish a price for a service, the agent won't quote one. It says "I'll have them confirm pricing when they call you back" and flags it as a knowledge gap in your weekly review so you can fill it in if you want.`,
  },
  {
    title: `It doesn't make promises you can't keep`,
    body: `No "yes we can fit you in tomorrow" unless you've connected your calendar and have an open slot. No "absolutely we cover that area" unless you listed the city in your service area. Promises are bounded by what you configured.`,
  },
  {
    title: `Every call is recorded and reviewable`,
    body: `You get the audio recording, the transcript, and the AI's summary in your dashboard within 30 seconds of the call ending. If anything sounded off, you can listen back and update the agent's knowledge in one click.`,
  },
  {
    title: `It learns from your calls — but you approve every change`,
    body: `When the agent notices a pattern (5+ callers asking about a service you haven't listed, for example), it surfaces a suggestion in your weekly review. You approve or dismiss. Nothing changes the agent's behavior without your sign-off.`,
  },
  {
    title: `It tells callers it's an AI assistant — if they ask`,
    body: `The agent doesn't pretend to be a human. If a caller asks "am I talking to a person?", the agent says "I'm an AI assistant for [your business name]." Most callers don't ask. Of the ones who do, most don't care — they care about getting their question answered.`,
  },
  {
    title: `It can transfer to you (on the right plan)`,
    body: `If a caller insists on a human, or hits a transfer keyword you set ("emergency", "complaint", "press 0"), the agent transfers the call to your phone. Available on the AI Receptionist plan ($40/mo).`,
  },
  {
    title: `It hangs up on abuse and spam`,
    body: `Robocalls, abusive callers, or anyone trying to manipulate the agent — it politely disengages and logs the attempt. You don't pay minutes for caught spam.`,
  },
]

export default function GuardrailsPage() {
  return (
    <>
      <Navbar />
      <main style={{ backgroundColor: 'var(--color-bg)' }}>
        {/* Hero */}
        <section className="pt-32 pb-16 px-4 text-center" style={{ backgroundColor: '#0a0a0a' }}>
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--color-primary)' }}>
              Guardrails
            </p>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-5">
              What your AI agent won&apos;t do.
            </h1>
            <p className="text-gray-400 text-xl leading-relaxed">
              An AI receptionist is only useful if you trust it on the phone with your customers.
              Here&apos;s exactly how we keep it bounded.
            </p>
          </div>
        </section>

        {/* Guardrail list */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto space-y-5">
            {RAILS.map((r, i) => (
              <div
                key={i}
                className="rounded-2xl p-6"
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex items-start gap-4">
                  <span
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-1)' }}>{r.title}</h2>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-2)' }}>{r.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="pb-20 px-4 text-center">
          <Link
            href="/onboard"
            className="inline-block px-8 py-4 rounded-xl text-white font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Try your agent free for 7 days →
          </Link>
          <p className="text-xs mt-3" style={{ color: 'var(--color-text-3)' }}>
            Listen to every call. Approve every change. Cancel anytime.
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}
