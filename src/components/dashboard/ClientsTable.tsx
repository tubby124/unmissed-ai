'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Intake {
  id: string
  submitted_at: string
  status: string
  progress_status: string | null
  business_name: string
  niche: string | null
  client_id: string | null
  intake_json: Record<string, unknown> | null
  owner_name: string | null
  contact_email: string | null
}

interface ActivationLog {
  activated_at: string
  stripe_session_id: string
  stripe_amount: number | null
  twilio_number_bought: string | null
  telegram_link: string | null
  contact_email: string | null
  callback_phone: string | null
  sms_sent: boolean
  sms_skip_reason: string | null
  email_sent: boolean
  email_skip_reason: string | null
  intake_id: string
}

interface Client {
  id: string
  slug: string
  business_name: string
  twilio_number: string | null
  activation_log: ActivationLog | null
}

const STATUS_COLORS: Record<string, string> = {
  provisioned: 'text-green-400 bg-green-500/10 border-green-500/20',
  activated: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  failed: 'text-red-400 bg-red-500/10 border-red-500/20',
}

function IntakeRow({ intake, onCreateAccount, onGeneratePrompt, onActivate }: {
  intake: Intake
  onCreateAccount: (intake: Intake) => void
  onGeneratePrompt: (intake: Intake) => void
  onActivate: (intake: Intake) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const date = new Date(intake.submitted_at).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
  const statusLabel = intake.progress_status || intake.status
  const statusColor = STATUS_COLORS[statusLabel] || STATUS_COLORS.pending
  const hasAccount = !!intake.client_id
  const isProvisioned = intake.status === 'provisioned'
  const isActivated = intake.progress_status === 'activated'

  return (
    <>
      <tr
        className="border-b hover:bg-[var(--color-hover)] cursor-pointer transition-colors"
        style={{ borderColor: "var(--color-border)" }}
        onClick={() => setExpanded(v => !v)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <span className="text-blue-400 text-xs font-bold">
                {intake.business_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-1)" }}>{intake.business_name}</p>
              <p className="text-xs capitalize" style={{ color: "var(--color-text-3)" }}>{intake.niche?.replace(/_/g, ' ') || '—'}</p>
              {intake.owner_name && (
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-2)" }}>{intake.owner_name}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-2)" }}>
          {intake.contact_email
            ? <a href={`mailto:${intake.contact_email}`} className="transition-colors" style={{ color: "var(--color-text-2)" }} onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-1)")} onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-2)")} onClick={e => e.stopPropagation()}>{intake.contact_email}</a>
            : <span style={{ color: "var(--color-text-3)" }}>—</span>
          }
        </td>
        <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-3)" }}>{date}</td>
        <td className="px-4 py-3">
          <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${statusColor}`}>
            {statusLabel}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1.5">
            {!isProvisioned && !isActivated && (
              <button
                onClick={e => { e.stopPropagation(); onGeneratePrompt(intake) }}
                className="text-[10px] font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg px-3 py-1 transition-colors"
              >
                Generate prompt
              </button>
            )}
            {isProvisioned && !isActivated && intake.client_id && (
              <button
                onClick={e => { e.stopPropagation(); onActivate(intake) }}
                className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg px-3 py-1 transition-colors"
              >
                Activate ($20)
              </button>
            )}
            {isActivated && (
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 text-center">
                Live
              </span>
            )}
            {hasAccount ? (
              <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5 text-center">
                Account linked
              </span>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); onCreateAccount(intake) }}
                className="text-[10px] font-medium hover:bg-[var(--color-hover)] border rounded-lg px-3 py-1 transition-colors"
                style={{ color: "var(--color-text-2)", backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                Create account
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3" style={{ color: "var(--color-text-3)" }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </td>
      </tr>
      {expanded && intake.intake_json && (
        <tr className="border-b" style={{ borderColor: "var(--color-border)" }}>
          <td colSpan={6} className="px-4 py-4" style={{ backgroundColor: "var(--color-surface)" }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {Object.entries(intake.intake_json)
                .filter(([k]) => !k.startsWith('_') && !['hours', 'nicheAnswers'].includes(k))
                .map(([k, v]) => (
                  <div key={k}>
                    <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--color-text-3)" }}>{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p style={{ color: "var(--color-text-2)" }}>{String(v) || '—'}</p>
                  </div>
                ))
              }
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function GeneratePromptModal({ intake, onClose, onDone }: {
  intake: Intake
  onClose: () => void
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [enrichSonar, setEnrichSonar] = useState(false)
  const [result, setResult] = useState<{ clientSlug: string; agentId: string; charCount: number; warnings: string[] } | null>(null)
  const [error, setError] = useState('')

  async function generate() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeId: intake.id, enrichWithSonar: enrichSonar }),
      })
      const data = await res.json()
      if (res.status === 409) { setError('Already provisioned — use sync-agent to re-sync.'); return }
      if (!res.ok) { setError(data.error || 'Generation failed'); return }
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="w-full max-w-md rounded-2xl border backdrop-blur-xl p-6 shadow-2xl" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-raised)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold" style={{ color: "var(--color-text-1)" }}>Generate Prompt</h2>
          <button onClick={onClose} className="transition-colors" style={{ color: "var(--color-text-3)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {!result ? (
          <>
            <p className="text-sm mb-4" style={{ color: "var(--color-text-2)" }}>
              Generate a system prompt and Ultravox agent for{' '}
              <span className="font-medium" style={{ color: "var(--color-text-1)" }}>{intake.business_name}</span>.
            </p>

            <label className="flex items-center gap-2 text-xs cursor-pointer mb-5 select-none" style={{ color: "var(--color-text-2)" }}>
              <input
                type="checkbox"
                checked={enrichSonar}
                onChange={e => setEnrichSonar(e.target.checked)}
                className="accent-blue-500"
              />
              Enrich with Sonar Pro (web research — +5s)
            </label>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm hover:bg-[var(--color-hover)] transition-colors"
                style={{ color: "var(--color-text-2)", backgroundColor: "var(--color-surface)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
                style={{ color: "var(--color-text-1)", backgroundColor: "var(--color-primary)" }}
              >
                {loading ? (enrichSonar ? 'Researching…' : 'Generating…') : 'Generate'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 mb-5 space-y-2">
              <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-1">Agent created</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="uppercase tracking-wide text-[10px]" style={{ color: "var(--color-text-3)" }}>Slug</p>
                  <p className="font-mono" style={{ color: "var(--color-text-1)" }}>{result.clientSlug}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide text-[10px]" style={{ color: "var(--color-text-3)" }}>Char count</p>
                  <p style={{ color: "var(--color-text-1)" }}>{result.charCount.toLocaleString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="uppercase tracking-wide text-[10px]" style={{ color: "var(--color-text-3)" }}>Agent ID</p>
                  <p className="font-mono text-[10px] break-all" style={{ color: "var(--color-text-2)" }}>{result.agentId}</p>
                </div>
              </div>
              {result.warnings?.length > 0 && (
                <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
                  <p className="text-amber-400 text-[10px] uppercase tracking-wider mb-1">Warnings</p>
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-amber-300/70 text-xs">{w}</p>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onDone}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
              style={{ color: "var(--color-text-1)", backgroundColor: "var(--color-primary)" }}
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ActivateModal({ intake, onClose }: {
  intake: Intake
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function createCheckout() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeId: intake.id, clientId: intake.client_id }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create checkout'); return }
      setCheckoutUrl(data.url)
    } finally {
      setLoading(false)
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(checkoutUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="w-full max-w-md rounded-2xl border backdrop-blur-xl p-6 shadow-2xl" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-raised)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold" style={{ color: "var(--color-text-1)" }}>Activate Client — $20 Setup</h2>
          <button onClick={onClose} className="transition-colors" style={{ color: "var(--color-text-3)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {!checkoutUrl ? (
          <>
            <p className="text-sm mb-5" style={{ color: "var(--color-text-2)" }}>
              Send a $20 setup payment link to{' '}
              <span className="font-medium" style={{ color: "var(--color-text-1)" }}>{intake.business_name}</span>
              {intake.contact_email && (
                <> (<span style={{ color: "var(--color-text-2)" }}>{intake.contact_email}</span>)</>
              )}.
              On payment, their Twilio number is auto-provisioned and login email is sent.
            </p>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm hover:bg-[var(--color-hover)] transition-colors"
                style={{ color: "var(--color-text-2)", backgroundColor: "var(--color-surface)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createCheckout}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating link…' : 'Create payment link'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm mb-3" style={{ color: "var(--color-text-2)" }}>Payment link ready. Copy and send to the client, or open it yourself.</p>
            <div className="flex items-center gap-2 mb-5">
              <input
                type="text"
                readOnly
                value={checkoutUrl}
                className="flex-1 min-w-0 border rounded-xl px-3 py-2 text-xs font-mono truncate focus:outline-none"
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-2)" }}
              />
              <button
                type="button"
                onClick={copyUrl}
                className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium border hover:bg-[var(--color-hover)] transition-colors"
                style={{ color: "var(--color-text-2)", backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm hover:bg-[var(--color-hover)] transition-colors"
                style={{ color: "var(--color-text-2)", backgroundColor: "var(--color-surface)" }}
              >
                Close
              </button>
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-center text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
              >
                Open link
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CreateAccountModal({ intake, onClose, onSuccess }: {
  intake: Intake
  onClose: () => void
  onSuccess: (email: string) => void
}) {
  const [email, setEmail] = useState('')
  const [clientId] = useState(intake.client_id || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/create-client-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, intakeId: intake.id, clientId: clientId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); return }
      onSuccess(email)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="w-full max-w-md rounded-2xl border backdrop-blur-xl p-6 shadow-2xl" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-raised)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold" style={{ color: "var(--color-text-1)" }}>Create Client Account</h2>
          <button onClick={onClose} className="transition-colors" style={{ color: "var(--color-text-3)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <p className="text-sm mb-5" style={{ color: "var(--color-text-2)" }}>
          Creating account for <span className="font-medium" style={{ color: "var(--color-text-1)" }}>{intake.business_name}</span>.
          A password reset email will be sent to the client.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase mb-2" style={{ color: "var(--color-text-3)" }}>
              Client Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="client@company.com"
              className="w-full border rounded-xl px-4 py-2.5 text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-all"
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-1)" }}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm hover:bg-[var(--color-hover)] transition-colors"
              style={{ color: "var(--color-text-2)", backgroundColor: "var(--color-surface)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
              style={{ color: "var(--color-text-1)", backgroundColor: "var(--color-primary)" }}
            >
              {loading ? 'Creating…' : 'Create & Send Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ActiveClientCard({ client }: { client: Client }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const log = client.activation_log

  function copyLink(link: string) {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
      <button
        className="w-full flex items-center gap-3 p-4 hover:bg-[var(--color-hover)] transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
          <span className="text-green-400 text-xs font-bold">{client.business_name.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-1)" }}>{client.business_name}</p>
          <p className="text-xs" style={{ color: "var(--color-text-3)" }}>{client.twilio_number || 'No number assigned'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {log && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
              Activation log
            </span>
          )}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: "var(--color-text-3)" }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--color-border)" }}>
          {log ? (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-3)" }}>Activation Log</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--color-text-3)" }}>Activated</p>
                  <p style={{ color: "var(--color-text-2)" }}>{new Date(log.activated_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--color-text-3)" }}>Amount paid</p>
                  <p style={{ color: "var(--color-text-2)" }}>{log.stripe_amount != null ? `$${(log.stripe_amount / 100).toFixed(2)}` : '—'}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--color-text-3)" }}>Twilio number</p>
                  <p className="font-mono" style={{ color: "var(--color-text-2)" }}>{log.twilio_number_bought || '—'}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--color-text-3)" }}>Contact email</p>
                  <p className="break-all" style={{ color: "var(--color-text-2)" }}>{log.contact_email || '—'}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--color-text-3)" }}>Callback phone</p>
                  <p style={{ color: "var(--color-text-2)" }}>{log.callback_phone || '—'}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--color-text-3)" }}>Stripe session</p>
                  <p className="font-mono text-[10px] break-all" style={{ color: "var(--color-text-3)" }}>{log.stripe_session_id}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] border rounded-full px-2 py-0.5 ${log.sms_sent ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
                  SMS {log.sms_sent ? 'sent' : `skipped${log.sms_skip_reason ? ': ' + log.sms_skip_reason : ''}`}
                </span>
                <span className={`text-[10px] border rounded-full px-2 py-0.5 ${log.email_sent ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
                  Email {log.email_sent ? 'sent' : 'not configured'}
                </span>
              </div>

              {log.telegram_link && (
                <div>
                  <p className="uppercase tracking-wide text-[10px] mb-1" style={{ color: "var(--color-text-3)" }}>Telegram setup link</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-mono break-all flex-1" style={{ color: "var(--color-text-2)" }}>{log.telegram_link}</p>
                    <button
                      onClick={() => copyLink(log.telegram_link!)}
                      className="shrink-0 text-[10px] px-2 py-1 rounded-lg border hover:bg-[var(--color-hover)] transition-colors"
                      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-2)" }}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: "var(--color-text-3)" }}>Note: token is consumed after client taps Start. Use generate-telegram-token to re-invite.</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--color-text-3)" }}>No activation log — client was provisioned before this feature was added.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function ClientsTable({ intakes, clients }: {
  intakes: Intake[]
  clients: Client[]
}) {
  const router = useRouter()
  const [modal, setModal] = useState<Intake | null>(null)
  const [generateModal, setGenerateModal] = useState<Intake | null>(null)
  const [activateModal, setActivateModal] = useState<Intake | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  function handleSuccess(email: string) {
    setModal(null)
    setSuccessMsg(`Account created and reset email sent to ${email}`)
    setTimeout(() => setSuccessMsg(''), 6000)
  }

  function handleGenerateDone() {
    setGenerateModal(null)
    router.refresh()
  }

  return (
    <>
      {generateModal && (
        <GeneratePromptModal
          intake={generateModal}
          onClose={() => setGenerateModal(null)}
          onDone={handleGenerateDone}
        />
      )}

      {activateModal && (
        <ActivateModal
          intake={activateModal}
          onClose={() => setActivateModal(null)}
        />
      )}

      {modal && (
        <CreateAccountModal
          intake={modal}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {successMsg}
        </div>
      )}

      {/* Active clients */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-3)" }}>Active Clients</h2>
        <div className="space-y-2">
          {clients.map(c => (
            <ActiveClientCard key={c.id} client={c} />
          ))}
        </div>
      </div>

      {/* Intake submissions */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-3)" }}>
          Intake Submissions ({intakes.length})
        </h2>
        {intakes.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: "var(--color-text-3)" }}>No submissions yet</div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-3)" }}>Business</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-3)" }}>Contact</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-3)" }}>Submitted</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-3)" }}>Status</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-3)" }}>Actions</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {intakes.map(intake => (
                  <IntakeRow
                    key={intake.id}
                    intake={intake}
                    onCreateAccount={setModal}
                    onGeneratePrompt={setGenerateModal}
                    onActivate={setActivateModal}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
