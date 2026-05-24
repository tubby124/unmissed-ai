import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Bell, CheckCircle2, MessageSquareText, PhoneCall, ShieldCheck, Sparkles, Wrench } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import CallMeNowWidget from "@/components/CallMeNowWidget"
import HeroCallMockup from "@/components/HeroCallMockup"
import { BRAND_DOMAIN, BRAND_NAME } from "@/lib/brand"

export const metadata: Metadata = {
  title: `AI Receptionist for Auto Glass Shops — ${BRAND_NAME}`,
  description:
    "A live AI receptionist demo for windshield and auto-glass shops. Enter your number, get the call, hear the triage flow, and see how missed calls become quote-ready leads.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-auto-glass`,
  },
  openGraph: {
    title: `AI Receptionist for Auto Glass Shops — ${BRAND_NAME}`,
    description:
      "Stop losing windshield jobs to voicemail. The AI answers, captures vehicle details, sends a text, and gives the shop owner a clean callback summary.",
  },
}

const triage = [
  "Repair vs. replacement",
  "Year, make, model, and glass location",
  "ADAS / lane-assist calibration flag",
  "Insurance vs. cash and urgency",
  "Best callback window",
]

const flow = [
  {
    title: "Email gets the click",
    body: "The shop owner lands here from a simple windshield-focused email — no long form, no sales maze.",
  },
  {
    title: "They enter name + number",
    body: "The AI calls them immediately and proves the experience instead of making them read a SaaS pitch.",
  },
  {
    title: "Aisha runs the demo",
    body: "She greets them by name, simulates a real windshield caller, then explains the owner summary they would receive.",
  },
  {
    title: "Text + onboarding handoff",
    body: "If they like it, the agent can text the next step and push them toward setup while the excitement is still fresh.",
  },
]

const ownerSummary = [
  ["Lead", "HOT windshield quote"],
  ["Vehicle", "2021 Toyota RAV4"],
  ["Need", "Cracked windshield + calibration"],
  ["Next step", "Call back before 3 PM"],
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
                <Sparkles size={14} /> Windshield shop demo
              </div>

              <h1 className="mx-auto max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.045em] sm:text-5xl lg:mx-0 lg:text-[3.65rem]">
                Your missed windshield calls should turn into quote-ready leads.
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-base leading-7 sm:text-lg lg:mx-0" style={{ color: "var(--color-text-2)" }}>
                Send an auto-glass owner here from an email. They enter their name and phone, Aisha calls them, runs a real windshield-call demo, then can text the next step while the call is still hot.
              </p>

              <div className="mx-auto mt-7 max-w-md rounded-2xl border p-4 shadow-sm lg:mx-0" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                <div className="mb-3 flex items-start justify-between gap-3 text-left">
                  <div>
                    <p className="text-sm font-bold">Try the windshield AI call</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--color-text-3)" }}>
                      Just name + phone. The demo does the selling.
                    </p>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-primary)" }}>
                    Calls now
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
                  Conversion flow
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">The page is the trapdoor. The phone call is the demo.</h2>
              </div>
              <Link href="/onboard?niche=auto_glass" className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white" style={{ backgroundColor: "var(--color-primary)" }}>
                Start setup <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {flow.map((item, index) => (
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
              <h2 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">Aisha asks like a trained front desk — not a generic bot.</h2>
              <p className="mt-4 leading-7" style={{ color: "var(--color-text-2)" }}>
                The point is not to ask the prospect for a pile of fields on the website. The call collects the useful stuff naturally and proves what their own customers would experience.
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
                    <p className="font-bold">Owner summary preview</p>
                    <p className="text-xs" style={{ color: "var(--color-text-3)" }}>What the shop gets after the call</p>
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
                  <MessageSquareText size={16} style={{ color: "var(--color-primary)" }} /> SMS during the call
                </div>
                <p className="text-sm leading-6" style={{ color: "var(--color-text-2)" }}>
                  If they ask for the next step, Aisha can text the setup link from the demo flow. That turns “cool demo” into “let’s onboard” before they wander off.
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
                  <ShieldCheck size={17} /> Concierge setup
                </div>
                <h2 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">We watch the first calls, tune it, then back off.</h2>
                <p className="mt-4 leading-7" style={{ color: "var(--color-text-2)" }}>
                  After payment and forwarding verification, the first week is a watch window: every real call gets checked early, weird calls get flagged, and once stable the client just gets normal lead alerts.
                </p>
              </div>
              <div className="grid gap-2 text-sm">
                {[
                  ["Days 1–3", "Watch every real call + failures"],
                  ["Days 4–7", "Only hot/warm/weird calls"],
                  ["After stable", "Normal alerts; ops sees drift only"],
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
