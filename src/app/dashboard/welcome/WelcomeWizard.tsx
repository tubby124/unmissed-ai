'use client'

/**
 * D88 — Post-upgrade welcome wizard.
 * Shown once after Stripe checkout completes for newly activated clients.
 * 3 steps: assigned number → forwarding instructions → test call.
 * Dismisses to /dashboard.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  twilioNumber: string
  agentName: string
  selectedPlan: string
}

type Carrier = 'mobile' | 'rogers' | 'bell' | 'telus' | 'sasktel' | 'other'

const CARRIER_LABELS: Record<Carrier, string> = {
  mobile: 'Mobile (Rogers, Bell, Telus, etc.)',
  rogers: 'Rogers / Shaw Business (landline)',
  bell: 'Bell Business (landline)',
  telus: 'Telus Business (landline)',
  sasktel: 'SaskTel IBC (landline)',
  other: 'Other / I\'ll call my carrier',
}

function fmtNumber(raw: string) {
  // +1XXXXXXXXXX → (XXX) XXX-XXXX
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw
}

function ForwardingInstructions({ carrier, number }: { carrier: Carrier; number: string }) {
  const num = number.replace(/\D/g, '')
  const dialNum = num.length === 11 ? num.slice(1) : num // drop leading 1 for star codes

  if (carrier === 'mobile') {
    return (
      <div className="space-y-3">
        <p className="text-xs t3 leading-relaxed">
          Dial these codes from your mobile phone to forward unanswered and busy calls to your agent:
        </p>
        <div className="space-y-2">
          <CodeRow label="No answer forward" code={`*61*+1${dialNum}#`} />
          <CodeRow label="Busy forward" code={`*67*+1${dialNum}#`} />
          <CodeRow label="Unreachable forward" code={`*62*+1${dialNum}#`} />
        </div>
        <p className="text-[10px] t3 leading-relaxed">
          Dial each code, press Call, wait for confirmation tone, hang up. To undo: <span className="font-mono">##002#</span>
        </p>
      </div>
    )
  }

  if (carrier === 'rogers' || carrier === 'bell' || carrier === 'sasktel') {
    return (
      <div className="space-y-3">
        <p className="text-xs t3 leading-relaxed">
          From your business landline, dial these codes to forward calls to your agent:
        </p>
        <div className="space-y-2">
          <CodeRow label="No answer forward" code={`*92 ${dialNum}`} />
          <CodeRow label="Busy forward" code={`*90 ${dialNum}`} />
          <CodeRow label="All calls forward" code={`*72 ${dialNum}`} />
        </div>
        <p className="text-[10px] t3 leading-relaxed">
          Pick up receiver → dial code + number → wait for confirmation tone → hang up. To deactivate: <span className="font-mono">*93</span> (no answer) or <span className="font-mono">*73</span> (all calls).
        </p>
      </div>
    )
  }

  if (carrier === 'telus') {
    return (
      <div className="space-y-3">
        <p className="text-xs t3 leading-relaxed">
          From your Telus business landline, dial this code to forward unanswered calls:
        </p>
        <div className="space-y-2">
          <CodeRow label="No answer / all calls" code={`*72 ${dialNum}`} />
        </div>
        <p className="text-[10px] t3 leading-relaxed">
          Important: the destination phone (your agent) must answer when you set this up to confirm activation. To deactivate: <span className="font-mono">*73</span>. If <span className="font-mono">*72</span> fails, try <span className="font-mono">#72</span> or call Telus Business at 1-866-771-9666.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs t3 leading-relaxed">
        Call your carrier and ask them to enable <strong className="t2">Call Forward No Answer</strong> to:
      </p>
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border b-theme bg-hover font-mono text-sm t1">
        {number}
      </div>
      <p className="text-[10px] t3">Most carriers can set this up in under 5 minutes over the phone.</p>
    </div>
  )
}

function CodeRow({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border b-theme bg-hover">
      <span className="text-[11px] t3 shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-xs t1 truncate">{code}</span>
        <button
          onClick={copy}
          className="shrink-0 text-[10px] px-2 py-0.5 rounded border b-theme t3 hover:t1 hover:bg-surface transition-colors"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export default function WelcomeWizard({ twilioNumber, agentName, selectedPlan }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [carrier, setCarrier] = useState<Carrier>('mobile')

  const formatted = fmtNumber(twilioNumber)
  const planLabel = selectedPlan === 'pro' ? 'Pro' : selectedPlan === 'core' ? 'Core' : 'Lite'

  function finish() {
    router.push('/dashboard')
  }

  const steps = [
    {
      title: `Your agent is live`,
      subtitle: `${agentName} is ready to answer calls on the ${planLabel} plan.`,
    },
    {
      title: 'Forward your business number',
      subtitle: 'Route unanswered calls from your existing number to your agent.',
    },
    {
      title: 'Test it now',
      subtitle: `Call your agent's number from any phone to hear it in action.`,
    },
  ]

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)', opacity: 0.9 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.72A2 2 0 012 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold t1 mb-1">Welcome to unmissed</h1>
          <p className="text-sm t3">3 quick steps to get every call covered</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8' : 'w-2'}`}
              style={{ backgroundColor: i <= step ? 'var(--color-primary)' : 'var(--color-hover)' }} />
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border b-theme bg-surface p-6">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">
            Step {step + 1} of {steps.length}
          </p>
          <h2 className="text-lg font-semibold t1 mb-1">{steps[step].title}</h2>
          <p className="text-xs t3 mb-5">{steps[step].subtitle}</p>

          {/* Step 0 — your assigned number */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="rounded-xl border b-theme bg-hover px-4 py-3">
                <p className="text-[10px] font-medium t3 uppercase tracking-widest mb-1">Your agent's number</p>
                <p className="text-2xl font-bold t1 tracking-tight font-mono">{formatted}</p>
              </div>
              <p className="text-xs t3 leading-relaxed">
                This is the phone number assigned to {agentName}. Callers who dial this number will reach your AI agent immediately. Save it — you'll forward your business line to it in the next step.
              </p>
            </div>
          )}

          {/* Step 1 — forwarding */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-2">
                  Your current phone carrier
                </label>
                <select
                  value={carrier}
                  onChange={e => setCarrier(e.target.value as Carrier)}
                  className="w-full px-3 py-2.5 rounded-xl border b-theme bg-hover text-xs t1 focus:outline-none"
                >
                  {(Object.entries(CARRIER_LABELS) as [Carrier, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <ForwardingInstructions carrier={carrier} number={twilioNumber} />
              <p className="text-[10px] t3">You can skip this for now and set it up later from Settings → Setup.</p>
            </div>
          )}

          {/* Step 2 — test it */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl border b-theme bg-hover px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-primary)', opacity: 0.15 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.72A2 2 0 012 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] t3 font-medium">Call this number now</p>
                  <p className="text-base font-bold t1 font-mono">{formatted}</p>
                </div>
              </div>
              <p className="text-xs t3 leading-relaxed">
                Pick up any phone and call {formatted}. {agentName} will answer and walk you through a real conversation. You can also test it any time from your dashboard.
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-2 mt-6">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium t2 border b-theme hover:bg-hover transition-colors"
              >
                Back
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {step === 1 ? 'I\'ve set up forwarding' : 'Next'}
              </button>
            ) : (
              <button
                onClick={finish}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Go to dashboard →
              </button>
            )}
          </div>
        </div>

        {/* Skip */}
        <p className="text-center mt-4">
          <button onClick={finish} className="text-[11px] t3 hover:t2 underline underline-offset-2">
            Skip setup — go to dashboard
          </button>
        </p>
      </div>
    </div>
  )
}
