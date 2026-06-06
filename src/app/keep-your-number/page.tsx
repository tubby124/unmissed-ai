import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { BRAND_NAME, BRAND_DOMAIN } from '@/lib/brand'
import { BOOK_WALKTHROUGH_HREF } from '@/lib/booking'

export const metadata: Metadata = {
  title: `Keep Your Existing Phone Number — ${BRAND_NAME}`,
  description: `Your customers still call YOUR number. End Voicemail answers behind the scenes when you don't pick up, and our number does not show on their screen.`,
  alternates: { canonical: `https://${BRAND_DOMAIN}/keep-your-number` },
  openGraph: {
    title: `Keep Your Existing Phone Number — ${BRAND_NAME}`,
    description: `Your customers call your number. We answer when you can't. They never see ours.`,
  },
}

export default function KeepYourNumberPage() {
  return (
    <>
      <Navbar />
      <main style={{ backgroundColor: 'var(--color-bg)' }}>
        {/* Hero */}
        <section className="pt-32 pb-16 px-4 text-center" style={{ backgroundColor: '#0a0a0a' }}>
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--color-primary)' }}>
              The most common question
            </p>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-5">
              Yes, you keep your phone number.
            </h1>
            <p className="text-gray-400 text-xl leading-relaxed">
              Your customers dial your business number. {BRAND_NAME} only picks up when you don&apos;t.
              They still call your normal number, and our number does not show on their screen.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto space-y-10">
            <div>
              <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text-1)' }}>How it works</h2>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>1</span>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text-1)' }}>Customer calls your number</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-3)' }}>They dial the same number on your business card, website, Google listing — exactly like before.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>2</span>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text-1)' }}>Your phone rings first</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-3)' }}>Always. You decide whether to pick up. If you do, the AI isn&apos;t involved at all — it&apos;s your customer talking to you.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>3</span>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text-1)' }}>If you don&apos;t pick up, the AI answers</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-3)' }}>Conditional call forwarding kicks in after 4-6 rings. The agent introduces itself with YOUR business name. The caller never sees our number on their screen.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>4</span>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text-1)' }}>You get a call summary</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-3)' }}>Caller name, phone, what they need, and who to call back first. Email is the default; Telegram can be connected for faster phone pings.</p>
                  </div>
                </li>
              </ol>
            </div>

            {/* What changes vs what stays the same */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--color-text-1)' }}>What stays the same</h3>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-2)' }}>
                  <li>• Your business number on every marketing surface</li>
                  <li>• Caller ID when you call them back</li>
                  <li>• Your existing carrier and plan</li>
                  <li>• How customers reach you</li>
                </ul>
              </div>
              <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--color-text-1)' }}>What&apos;s new</h3>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-2)' }}>
                  <li>• Calls get answered when you can&apos;t</li>
                  <li>• Email summaries, with Telegram optional for faster alerts</li>
                  <li>• A dashboard of every conversation</li>
                  <li>• One-tap call-back on hot leads</li>
                </ul>
              </div>
            </div>

            {/* Carrier note */}
            <div className="rounded-2xl p-6" style={{ backgroundColor: '#0D1F0D', border: '1px solid #166534' }}>
              <h3 className="text-lg font-bold mb-2 text-green-400">One catch: carrier voicemail must be removed first</h3>
              <p className="text-sm text-green-200/80 leading-relaxed">
                Conditional call forwarding and carrier voicemail share the same network slot.
                If your line has voicemail (Rogers, Bell, Telus, Fido — any plan), you&apos;ll need to
                call your carrier and ask them to remove it from your line profile.
                It&apos;s a 5-minute call. We give you the script + the support number during setup.
                For iPhone users on Visual Voicemail, both the base voicemail and VVM service need
                to be removed.
              </p>
            </div>

            {/* CTA */}
            <div className="text-center pt-8">
              <a
                href={BOOK_WALKTHROUGH_HREF}
                className="inline-block px-8 py-4 rounded-xl text-white font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Book a walkthrough →
              </a>
              <p className="text-xs mt-3" style={{ color: 'var(--color-text-3)' }}>
                50 activation minutes included · Card required to activate your number · Cancel anytime
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
