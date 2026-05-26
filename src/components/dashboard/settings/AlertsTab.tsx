'use client'

import { useState, useCallback } from 'react'
import { motion } from 'motion/react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { usePatchSettings } from './usePatchSettings'
import { PremiumToggle } from '@/components/ui/bouncy-toggle'
import { buildTelegramDeepLink } from '@/lib/telegram-link'

interface AlertsTabProps {
  client: ClientConfig
  previewMode?: boolean
  isAdmin: boolean
  tgStyle: string
  setTgStyle: (style: string) => void
}

export default function AlertsTab({ client, previewMode, isAdmin, tgStyle, setTgStyle }: AlertsTabProps) {
  const { saving, patch } = usePatchSettings(client.id, isAdmin)
  const [weeklyDigest, setWeeklyDigest] = useState(client.weekly_digest_enabled !== false)
  const [telegramEnabled, setTelegramEnabled] = useState(client.telegram_notifications_enabled !== false)
  const [emailEnabled, setEmailEnabled] = useState(client.email_notifications_enabled !== false)

  // Multichannel owner-alert state
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(client.sms_alerts_enabled === true)
  const [alertPhone, setAlertPhone] = useState(client.alert_phone ?? '')
  const [alertEmail, setAlertEmail] = useState(client.alert_email ?? '')
  const [alertEmailCc, setAlertEmailCc] = useState(client.alert_email_cc ?? '')
  const [alertPhoneDirty, setAlertPhoneDirty] = useState(false)
  const [alertEmailDirty, setAlertEmailDirty] = useState(false)
  const [alertEmailCcDirty, setAlertEmailCcDirty] = useState(false)
  const [testingChannel, setTestingChannel] = useState<'sms' | 'email' | 'telegram' | null>(null)
  const [testResult, setTestResult] = useState<{ channel: string; ok: boolean; error?: string } | null>(null)

  // Telegram connect flow
  const [tgLinkLoading, setTgLinkLoading] = useState(false)
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(
    client.telegram_registration_token
      ? buildTelegramDeepLink(client.telegram_registration_token)
      : null
  )
  const [tgCopied, setTgCopied] = useState(false)

  const getTelegramLink = useCallback(async () => {
    if (tgDeepLink) return tgDeepLink
    setTgLinkLoading(true)
    try {
      const res = await fetch('/api/dashboard/telegram-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      })
      const data = await res.json() as { deepLink?: string; alreadyConnected?: boolean }
      if (data.deepLink) {
        setTgDeepLink(data.deepLink)
        return data.deepLink
      }
    } catch {
      // ignore
    } finally {
      setTgLinkLoading(false)
    }
    return null
  }, [tgDeepLink, client.id])

  const handleOpenTelegram = useCallback(async () => {
    const link = await getTelegramLink()
    if (link) window.open(link, '_blank')
  }, [getTelegramLink])

  const handleCopyLink = useCallback(async () => {
    const link = await getTelegramLink()
    if (link) {
      await navigator.clipboard.writeText(link).catch(() => {})
      setTgCopied(true)
      setTimeout(() => setTgCopied(false), 2000)
    }
  }, [getTelegramLink])

  async function toggleWeeklyDigest() {
    const newVal = !weeklyDigest
    setWeeklyDigest(newVal)
    const res = await patch({ weekly_digest_enabled: newVal })
    if (!res?.ok) setWeeklyDigest(!newVal)
  }

  async function saveTelegramStyle(style: string) {
    const prev = tgStyle
    setTgStyle(style)
    const res = await patch({ telegram_style: style })
    if (!res?.ok) setTgStyle(prev)
  }

  async function toggleTelegramNotifications() {
    const newVal = !telegramEnabled
    setTelegramEnabled(newVal)
    const res = await patch({ telegram_notifications_enabled: newVal })
    if (!res?.ok) setTelegramEnabled(!newVal)
  }

  async function toggleEmailNotifications() {
    const newVal = !emailEnabled
    setEmailEnabled(newVal)
    const res = await patch({ email_notifications_enabled: newVal })
    if (!res?.ok) setEmailEnabled(!newVal)
  }

  async function toggleSmsAlerts() {
    const newVal = !smsAlertsEnabled
    setSmsAlertsEnabled(newVal)
    const res = await patch({ sms_alerts_enabled: newVal })
    if (!res?.ok) setSmsAlertsEnabled(!newVal)
  }

  async function saveAlertPhone() {
    if (!alertPhoneDirty) return
    const res = await patch({ alert_phone: alertPhone.trim() })
    if (res?.ok) setAlertPhoneDirty(false)
  }

  async function saveAlertEmail() {
    if (!alertEmailDirty) return
    const res = await patch({ alert_email: alertEmail.trim() })
    if (res?.ok) setAlertEmailDirty(false)
  }

  async function saveAlertEmailCc() {
    if (!alertEmailCcDirty) return
    const res = await patch({ alert_email_cc: alertEmailCc.trim() })
    if (res?.ok) setAlertEmailCcDirty(false)
  }

  async function sendTestAlert(channel: 'sms' | 'email' | 'telegram') {
    setTestingChannel(channel)
    setTestResult(null)
    try {
      const res = await fetch('/api/dashboard/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, clientId: client.id }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      setTestResult({ channel, ok: data.ok, error: data.error })
    } catch (e) {
      setTestResult({ channel, ok: false, error: e instanceof Error ? e.message : 'unknown error' })
    } finally {
      setTestingChannel(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
      className="space-y-4"
    >
    <p className="text-[11px] t3 -mb-1">Choose where alerts go and how they look.</p>

    {/* Telegram connection status card */}
    <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
      <div className="p-5 border-b b-theme">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Alert Channels</p>
            <p className="text-[11px] t3">How you receive call notifications from your agent.</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
            client.telegram_bot_token && client.telegram_chat_id
              ? 'text-green-400 border-green-500/30 bg-green-500/10'
              : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              client.telegram_bot_token && client.telegram_chat_id ? 'bg-green-500' : 'bg-amber-500'
            }`} />
            {client.telegram_bot_token && client.telegram_chat_id ? 'Telegram Connected' : 'Telegram Not Connected'}
          </span>
        </div>
      </div>

      {/* Channel list + connect CTA */}
      <div className="p-5 space-y-3">

        {/* Telegram row */}
        <div className={`p-4 rounded-xl border transition-all ${
          client.telegram_chat_id
            ? 'border-blue-500/20 bg-blue-500/[0.04]'
            : 'b-theme bg-page'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              client.telegram_chat_id ? 'bg-blue-500/15' : 'bg-hover'
            }`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={client.telegram_chat_id ? 'text-blue-400' : 't3'}>
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-xs font-semibold t1">Telegram</p>
                  <p className="text-[10px] t3 mt-0.5">
                    {client.telegram_chat_id
                      ? 'Connected — call alerts arrive instantly after each call.'
                      : 'Get instant call summaries with lead score and next steps.'}
                  </p>
                </div>
                {client.telegram_chat_id && (
                  <span className="text-[10px] font-semibold text-blue-400 shrink-0">Connected ✓</span>
                )}
              </div>

              {/* Connect flow — only when not yet connected */}
              {!client.telegram_chat_id && !previewMode && (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] t3 leading-relaxed">
                    <span className="font-medium t1">How it works:</span>{' '}
                    Tap the button → press <span className="font-mono bg-hover px-1 py-0.5 rounded text-[9px]">Start</span> in Telegram → done.
                    Alerts start arriving after your next call.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleOpenTelegram}
                      disabled={tgLinkLoading}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      {tgLinkLoading ? (
                        <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      Open Telegram &amp; Connect
                    </button>
                    <button
                      onClick={handleCopyLink}
                      disabled={tgLinkLoading}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border b-theme bg-page hover:bg-hover t1 transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      {tgCopied ? '✓ Copied' : 'Copy link'}
                    </button>
                  </div>
                  <p className="text-[9px] t3">On desktop? Copy the link and open it on your phone.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>

    {/* Telegram Message Style — only when connected */}
    {client.telegram_bot_token && client.telegram_chat_id && (
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Message Style</p>
            <p className="text-[11px] t3">Choose how call summaries appear in your Telegram chat.</p>
          </div>
          {saving && (
            <span className="text-[10px] t3 animate-pulse flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
              Saving...
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { id: 'compact', label: 'Compact', desc: 'Status + phone + summary in 2-3 lines', icon: 'M4 6h16M4 12h10' },
            { id: 'standard', label: 'Standard', desc: 'Summary, contact, and next steps separated', icon: 'M4 6h16M4 10h16M4 14h12M4 18h8' },
            { id: 'action_card', label: 'Action Card', desc: 'Structured with date, booking, and action items', icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2' },
          ] as const).map(opt => (
            <button
              key={opt.id}
              onClick={() => !previewMode && saveTelegramStyle(opt.id)}
              disabled={previewMode}
              className={`text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer group ${
                tgStyle === opt.id
                  ? 'border-blue-500/40 bg-blue-500/[0.08] shadow-[0_0_12px_rgba(59,130,246,0.06)]'
                  : 'b-theme bg-page hover:bg-hover hover:border-[var(--color-border)]'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  tgStyle === opt.id ? 'bg-blue-500/15' : 'bg-hover group-hover:bg-[var(--color-border)]'
                }`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={tgStyle === opt.id ? 'text-blue-400' : 't3'}>
                    <path d={opt.icon} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className={`text-xs font-semibold transition-colors ${tgStyle === opt.id ? 'text-blue-400' : 't1'}`}>{opt.label}</p>
              </div>
              <p className="text-[10px] t3 leading-relaxed">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>
    )}

    {/* Delivery preferences (SMS / Email / Telegram toggles + destinations) */}
    <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
      <div className="p-5 border-b b-theme">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Delivery Preferences</p>
            <p className="text-[11px] t3">Pick where call alerts get sent. Mix and match — all enabled channels fire on every call.</p>
          </div>
          {saving && (
            <span className="text-[10px] t3 animate-pulse flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
              Saving...
            </span>
          )}
        </div>
      </div>
      <div className="p-5 space-y-4">
        {/* SMS card */}
        <div className="p-4 rounded-xl border b-theme bg-page">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold t1">SMS to your phone</p>
              <p className="text-[10px] t3 mt-0.5">
                {client.twilio_number
                  ? `Sent from your business number (${client.twilio_number}).`
                  : 'Requires a provisioned business phone number.'}
              </p>
            </div>
            <PremiumToggle
              checked={smsAlertsEnabled && !!client.twilio_number}
              onChange={() => {
                if (!client.twilio_number) return
                if (!previewMode) toggleSmsAlerts()
              }}
              disabled={saving || previewMode || !client.twilio_number}
            />
          </div>
          {client.twilio_number && (
            <div className="space-y-2">
              <div>
                <p className="text-[10px] t3 mb-1">Send alerts to</p>
                <input
                  type="tel"
                  value={alertPhone}
                  onChange={(e) => { setAlertPhone(e.target.value); setAlertPhoneDirty(true) }}
                  onBlur={saveAlertPhone}
                  placeholder={client.callback_phone || '+13065550123'}
                  className="w-full text-[11px] px-3 py-2 rounded-lg border b-theme bg-surface t1 font-mono"
                  disabled={previewMode}
                />
              </div>
              {!alertPhone.trim() && !client.callback_phone && (
                <p className="text-[10px] text-amber-400">⚠ No destination set — texts will be skipped until you add one.</p>
              )}
              {smsAlertsEnabled && (
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => sendTestAlert('sms')}
                    disabled={(!alertPhone.trim() && !client.callback_phone) || testingChannel === 'sms'}
                    className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border b-theme bg-surface hover:bg-hover t1 disabled:opacity-40"
                  >
                    {testingChannel === 'sms' ? 'Sending...' : 'Send test SMS'}
                  </button>
                  {testResult?.channel === 'sms' && (
                    <span className={`text-[10px] ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                      {testResult.ok ? '✓ Sent' : `✗ ${testResult.error?.slice(0, 60)}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Email card */}
        <div className="p-4 rounded-xl border b-theme bg-page">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold t1">Email</p>
              <p className="text-[10px] t3 mt-0.5">
                Full call summary with transcript and recording link.
              </p>
            </div>
            <PremiumToggle
              checked={emailEnabled}
              onChange={() => { if (!previewMode) toggleEmailNotifications() }}
              disabled={saving || previewMode}
            />
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-[10px] t3 mb-1">Send alerts to</p>
              <input
                type="email"
                value={alertEmail}
                onChange={(e) => { setAlertEmail(e.target.value); setAlertEmailDirty(true) }}
                onBlur={saveAlertEmail}
                placeholder={client.contact_email || 'alerts@yourbusiness.com'}
                className="w-full text-[11px] px-3 py-2 rounded-lg border b-theme bg-surface t1"
                disabled={previewMode}
              />
            </div>
            <div>
              <p className="text-[10px] t3 mb-1">CC (optional)</p>
              <input
                type="email"
                value={alertEmailCc}
                onChange={(e) => { setAlertEmailCc(e.target.value); setAlertEmailCcDirty(true) }}
                onBlur={saveAlertEmailCc}
                placeholder="assistant@yourbusiness.com"
                className="w-full text-[11px] px-3 py-2 rounded-lg border b-theme bg-surface t1"
                disabled={previewMode}
              />
            </div>
            {!alertEmail.trim() && !client.contact_email && (
              <p className="text-[10px] text-amber-400">⚠ No destination set — emails will be skipped until you add one.</p>
            )}
            {emailEnabled && (
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => sendTestAlert('email')}
                  disabled={(!alertEmail.trim() && !client.contact_email) || testingChannel === 'email'}
                  className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border b-theme bg-surface hover:bg-hover t1 disabled:opacity-40"
                >
                  {testingChannel === 'email' ? 'Sending...' : 'Send test email'}
                </button>
                {testResult?.channel === 'email' && (
                  <span className={`text-[10px] ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.ok ? '✓ Sent' : `✗ ${testResult.error?.slice(0, 60)}`}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Telegram card */}
        <div className="p-4 rounded-xl border b-theme bg-page">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold t1">Telegram</p>
              <p className="text-[10px] t3 mt-0.5">
                {client.telegram_bot_token && client.telegram_chat_id
                  ? 'Connected — see Alert Channels card above to change message style.'
                  : 'Connect Telegram above to enable this channel.'}
              </p>
            </div>
            <PremiumToggle
              checked={telegramEnabled && !!(client.telegram_bot_token && client.telegram_chat_id)}
              onChange={() => {
                if (!client.telegram_bot_token || !client.telegram_chat_id) return
                if (!previewMode) toggleTelegramNotifications()
              }}
              disabled={saving || previewMode || !(client.telegram_bot_token && client.telegram_chat_id)}
            />
          </div>
          {telegramEnabled && client.telegram_chat_id && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => sendTestAlert('telegram')}
                disabled={testingChannel === 'telegram'}
                className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border b-theme bg-surface hover:bg-hover t1 disabled:opacity-40"
              >
                {testingChannel === 'telegram' ? 'Sending...' : 'Send test Telegram'}
              </button>
              {testResult?.channel === 'telegram' && (
                <span className={`text-[10px] ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {testResult.ok ? '✓ Sent' : `✗ ${testResult.error?.slice(0, 60)}`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Weekly digest toggle */}
    {client.contact_email && (
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Weekly Performance Email</p>
            <p className="text-[11px] t3">
              Receive a weekly summary of calls, leads, and bookings every Sunday at 9 AM.
            </p>
            <p className="text-[10px] t3 mt-1">Sent to {client.contact_email}</p>
          </div>
          <PremiumToggle
            checked={weeklyDigest}
            onChange={() => toggleWeeklyDigest()}
            disabled={saving || previewMode}
          />
        </div>
      </div>
    )}

    </motion.div>
  )
}
