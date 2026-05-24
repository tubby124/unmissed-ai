import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Bell, CheckCircle2, Clock3, MessageSquareText, PhoneCall, ShieldCheck, Sparkles, Wrench } from "lucide-react"
import CallMeNowWidget from "@/components/CallMeNowWidget"
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb"
import { BRAND_DOMAIN, BRAND_NAME } from "@/lib/brand"

export const metadata: Metadata = {
  title: `AI Receptionist for Auto Glass Shops — ${BRAND_NAME}`,
  description:
    "Stop losing windshield jobs to voicemail. End Voicemail answers missed auto-glass calls, captures vehicle details, and sends clean lead summaries.",
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/for-auto-glass`,
  },
  openGraph: {
    title: `AI Receptionist for Auto Glass Shops — ${BRAND_NAME}`,
    description:
      "AI agent answers missed auto-glass calls, collects vehicle details and ADAS requirements, and sends instant summaries.",
  },
}

const triage = [
  "Repair or full windshield replacement",
  "Year, make, model, and glass details",
  "ADAS / lane-assist calibration flag",
  "Cash vs insurance and urgency",
  "Best callback window for the owner",
]

const alerts = [
  { label: "Lead status", value: "HOT quote request" },
  { label: "Vehicle", value: "2021 Toyota RAV4" },
  { label: "Need", value: "Cracked windshield + calibration" },
  { label: "Next step", value: "Call back before 3 PM" },
]

const steps = [
  {
    title: "You keep your number",
    body: "No porting circus. Missed, busy, and after-hours calls forward into your AI line.",
  },
  {
    title: "The AI triages the caller",
    body: "It collects the stuff your estimator actually needs instead of dumping people into voicemail.",
  },
  {
    title: "You get the clean summary",
    body: "Hot leads, junk, callback notes, and vehicle details land where your team can act on them.",
  },
]

export default function ForAutoGlassPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#030711] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[130px]" />
        <div className="absolute right-[-120px] top-[220px] h-[360px] w-[360px] rounded-full bg-cyan-500/10 blur-[110px]" />
        <div className="absolute bottom-[-140px] left-[-120px] h-[420px] w-[420px] rounded-full bg-emerald-300/10 blur-[120px]" />
      </div>

      <section className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pb-28 lg:pt-14">
        <nav className="col-span-full flex items-center justify-between rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
              <PhoneCall size={17} />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">End Voicemail</p>
              <p className="text-xs text-white/45">Built for auto-glass shops</p>
            </div>
          </div>
          <Link href="/onboard?niche=auto_glass" className="hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100 sm:flex">
            Start free month <ArrowRight size={15} />
          </Link>
        </nav>

        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-sm text-emerald-100">
            <Sparkles size={15} />
            Live demo: the AI can call you by name
          </div>

          <h1 className="max-w-3xl text-5xl font-black leading-[0.94] tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
            Stop losing windshield jobs to voicemail.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68 sm:text-xl">
            When your team is installing, driving, or closed, End Voicemail answers the call, captures vehicle details, filters junk, and sends you the lead summary before the customer calls the next shop.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["First month", "Free"],
              ["After that", "$120/mo"],
              ["Included", "250 min"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/38">{label}</p>
                <p className="mt-1 text-2xl font-black tracking-tight text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-emerald-300/20 bg-slate-950/80 p-4 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Try the outbound demo</p>
                <p className="text-xs text-white/45">Name + phone required. Email is optional for the summary.</p>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">Calls you now</span>
            </div>
            <CallMeNowWidget
              niche="auto_glass"
              compact
              collectName
              collectEmail
              collectShopName
              collectPain
              variant="windshield"
            />
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-emerald-400/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#07101d]/92 p-5 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 overflow-hidden rounded-2xl bg-emerald-300/10">
                  <VoicePoweredOrb externalEnergy={0.36} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                    <p className="text-sm font-bold text-emerald-200">LIVE CALL</p>
                  </div>
                  <p className="text-lg font-black tracking-tight">Windshield Hub AI</p>
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55">00:41</div>
            </div>

            <div className="space-y-3">
              <div className="mr-10 rounded-2xl rounded-tl-md bg-white/[0.06] p-4 text-sm leading-6 text-white/76">
                Hey Ashley, this is the auto-glass demo you requested. Want me to show you how we’d handle a cracked-windshield caller?
              </div>
              <div className="ml-10 rounded-2xl rounded-tr-md bg-emerald-400 p-4 text-sm font-semibold leading-6 text-slate-950">
                Yeah, show me what the caller experience is like.
              </div>
              <div className="mr-8 rounded-2xl rounded-tl-md bg-white/[0.06] p-4 text-sm leading-6 text-white/76">
                Perfect. I’ll run it like a real call: damage type, vehicle, calibration, urgency, then I’ll show the owner summary.
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-emerald-300/15 bg-emerald-300/[0.07] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-100">
                <Bell size={16} /> Owner alert preview
              </div>
              <div className="grid gap-2">
                {alerts.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 rounded-2xl bg-black/20 px-3 py-2">
                    <span className="text-xs text-white/44">{item.label}</span>
                    <span className="text-right text-sm font-semibold text-white/88">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-12 items-end gap-1.5 rounded-3xl border border-white/10 bg-black/20 p-4">
              {[24, 42, 28, 68, 90, 56, 74, 36, 82, 52, 32, 64, 88, 48, 70, 38, 58, 30].map((height, index) => (
                <div key={index} className="rounded-full bg-gradient-to-t from-emerald-500 to-cyan-200" style={{ height: `${height}px` }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-200">{index + 1}</div>
              <h2 className="text-xl font-black tracking-tight">{step.title}</h2>
              <p className="mt-3 leading-7 text-white/58">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto grid max-w-7xl gap-8 px-5 pb-24 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/60">
            <Wrench size={15} /> Built around real auto-glass intake
          </div>
          <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">The agent asks like a trained front desk.</h2>
          <p className="mt-5 text-lg leading-8 text-white/62">
            This is not generic “AI receptionist” mush. The call flow is built to catch the details that matter before your estimator calls back.
          </p>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div className="grid gap-3">
            {triage.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-4">
                <CheckCircle2 className="shrink-0 text-emerald-300" size={19} />
                <span className="text-white/74">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 pb-28 sm:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-gradient-to-br from-emerald-400/16 to-cyan-400/8 p-6 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <div className="mb-4 flex items-center gap-2 text-emerald-100">
                <ShieldCheck size={18} />
                <span className="text-sm font-bold uppercase tracking-[0.2em]">Concierge setup</span>
              </div>
              <h2 className="text-4xl font-black tracking-[-0.04em] sm:text-5xl">Go live without breaking your phones.</h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/68">
                After signup, we watch the first calls closely, tune the agent, confirm forwarding, and back off once it’s stable. You get the wow moment without babysitting the system.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
              {[
                [Clock3, "Days 1–3", "Every real call + failures watched"],
                [MessageSquareText, "Days 4–7", "Hot/warm leads + weird calls only"],
                [Bell, "After stable", "Normal alerts, ops only sees drift"],
              ].map(([Icon, label, body]) => {
                const LucideIcon = Icon as typeof Clock3
                return (
                  <div key={label as string} className="flex gap-3 border-b border-white/10 py-4 last:border-0">
                    <LucideIcon className="mt-1 shrink-0 text-emerald-300" size={18} />
                    <div>
                      <p className="font-bold">{label as string}</p>
                      <p className="text-sm leading-6 text-white/54">{body as string}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
