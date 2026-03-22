'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { toast } from 'sonner'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import ShimmerButton from '@/components/ui/shimmer-button'
import { fmtPhone } from '@/lib/settings-utils'

interface PromptEditorCardProps {
  client: ClientConfig
  isAdmin: boolean
  nicheLabel: string
  prompt: string
  onPromptChange: (value: string) => void
  previewMode?: boolean
}

export default function PromptEditorCard({
  client,
  isAdmin,
  nicheLabel,
  prompt,
  onPromptChange,
  previewMode,
}: PromptEditorCardProps) {
  const [collapsed, setCollapsed] = useState(isAdmin)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [ultravoxWarning, setUltravoxWarning] = useState<string | null>(null)
  const [promptWarnings, setPromptWarnings] = useState<{ field: string; message: string }[]>([])
  const [changeDesc, setChangeDesc] = useState('')

  const [regenState, setRegenState] = useState<'idle' | 'loading' | 'done' | 'partial' | 'error' | 'cooldown'>('idle')
  const [regenCooldownEnd, setRegenCooldownEnd] = useState(0)
  const [regenCooldownLeft, setRegenCooldownLeft] = useState(0)

  // Countdown timer for rate-limit cooldown
  useEffect(() => {
    if (regenCooldownEnd <= Date.now()) { setRegenCooldownLeft(0); return }
    const tick = () => {
      const left = Math.ceil((regenCooldownEnd - Date.now()) / 1000)
      if (left <= 0) { setRegenCooldownLeft(0); setRegenState('idle'); return }
      setRegenCooldownLeft(left)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [regenCooldownEnd])

  const originalPrompt = client.system_prompt ?? ''
  const dirty = prompt !== originalPrompt
  const charCount = prompt.length

  const handleRegen = useCallback(async () => {
    setRegenState('loading')
    try {
      const res = await fetch('/api/dashboard/regenerate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      })
      if (res.status === 429) {
        const json = await res.json().catch(() => ({}))
        const cooldown = json.cooldown_seconds ?? 300
        setRegenCooldownEnd(Date.now() + cooldown * 1000)
        setRegenState('cooldown')
        return
      }
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      if (json.synced === false) {
        setRegenState('partial')
        toast.warning('Regenerated, but agent sync pending')
        setTimeout(() => setRegenState('idle'), 4000)
      } else {
        setRegenState('done')
        toast.success('Prompt regenerated')
        setTimeout(() => setRegenState('idle'), 3000)
      }
    } catch (e) {
      console.error('[regen]', e)
      setRegenState('error')
      toast.error('Regeneration failed')
      setTimeout(() => setRegenState('idle'), 3000)
    }
  }, [client.id])

  async function save() {
    setSaving(true)
    setSaved(false)
    setSaveError('')
    setUltravoxWarning(null)
    setPromptWarnings([])
    const desc = changeDesc.trim() || 'Edited via dashboard'
    const body: Record<string, unknown> = { system_prompt: prompt, change_description: desc }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      setSaved(true)
      setChangeDesc('')
      setTimeout(() => setSaved(false), 3000)
      if (!data.ultravox_synced && data.ultravox_error) {
        setUltravoxWarning(`Ultravox sync failed: ${data.ultravox_error}. Use "Re-sync Agent" to retry.`)
        toast.warning('Saved, but agent sync failed')
      } else {
        toast.success('Prompt saved')
      }
      if (data.warnings?.length) {
        setPromptWarnings(data.warnings)
      }
    } else {
      const d = await res.json().catch(() => ({}))
      const msg = d.error || 'Save failed \u2014 try again.'
      setSaveError(msg)
      toast.error(msg)
      setTimeout(() => setSaveError(''), 5000)
    }
  }

  const regenLabel = isAdmin
    ? (regenState === 'loading' ? 'Re-generating\u2026' : regenState === 'done' ? 'Done!' : regenState === 'partial' ? 'Regenerated \u2014 syncing to agent\u2026' : regenState === 'error' ? 'Error \u2014 try again' : regenCooldownLeft > 0 ? `Wait ${Math.floor(regenCooldownLeft / 60)}:${String(regenCooldownLeft % 60).padStart(2, '0')}` : 'Re-generate from template')
    : (regenState === 'loading' ? 'Refreshing\u2026' : regenState === 'done' ? 'Updated!' : regenState === 'partial' ? 'Saved \u2014 syncing\u2026' : regenState === 'error' ? 'Error \u2014 try again' : regenCooldownLeft > 0 ? `Wait ${Math.floor(regenCooldownLeft / 60)}:${String(regenCooldownLeft % 60).padStart(2, '0')}` : 'Refresh Agent')

  return (
    <div className={`rounded-2xl overflow-hidden transition-colors ${collapsed ? 'border border-blue-500/25 bg-blue-500/[0.03]' : 'border border-blue-500/20 bg-surface'}`}>
      <button
        onClick={() => setCollapsed(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-hover transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${collapsed ? 'bg-blue-500/15' : 'bg-blue-500/10'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-blue-400">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-blue-400/80">{isAdmin ? 'Agent Script' : 'Agent Behavior'}</p>
            <p className="text-[11px] t3 mt-0.5">
              {collapsed
                ? (isAdmin ? 'Tap to view and edit what your AI agent says on calls' : 'See what your agent does on calls')
                : (isAdmin ? `${nicheLabel} agent instructions` : 'What your agent does on every call')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {collapsed && isAdmin && (
            <span className="text-[10px] font-medium text-blue-400/60 group-hover:text-blue-400/90 transition-colors hidden sm:block">Edit</span>
          )}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            className={`text-blue-400/50 group-hover:text-blue-400/80 transition-all duration-200 shrink-0 ${collapsed ? '' : 'rotate-180'}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="prompt-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-5 border-t b-theme">
              {isAdmin ? (
                <>
                  <div className="flex items-center justify-between mt-4 mb-3">
                    <p className="text-[11px] t3">
                      Edit your agent&apos;s script below. Changes go live as soon as you save.
                    </p>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className={`text-xs tabular-nums font-mono ${charCount > 12000 ? 'text-red-400' : charCount > 8000 ? 'text-amber-400' : 't3'}`}>
                        {charCount.toLocaleString()} / 12,000 chars (~{Math.ceil(charCount / 4).toLocaleString()} tokens)
                      </span>
                      {dirty && (
                        <input
                          type="text"
                          placeholder="What changed? (optional)"
                          value={changeDesc}
                          onChange={e => setChangeDesc(e.target.value)}
                          className="px-3 py-1.5 rounded-xl text-xs bg-hover border b-theme t2 placeholder:t3 focus:outline-none focus:border-zinc-500 w-48"
                        />
                      )}
                      <button
                        onClick={save}
                        disabled={!dirty || saving || charCount > 12000 || previewMode}
                        title={charCount > 12000 ? 'Prompt exceeds 12,000 character limit' : undefined}
                        className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          charCount > 12000
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30 cursor-not-allowed'
                            : saved
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : dirty
                            ? 'bg-blue-500 hover:bg-blue-400 text-white'
                            : 'bg-hover t3 cursor-not-allowed border b-theme'
                        }`}
                      >
                        {charCount > 12000 ? 'Over limit' : saving ? 'Saving\u2026' : (
                          <AnimatePresence mode="wait">
                            {saved ? (
                              <motion.span
                                key="saved"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                              >
                                Saved &#10003;
                              </motion.span>
                            ) : (
                              <motion.span
                                key="unsaved"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                              >
                                Save Changes
                              </motion.span>
                            )}
                          </AnimatePresence>
                        )}
                      </button>
                      <ShimmerButton
                        onClick={handleRegen}
                        disabled={regenState === 'loading' || regenCooldownLeft > 0}
                        className="text-sm"
                        shimmerColor="rgba(99,102,241,0.5)"
                      >
                        {regenLabel}
                      </ShimmerButton>
                    </div>
                    {client.updated_at && (
                      <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-3)' }}>
                        Agent last updated {(() => {
                          const diff = Date.now() - new Date(client.updated_at!).getTime()
                          const mins = Math.floor(diff / 60000)
                          if (mins < 1) return 'just now'
                          if (mins < 60) return `${mins}m ago`
                          const hrs = Math.floor(mins / 60)
                          if (hrs < 24) return `${hrs}h ago`
                          return `${Math.floor(hrs / 24)}d ago`
                        })()}
                      </p>
                    )}
                  </div>

                  {dirty && (
                    <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/[0.07] border border-amber-500/20">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0">
                        <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-[11px] text-amber-400/90">Unsaved changes &mdash; deploy to update the live agent</span>
                    </div>
                  )}

                  {ultravoxWarning && (
                    <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/[0.07] border border-orange-500/20">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-orange-400 shrink-0">
                        <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-[11px] text-orange-400/90">{ultravoxWarning}</span>
                    </div>
                  )}

                  {/* Prompt char progress bar */}
                  <div className="mb-3">
                    <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          charCount > 12000 ? 'bg-red-500' : charCount > 8000 ? 'bg-amber-500' : 'bg-blue-500/60'
                        }`}
                        style={{ width: `${Math.min((charCount / 12000) * 100, 100)}%` }}
                      />
                    </div>
                    {charCount > 12000 && (
                      <p className="text-[10px] text-red-400 mt-1">
                        Over limit by {(charCount - 12000).toLocaleString()} chars. Remove content before saving.
                      </p>
                    )}
                    {charCount > 8000 && charCount <= 12000 && (
                      <p className="text-[10px] text-amber-400 mt-1">
                        GLM-4.6 works best under 8,000 chars &mdash; consider trimming for optimal voice quality.
                      </p>
                    )}
                  </div>

                  {promptWarnings.length > 0 && (
                    <div className="mb-3 px-3 py-2.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-amber-400">Prompt warnings</span>
                        <button onClick={() => setPromptWarnings([])} className="text-[10px] text-amber-400/60 hover:text-amber-400">
                          Dismiss
                        </button>
                      </div>
                      <ul className="space-y-0.5">
                        {promptWarnings.map((w, i) => (
                          <li key={i} className="text-[10px] text-amber-400/80 leading-relaxed">&bull; {w.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {saveError && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 mb-3">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-red-400 shrink-0">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span className="text-[11px] text-red-400/90">{saveError}</span>
                    </div>
                  )}

                  <textarea
                    value={prompt}
                    onChange={e => onPromptChange(e.target.value)}
                    className="w-full h-[480px] bg-black/20 border b-theme rounded-xl p-4 text-sm t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
                    spellCheck={false}
                    placeholder={`Enter your ${nicheLabel} agent's system prompt\u2026`}
                  />
                </>
              ) : (
                /* Client behavior summary (replaces raw prompt editor) */
                <div className="mt-4 space-y-3">
                  <div className="px-4 py-3 rounded-xl bg-blue-500/[0.04] border border-blue-500/15">
                    <p className="text-xs font-semibold t1 mb-2.5">How your agent behaves</p>
                    <ul className="space-y-1.5">
                      {client.agent_name && (
                        <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                          <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                          Greets callers as {client.agent_name}
                        </li>
                      )}
                      <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                        <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                        Collects callback details and takes messages
                      </li>
                      {(client.business_facts || (client.extra_qa && client.extra_qa.length > 0)) && (
                        <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                          <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                          Answers common business questions
                        </li>
                      )}
                      {client.sms_enabled && (
                        <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                          <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                          Sends a follow-up text after calls
                        </li>
                      )}
                      {client.business_hours_weekday && (
                        <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                          <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                          Uses your business hours and after-hours rules
                        </li>
                      )}
                      {client.forwarding_number && (
                        <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                          <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                          Transfers urgent calls to {fmtPhone(client.forwarding_number)}
                        </li>
                      )}
                      {client.booking_enabled && client.calendar_auth_status === 'connected' && (
                        <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                          <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                          Books appointments on your Google Calendar
                        </li>
                      )}
                      {client.knowledge_backend === 'pgvector' && (
                        <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                          <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                          Searches your knowledge base for detailed answers
                        </li>
                      )}
                      {client.context_data && (
                        <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                          <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                          References your {client.context_data_label || 'reference data'} for lookups
                        </li>
                      )}
                    </ul>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] t3 leading-relaxed">
                      Need behavior changes? Update your business details above, or contact support for advanced customization.
                    </p>
                    <ShimmerButton
                      onClick={handleRegen}
                      disabled={regenState === 'loading' || previewMode || regenCooldownLeft > 0}
                      className="text-sm shrink-0 ml-3"
                      shimmerColor="rgba(99,102,241,0.5)"
                    >
                      {regenLabel}
                    </ShimmerButton>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
