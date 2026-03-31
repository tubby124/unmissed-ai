'use client'

/**
 * CallRoutingCard — D254
 *
 * Dashboard settings card that lets owners view and update the 3 reasons
 * people call their business. When reasons change and the owner clicks
 * "Update call routing", it calls /api/onboard/infer-niche with the
 * current niche + reasons → Haiku generates a new TRIAGE_DEEP →
 * saved to niche_custom_variables via PATCH /api/dashboard/settings.
 *
 * This is the post-onboarding complement to the D247 onboarding step.
 * Mutation class: DB_ONLY — niche_custom_variables stores the routing
 * intent; it feeds into prompt regeneration at provision time and into
 * future /prompt-deploy runs.
 *
 * D256 — Why section patching is deferred:
 * replacePromptSection('triage') in lib/prompt-sections.ts has no alias
 * for 'triage' in SECTION_HEADER_ALIASES, so it would APPEND a new
 * marked block instead of replacing the existing ## 3. TRIAGE section,
 * corrupting the live prompt. Fix requires adding 'triage' to
 * SECTION_HEADER_ALIASES in prompt-sections.ts first.
 * Until that prereq lands, the card is honest: routing is saved to DB
 * and takes effect on the next agent rebuild (/prompt-deploy).
 */

import { useState, useCallback } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { Loader2, Check, PhoneIncoming } from 'lucide-react'

interface CallRoutingCardProps {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}

const NICHE_PLACEHOLDERS: Record<string, string[]> = {
  auto_glass:          ['Windshield replacement quote', 'Chip repair — same day', 'Insurance claim help'],
  hvac:                ['AC not working', 'Furnace tune-up booking', 'Get a quote'],
  plumbing:            ['Emergency leak', 'Drain cleaning quote', 'Water heater install'],
  dental:              ['New patient booking', 'Toothache / emergency', 'Insurance question'],
  legal:               ['Free consultation', 'Case update check-in', 'New matter intake'],
  salon:               ['Book appointment', 'Pricing / services', 'Cancel or reschedule'],
  real_estate:         ['Buy a home', 'Sell my home', 'Rental inquiry'],
  property_management: ['Maintenance request', 'Pay rent / question', 'Lease inquiry'],
  restaurant:          ['Reserve a table', 'Menu / hours', 'Catering inquiry'],
  print_shop:          ['Get a quote', 'Order status', 'Rush job request'],
  voicemail:           ['Leave a message', 'Pricing question', 'Callback request'],
  other:               ['Main reason people call', 'Second common call type', 'Third call type'],
}

function getPlaceholders(niche: string | null): string[] {
  return NICHE_PLACEHOLDERS[niche ?? ''] ?? NICHE_PLACEHOLDERS.other
}

export default function CallRoutingCard({ client, isAdmin, previewMode }: CallRoutingCardProps) {
  const existing = (client.niche_custom_variables as Record<string, string> | null) ?? {}
  const hasTriage = Boolean(existing.TRIAGE_DEEP)

  // Parse stored reasons (if any) from niche_custom_variables._caller_reasons
  const storedReasons: string[] = (() => {
    try {
      const raw = existing._caller_reasons
      if (raw) return JSON.parse(raw) as string[]
    } catch { /* noop */ }
    return ['', '', '']
  })()

  const [reasons, setReasons] = useState<string[]>(storedReasons.length >= 3 ? storedReasons : ['', '', ''])
  const [generating, setGenerating] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [triageGenerated, setTriageGenerated] = useState(hasTriage)

  const placeholders = getPlaceholders(client.niche)

  function patch(body: Record<string, unknown>) {
    const payload = { ...body, ...(isAdmin ? { client_id: client.id } : {}) }
    return fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  const handleGenerate = useCallback(async () => {
    const filled = reasons.map(r => r.trim()).filter(r => r.length > 0)
    if (filled.length === 0) {
      setError('Add at least one reason people call before generating routing.')
      return
    }
    if (!client.business_name || !client.niche) return

    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/onboard/infer-niche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: client.business_name,
          knownNiche: client.niche,
          callerReasons: filled,
        }),
      })

      if (!res.ok) throw new Error('Inference failed')

      const json = await res.json() as { niche?: string; customVariables?: Record<string, string> }
      const triage = json.customVariables?.TRIAGE_DEEP

      if (!triage) throw new Error('No routing generated — try again')

      // Save to DB: merge TRIAGE_DEEP + _caller_reasons into niche_custom_variables
      const updated: Record<string, string> = {
        ...existing,
        TRIAGE_DEEP: triage,
        _caller_reasons: JSON.stringify(filled),
      }

      const saveRes = await patch({ niche_custom_variables: updated })
      if (!saveRes.ok) throw new Error('Failed to save')

      // D256 — also patch the live system_prompt TRIAGE section so it takes effect immediately
      // replacePromptSection('triage') finds ## 3. TRIAGE via SECTION_HEADER_ALIASES and replaces it,
      // which triggers needsAgentSync → updateAgent() on the live Ultravox agent.
      await patch({ section_id: 'triage', section_content: triage })

      setTriageGenerated(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }, [reasons, client.business_name, client.niche, existing, isAdmin, client.id])

  return (
    <div className="pt-4 border-t b-theme">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <PhoneIncoming size={13} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Call Routing</p>
            <p className="text-[11px] t3 mt-0.5">
              Why do people call you? Your agent uses this to route each caller to the right outcome.
            </p>
          </div>
        </div>

        {triageGenerated && !generating && (
          <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium shrink-0 mt-0.5">
            <Check size={11} />
            Routing active
          </span>
        )}
      </div>

      <div className="space-y-2">
        {reasons.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-600 w-4 shrink-0">{i + 1}.</span>
            <input
              type="text"
              value={r}
              onChange={e => {
                const next = [...reasons]
                next[i] = e.target.value
                setReasons(next)
                if (triageGenerated) setTriageGenerated(false)
              }}
              disabled={previewMode}
              placeholder={placeholders[i] ?? `Reason ${i + 1}`}
              className="flex-1 bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-indigo-500/40 transition-colors disabled:opacity-40"
            />
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-red-400">{error}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] t3">
          {triageGenerated
            ? 'Routing saved and applied to your live agent.'
            : 'Add at least one reason and click generate to set up call routing.'}
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating || previewMode || reasons.every(r => !r.trim())}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 ${
            saved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-indigo-500 hover:bg-indigo-400 text-white'
          }`}
        >
          {generating ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Generating…
            </>
          ) : saved ? (
            <>
              <Check size={12} />
              Routing updated
            </>
          ) : triageGenerated ? (
            'Regenerate'
          ) : (
            'Set up routing'
          )}
        </button>
      </div>
    </div>
  )
}
