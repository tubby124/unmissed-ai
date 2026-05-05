'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import BorderBeam from '@/components/ui/border-beam'
import { fmtPhone, timeAgo } from '@/lib/settings-utils'
import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'
import AgentIdentityHeader from './AgentIdentityHeader'
import VoicePicker from './VoicePicker'
import QuickInject from './QuickInject'
import ContextDataCard from './ContextDataCard'
import type { CardMode } from './usePatchSettings'
import { usePatchSettings } from './usePatchSettings'
import { useDirtyGuard } from './useDirtyGuard'
import FieldSyncStatusChip from './FieldSyncStatusChip'

interface AgentOverviewCardProps {
  client: ClientConfig
  isAdmin: boolean
  isActive: boolean
  onToggleStatus: () => void
  previewMode?: boolean
  mode?: CardMode
  onSave?: () => void
  onPromptChange?: (prompt: string) => void
  promptLength?: number
}

export default function AgentOverviewCard({ client, isAdmin, isActive, onToggleStatus, previewMode, mode = 'settings', onSave, onPromptChange, promptLength }: AgentOverviewCardProps) {
  // Editable identity fields
  const [agentName, setAgentName] = useState(client.agent_name ?? '')
  const [savedName, setSavedName] = useState(client.agent_name ?? '')
  const nameDirty = agentName !== savedName
  const footerDirty = nameDirty

  const { markDirty, markClean } = useDirtyGuard('overview-' + client.id)

  useEffect(() => {
    if (nameDirty) markDirty()
    else markClean()
  }, [nameDirty, markDirty, markClean])

  const { saving: footerSaving, saved: footerSaved, error: footerError, warnings, patch, retryFieldSync } = usePatchSettings(client.id, isAdmin, { onSave, onPromptChange })

  // SMS chip
  const [localSmsEnabled, setLocalSmsEnabled] = useState(client.sms_enabled ?? false)

  // Calendar modal
  const [showCalendarModal, setShowCalendarModal] = useState(false)

  // Derived display values
  const minutesUsed = client.seconds_used_this_month != null ? Math.ceil(client.seconds_used_this_month / 60) : (client.minutes_used_this_month ?? 0)
  const minuteLimit = client.monthly_minute_limit ?? DEFAULT_MINUTE_LIMIT
  const totalAvailable = minuteLimit + (client.bonus_minutes ?? 0)
  const usagePct = totalAvailable > 0 ? (minutesUsed / totalAvailable) * 100 : 0

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async function saveFooter() {
    if (!nameDirty) return
    const trimmed = agentName.trim()
    const res = await patch({ agent_name: trimmed })
    if (res?.ok) setSavedName(trimmed)
  }

  async function toggleSms() {
    const next = !localSmsEnabled
    if (!next && !confirm("Callers won't receive follow-up texts. Disable SMS?")) return
    setLocalSmsEnabled(next)
    const res = await patch({ sms_enabled: next })
    if (!res.ok) setLocalSmsEnabled(!next) // rollback
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes antennaBlink {
          0%, 90%, 100% { opacity: 1; }
          95% { opacity: 0.2; }
        }
        @keyframes headScan {
          0%, 100% { background-position: 0 0; }
          50% { background-position: 0 100%; }
        }
        @keyframes armWave {
          0%, 100% { transform: rotate(-12deg); }
          50% { transform: rotate(12deg); }
        }
        .bot-antenna { animation: antennaBlink 2.4s ease-in-out infinite; }
        .bot-arm-l { animation: armWave 1.8s ease-in-out infinite; transform-origin: 80% 20%; }
        .bot-arm-r { animation: armWave 1.8s ease-in-out infinite reverse; transform-origin: 20% 20%; }
      `}</style>

      <div className="relative rounded-2xl border b-theme bg-surface p-5">
        {isActive && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <BorderBeam size={250} duration={12} colorFrom="#6366f1" colorTo="#a855f7" />
          </div>
        )}

        {/* ── Row 1: Identity ─────────────────────────────────────────────────── */}
        {mode === 'onboarding' ? (
          <div className="mb-4">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Name Your Agent</p>
            <p className="text-[11px] t3">Give your AI receptionist a name and voice. Callers will hear this identity on every call.</p>
          </div>
        ) : (
          <AgentIdentityHeader client={client} isActive={isActive} onToggleStatus={onToggleStatus} />
        )}

        {/* ── Row 2: Editable fields 2-col grid ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Agent name */}
          <div>
            <label className="text-[10px] t3 uppercase tracking-wider block mb-1">Agent name</label>
            <input
              type="text"
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              placeholder="e.g. Aisha"
              className="w-full text-xs t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50"
            />
          </div>
          {/* Voice picker */}
          <VoicePicker client={client} isAdmin={isAdmin} />
          {/* AI phone — read-only */}
          <div>
            <label className="text-[10px] t3 uppercase tracking-wider block mb-1">AI phone</label>
            <p className="text-xs t2 font-mono bg-hover px-3 py-2 rounded-lg border b-theme">{fmtPhone(client.twilio_number)}</p>
          </div>
          {/* Last updated — read-only */}
          <div>
            <label className="text-[10px] t3 uppercase tracking-wider block mb-1">Last updated</label>
            <p className="text-xs t3 font-mono bg-hover px-3 py-2 rounded-lg border b-theme">{timeAgo(client.updated_at)}</p>
          </div>
        </div>

        {/* ── Business profile (settings only, if populated) ───────────────────── */}
        {mode !== 'onboarding' && (client.owner_name || client.city || client.callback_phone) && (
          <div className="mb-5 pt-4 border-t b-theme">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Business profile</p>
            <div className="grid grid-cols-2 gap-3">
              {client.owner_name && (
                <div>
                  <label className="text-[10px] t3 uppercase tracking-wider block mb-1">Owner</label>
                  <p className="text-xs t2 bg-hover px-3 py-2 rounded-lg border b-theme truncate">{client.owner_name}</p>
                </div>
              )}
              {(client.city || client.state) && (
                <div>
                  <label className="text-[10px] t3 uppercase tracking-wider block mb-1">Location</label>
                  <p className="text-xs t2 bg-hover px-3 py-2 rounded-lg border b-theme truncate">{[client.city, client.state].filter(Boolean).join(', ')}</p>
                </div>
              )}
              {client.callback_phone && (
                <div>
                  <label className="text-[10px] t3 uppercase tracking-wider block mb-1">Callback phone</label>
                  <p className="text-xs t2 font-mono bg-hover px-3 py-2 rounded-lg border b-theme">{fmtPhone(client.callback_phone)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Row 3: Usage bar (settings only) ─────────────────────────────────── */}
        {mode !== 'onboarding' && <div className="mb-5 pt-4 border-t b-theme">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Minutes This Month</p>
            <span className="text-xs font-mono t2 tabular-nums">{minutesUsed} / {totalAvailable} min</span>
          </div>
          <div className="h-1.5 bg-hover rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usagePct > 100 ? 'bg-pink-500' : usagePct >= 95 ? 'bg-red-500' : usagePct >= 80 ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(usagePct, 100)}%` }}
            />
          </div>
          {usagePct > 100 ? (
            <p className="text-[11px] mt-2 text-amber-400">
              You&apos;ve used all {totalAvailable} free minutes. Go to Billing &rarr; Buy Minutes to reload.
            </p>
          ) : (
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] t3">Resets 1st of each month</p>
              <p className="text-[11px] t3 tabular-nums font-mono">{totalAvailable - minutesUsed} min remaining</p>
            </div>
          )}
        </div>}

        {/* ── Row 4: Connected services chips (settings only) ────────────────── */}
        {mode !== 'onboarding' && <div className="mb-5 pt-4 border-t b-theme">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Connected services</p>
          <div className="flex flex-wrap gap-2">
            {/* Telegram — always on */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-[11px] font-medium text-blue-300">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Telegram
            </div>

            {/* SMS follow-up — toggleable */}
            <button
              onClick={toggleSms}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all ${
                localSmsEnabled
                  ? 'border-green-500/30 bg-green-500/10 text-green-300'
                  : 'b-theme t3 hover:t2'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${localSmsEnabled ? 'bg-green-400' : 'bg-zinc-600'}`} />
              SMS follow-up
            </button>

            {/* Google Calendar */}
            {(() => {
              const calConnected = client.calendar_auth_status === 'connected'
              const calEnabled = !!client.booking_enabled
              const calClass = calConnected && calEnabled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : calEnabled
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'b-theme t3 hover:t2'
              const dotClass = calConnected && calEnabled
                ? 'bg-emerald-400'
                : calEnabled
                ? 'bg-amber-400'
                : 'bg-zinc-600'
              return (
                <button
                  onClick={() => setShowCalendarModal(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all ${calClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                  Google Calendar
                  {calEnabled && !calConnected && <span className="text-[9px] font-bold ml-0.5">!</span>}
                </button>
              )
            })()}

            {/* Call forwarding / transfer */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium ${
              client.forwarding_number
                ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                : 'b-theme t3'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${client.forwarding_number ? 'bg-purple-400' : 'bg-zinc-600'}`} />
              Transfer {client.forwarding_number ? fmtPhone(client.forwarding_number) : 'off'}
            </div>
          </div>
          <FieldSyncStatusChip
            clientId={client.id}
            fieldKey="sms_enabled"
            currentValue={localSmsEnabled}
            onRetry={retryFieldSync}
          />
        </div>}

        {/* ── D423: Agent sync status (settings only) ──────────────────────────── */}
        {mode !== 'onboarding' && (() => {
          const syncAt = client.last_agent_sync_at ?? null
          const syncStatus = client.last_agent_sync_status ?? null
          if (!syncStatus) return null
          const isSuccess = syncStatus === 'success'
          const isError = syncStatus === 'error'
          const isPending = syncStatus === 'pending'
          const dot = isSuccess ? 'bg-green-400' : isError ? 'bg-red-500' : isPending ? 'bg-amber-400' : 'bg-zinc-500'
          const label = isSuccess ? 'Synced' : isError ? 'Sync error' : isPending ? 'Sync pending' : syncStatus
          const timeStr = (() => {
            if (!syncAt) return null
            const diff = Date.now() - new Date(syncAt).getTime()
            const mins = Math.floor(diff / 60_000)
            if (mins < 1) return 'just now'
            if (mins < 60) return `${mins}m ago`
            const h = Math.floor(mins / 60)
            if (h < 24) return `${h}h ago`
            return `${Math.floor(h / 24)}d ago`
          })()
          return (
            <div className="mb-5 pt-4 border-t b-theme">
              <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-2">Agent sync</p>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                <span className={`text-[11px] font-medium ${isError ? 'text-red-400' : isPending ? 'text-amber-400' : 't2'}`}>{label}</span>
                {timeStr && <span className="text-[10px] t3 font-mono ml-1">Last synced: {timeStr}</span>}
              </div>
            </div>
          )
        })()}

        {/* ── Row 5-6: Capabilities + inject + context (settings only) ────────── */}
        {mode !== 'onboarding' && (<>
        <div className="mb-5 pt-4 border-t b-theme">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Agent capabilities</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Transfer', on: !!client.forwarding_number },
              { label: 'Calendar', on: client.calendar_auth_status === 'connected' && !!client.booking_enabled },
              { label: 'SMS follow-up', on: localSmsEnabled },
              { label: 'Knowledge base', on: client.knowledge_backend === 'pgvector' },
              { label: 'Prompt', detail: `${(promptLength ?? (client.system_prompt ?? '').length).toLocaleString()} / 25,000` },
            ].map(cap => (
              <div key={cap.label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-page border b-theme">
                {'on' in cap ? (
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cap.on ? 'bg-green-400' : 'bg-zinc-600'}`} />
                ) : null}
                <span className="text-[11px] t2">{cap.label}</span>
                {cap.detail && <span className="text-[10px] font-mono t3 ml-auto">{cap.detail}</span>}
              </div>
            ))}
          </div>
        </div>

        <QuickInject client={client} isAdmin={isAdmin} />

        <ContextDataCard client={client} isAdmin={isAdmin} previewMode={previewMode} />
        </>)}

        {/* ── Footer: Save name ──────────────────────────────────────────────────── */}
        {(footerDirty || mode === 'onboarding') && (
          <div className="mt-5 pt-4 border-t b-theme flex items-center justify-between">
            <div>
              <p className="text-[11px] t3">{mode === 'onboarding' ? 'Set your agent identity' : 'Unsaved changes to agent identity'}</p>
              {footerError && <p className="text-[11px] text-red-400 mt-1">{footerError}</p>}
              {warnings.length > 0 && <p className="text-[11px] text-amber-400 mt-1">{warnings[0]}</p>}
            </div>
            <button
              onClick={saveFooter}
              disabled={footerSaving || previewMode || (!footerDirty && mode !== 'onboarding')}
              className={`text-xs px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-40 ${
                footerSaved
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-blue-500 hover:bg-blue-400 text-white'
              }`}
            >
              {footerSaving ? 'Saving...' : footerSaved ? '\u2713 Saved' : 'Save changes'}
            </button>
          </div>
        )}
      </div>

      {/* ── Calendar modal (settings only) ─────────────────────────────────── */}
      {mode !== 'onboarding' && <AnimatePresence>
        {showCalendarModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setShowCalendarModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative rounded-2xl border b-theme bg-surface p-6 w-full max-w-sm shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowCalendarModal(false)}
                className="absolute top-4 right-4 t3 hover:t1 transition-colors"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>

              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-emerald-400"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold t1">Google Calendar</p>
                  <p className="text-[11px] t3">Let your agent book appointments</p>
                </div>
              </div>

              {client.calendar_auth_status === 'connected' ? (
                <div className="mb-4 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-emerald-400 shrink-0"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="text-xs text-emerald-300">Calendar connected</span>
                  {client.google_calendar_id && (
                    <span className="text-[10px] font-mono t3 truncate">{client.google_calendar_id}</span>
                  )}
                </div>
              ) : client.calendar_auth_status === 'expired' ? (
                <div className="mb-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  Authorization expired — reconnect below.
                </div>
              ) : null}

              <p className="text-[11px] t3 mb-4">
                Connect your Google Calendar so your AI agent can check real-time availability and schedule appointments during live calls.
              </p>

              <a
                href={`/api/auth/google${isAdmin ? `?client_id=${client.id}` : ''}`}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15.5 12A3.5 3.5 0 1112 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 8.5v3.5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {client.calendar_auth_status === 'connected' ? 'Reconnect Calendar' : 'Connect Google Calendar'}
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>}
    </>
  )
}
