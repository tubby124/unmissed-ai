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

interface Client {
  id: string
  slug: string
  business_name: string
  twilio_number: string | null
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
        className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
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
              <p className="text-sm font-medium text-white">{intake.business_name}</p>
              <p className="text-xs text-zinc-500 capitalize">{intake.niche?.replace(/_/g, ' ') || '—'}</p>
              {intake.owner_name && (
                <p className="text-xs text-zinc-400 mt-0.5">{intake.owner_name}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-zinc-400">
          {intake.contact_email
            ? <a href={`mailto:${intake.contact_email}`} className="hover:text-zinc-200 transition-colors" onClick={e => e.stopPropagation()}>{intake.contact_email}</a>
            : <span className="text-zinc-600">—</span>
          }
        </td>
        <td className="px-4 py-3 text-xs text-zinc-500">{date}</td>
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
                className="text-[10px] font-medium text-zinc-300 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-lg px-3 py-1 transition-colors"
              >
                Create account
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-zinc-600">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </td>
      </tr>
      {expanded && intake.intake_json && (
        <tr className="border-b border-white/[0.04]">
          <td colSpan={6} className="px-4 py-4 bg-white/[0.01]">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {Object.entries(intake.intake_json)
                .filter(([k]) => !k.startsWith('_') && !['hours', 'nicheAnswers'].includes(k))
                .map(([k, v]) => (
                  <div key={k}>
                    <p className="text-zinc-600 uppercase tracking-wide text-[10px] mb-0.5">{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="text-zinc-300">{String(v) || '—'}</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-zinc-950/95 backdrop-blur-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Generate Prompt</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {!result ? (
          <>
            <p className="text-zinc-400 text-sm mb-4">
              Generate a system prompt and Ultravox agent for{' '}
              <span className="text-white font-medium">{intake.business_name}</span>.
            </p>

            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer mb-5 select-none">
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
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-zinc-400 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-500 hover:bg-blue-400 disabled:opacity-50 transition-colors"
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
                  <p className="text-zinc-500 uppercase tracking-wide text-[10px]">Slug</p>
                  <p className="text-zinc-200 font-mono">{result.clientSlug}</p>
                </div>
                <div>
                  <p className="text-zinc-500 uppercase tracking-wide text-[10px]">Char count</p>
                  <p className="text-zinc-200">{result.charCount.toLocaleString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-zinc-500 uppercase tracking-wide text-[10px]">Agent ID</p>
                  <p className="text-zinc-400 font-mono text-[10px] break-all">{result.agentId}</p>
                </div>
              </div>
              {result.warnings?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/[0.06]">
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
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-500 hover:bg-blue-400 transition-colors"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-zinc-950/95 backdrop-blur-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Activate Client — $20 Setup</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {!checkoutUrl ? (
          <>
            <p className="text-zinc-400 text-sm mb-5">
              Send a $20 setup payment link to{' '}
              <span className="text-white font-medium">{intake.business_name}</span>
              {intake.contact_email && (
                <> (<span className="text-zinc-300">{intake.contact_email}</span>)</>
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
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-zinc-400 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
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
            <p className="text-zinc-400 text-sm mb-3">Payment link ready. Copy and send to the client, or open it yourself.</p>
            <div className="flex items-center gap-2 mb-5">
              <input
                type="text"
                readOnly
                value={checkoutUrl}
                className="flex-1 min-w-0 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-zinc-300 font-mono truncate focus:outline-none"
              />
              <button
                type="button"
                onClick={copyUrl}
                className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-zinc-400 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-zinc-950/95 backdrop-blur-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Create Client Account</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <p className="text-zinc-400 text-sm mb-5">
          Creating account for <span className="text-white font-medium">{intake.business_name}</span>.
          A password reset email will be sent to the client.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-2">
              Client Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="client@company.com"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-all"
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
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-zinc-400 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-500 hover:bg-blue-400 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating…' : 'Create & Send Email'}
            </button>
          </div>
        </form>
      </div>
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
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Active Clients</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {clients.map(c => (
            <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <span className="text-green-400 text-xs font-bold">{c.business_name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.business_name}</p>
                  <p className="text-xs text-zinc-500">{c.twilio_number || 'No number'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Intake submissions */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Intake Submissions ({intakes.length})
        </h2>
        {intakes.length === 0 ? (
          <div className="text-center py-16 text-zinc-600 text-sm">No submissions yet</div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Business</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Contact</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Submitted</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Actions</th>
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
