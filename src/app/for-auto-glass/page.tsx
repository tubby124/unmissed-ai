import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Bell, CheckCircle2, MessageSquareText, ShieldCheck, Sparkles, Wrench } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import CallMeNowWidget from "@/components/CallMeNowWidget"
import HeroCallMockup from "@/components/HeroCallMockup"
import { BRAND_DOMAIN, BRAND_NAME } from "@/lib/brand"

export const metadata: Metadata = {
  title: `AI Receptionist for Auto Glass Shops — ${BRAND_NAME}`,
  description:
    "End Voicemail answers missed, busy, and after-hours calls for windshield and auto-glass shops, captures quote details, and sends the owner a clean lead summary.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-auto-glass`,
  },
  openGraph: {
    title: `AI Receptionist for Auto Glass Shops — ${BRAND_NAME}`,
    description:
      "Stop losing windshield jobs to voicemail. End Voicemail captures vehicle details, urgency, insurance/cash status, and the best callback window.",
  },
}

const triage = [
  "Repair or replacement",
  "Vehicle year, make, model, and glass location",
  "ADAS / lane-assist calibration needs",
  "Insurance or cash-pay status",
  "Urgency and best callback window",
]

const benefits = [
  {
    title: "Answers when your team can’t",
    body: "Busy installing glass, driving, closed for the night, or already on another call? The AI answers so the customer does not call the next shop.",
  },
  {
    title: "Captures quote-ready details",
    body: "It asks for the vehicle, glass issue, calibration flags, insurance/cash status, urgency, and callback window — the details your team needs before quoting.",
  },
  {
    title: "Sends you the clean summary",
    body: "You get the lead details in plain English, with the hot ones clearly marked so you know who needs a callback first.",
  },
  {
    title: "Works with your existing number",
    body: "You keep your business phone number. Missed, busy, and after-hours calls forward to End Voicemail. No porting, app, or new phone system required.",
  },
]

const ownerSummary = [
  ["Lead type", "Windshield replacement quote"],
  ["Vehicle", "2021 Toyota RAV4"],
  ["Details", "Cracked windshield + calibration likely"],
  ["Callback", "Today before 3 PM"],
]

export default function ForAutoGlassPage() {
  return (
    <>
      <Navbar />
      <main style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text-1)" }}>
        <section className="relative overflow-hidden px-4 pb-14 pt-28 sm:pb-18 sm:pt-32 lg:pb-20">
          <div
            className="pointer-events-none absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl sm:h-[34rem] sm:w-[34rem]"
            style={{ background: "radial-gradient(circle, rgba(34,197,94,0.16), transparent 68%)" }}
          />

          <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
            <div className="text-center lg:text-left">
              <div
                className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] lg:mx-0"
                style={{ color: "var(--color-primary)", borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}
              >
                <Sparkles size={14} /> AI receptionist for auto glass
              </div>

              <h1 className="mx-auto max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.045em] sm:text-5xl lg:mx-0 lg:text-[3.65rem]">
                Stop losing windshield jobs when nobody answers the phone.
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-base leading-7 sm:text-lg lg:mx-0" style={{ color: "var(--color-text-2)" }}>
                End Voicemail answers missed, busy, and after-hours calls for auto-glass shops. It collects the vehicle details, flags urgent jobs, and sends you a clean callback summary so your team can quote faster.
              </p>

              <div className="mx-auto mt-7 max-w-md rounded-2xl border p-4 shadow-sm lg:mx-0" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                <div className="mb-3 flex items-start justify-between gap-3 text-left">
                  <div>
                    <p className="text-sm font-bold">Hear how your missed calls would sound</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--color-text-3)" }}>
                      Enter your name and phone. The AI calls you with a short auto-glass demo.
                    </p>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-primary)" }}>
                    Instant demo
                  </span>
                </div>
                <CallMeNowWidget
                  niche="auto_glass"
                  compact
                  collectName
                  variant="windshield"
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs lg:justify-start" style={{ color: "var(--color-text-3)" }}>
                <span>First month free</span>
                <span>•</span>
                <span>$119/mo after</span>
                <span>•</span>
                <span>250 minutes included</span>
              </div>
            </div>

            <div className="mx-auto w-full max-w-sm lg:max-w-md">
              <HeroCallMockup />
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 sm:pb-18">
          <div className="mx-auto max-w-6xl rounded-3xl border p-5 sm:p-7 lg:p-8" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>
                  What it does
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">A receptionist that knows auto-glass calls.</h2>
              </div>
              <Link href="/onboard?niche=auto_glass" className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white" style={{ backgroundColor: "var(--color-primary)" }}>
                Start setup <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map((item, index) => (
                <div key={item.title} className="rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg)" }}>
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black" style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-primary)" }}>
                    {index + 1}
                  </div>
                  <h3 className="font-bold tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: "var(--color-text-2)" }}>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 sm:pb-20">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="rounded-3xl border p-5 sm:p-7" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold" style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-primary)" }}>
                <Wrench size={15} /> Auto-glass intake
              </div>
              <h2 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">The AI asks the same questions your front desk would.</h2>
              <p className="mt-4 leading-7" style={{ color: "var(--color-text-2)" }}>
                Instead of a blank voicemail, you get the details that matter for a windshield quote. The caller gets a helpful conversation, and your team gets a cleaner handoff.
              </p>
              <div className="mt-5 grid gap-2">
                {triage.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg)" }}>
                    <CheckCircle2 className="shrink-0" style={{ color: "var(--color-primary)" }} size={18} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border p-5 sm:p-7" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-primary)" }}>
                    <Bell size={19} />
                  </div>
                  <div>
                    <p className="font-bold">Lead summary preview</p>
                    <p className="text-xs" style={{ color: "var(--color-text-3)" }}>What you receive after the call</p>
                  </div>
                </div>
                <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-500">HOT</span>
              </div>

              <div className="space-y-2">
                {ownerSummary.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 rounded-xl border px-3 py-3" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg)" }}>
                    <span className="text-xs" style={{ color: "var(--color-text-3)" }}>{label}</span>
                    <span className="text-right text-sm font-semibold">{value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg)" }}>
                <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <MessageSquareText size={16} style={{ color: "var(--color-primary)" }} /> Text follow-up available
                </div>
                <p className="text-sm leading-6" style={{ color: "var(--color-text-2)" }}>
                  If a caller needs a link, appointment details, or next-step instructions, End Voicemail can send a text while the call is fresh.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-20">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border p-6 sm:p-8" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
            <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 text-sm font-bold" style={{ color: "var(--color-primary)" }}>
                  <ShieldCheck size={17} /> Simple setup
                </div>
                <h2 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">Keep your number. Forward the calls you miss.</h2>
                <p className="mt-4 leading-7" style={{ color: "var(--color-text-2)" }}>
                  You do not need to port your number or replace your phone system. Forward missed, busy, or after-hours calls to End Voicemail, test the call path, and start receiving lead summaries.
                </p>
              </div>
              <div className="grid gap-2 text-sm">
                {[
                  ["Step 1", "Build the AI from your shop details"],
                  ["Step 2", "Forward missed, busy, or after-hours calls"],
                  ["Step 3", "Receive clean lead summaries after each call"],
                ].map(([label, body]) => (
                  <div key={label} className="rounded-xl border p-4" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg)" }}>
                    <p className="font-bold">{label}</p>
                    <p className="mt-1" style={{ color: "var(--color-text-2)" }}>{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
