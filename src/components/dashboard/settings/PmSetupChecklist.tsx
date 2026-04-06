'use client'

/**
 * D407 — PM Setup Checklist
 *
 * Rendered above other settings cards when niche === 'property_management'.
 * Shows at-a-glance completeness of PM-specific configuration.
 *
 * D425 — Telegram row links directly to /dashboard/settings#telegram-connect
 * (Option C — checklist link rather than a separate onboarding step).
 */

import type { ClientConfig } from '@/app/dashboard/settings/page'

interface PmSetupChecklistProps {
  client: ClientConfig
}

interface CheckItem {
  key: string
  label: string
  ok: boolean
  hint?: string
  href?: string
}

function getPmField(client: ClientConfig, key: string): string {
  const ncv = client.niche_custom_variables ?? {}
  return ((ncv[key] as string) ?? '').trim()
}

export default function PmSetupChecklist({ client }: PmSetupChecklistProps) {
  const contextData = typeof client.context_data === 'string' ? client.context_data.trim() : null
  const tenantCount = contextData
    ? contextData.split('\n').filter(l => l.trim()).length
    : 0

  const items: CheckItem[] = [
    {
      key: 'agent_active',
      label: 'Agent active',
      ok: !!client.ultravox_agent_id,
      hint: 'Contact support to provision your agent',
    },
    {
      key: 'emergency_phone',
      label: 'Emergency forwarding number',
      ok: !!(client.after_hours_emergency_phone?.trim()),
      hint: 'Add forwarding number',
      href: '#pm-config',
    },
    {
      key: 'maintenance_contacts',
      label: 'Maintenance contacts',
      ok: !!getPmField(client, 'niche_maintenanceContacts'),
      hint: 'Add maintenance contacts',
      href: '#pm-config',
    },
    {
      key: 'tenant_roster',
      label: contextData ? `${tenantCount} tenant${tenantCount !== 1 ? 's' : ''} loaded` : 'Tenant roster',
      ok: !!contextData,
      hint: 'Add tenant roster',
      href: '#section-advanced-context',
    },
    {
      key: 'telegram',
      label: 'Telegram connected',
      ok: !!client.telegram_chat_id,
      hint: 'Connect Telegram',
      href: '#telegram-connect',
    },
  ]

  const completedCount = items.filter(i => i.ok).length
  const totalCount = items.length
  const allDone = completedCount === totalCount

  return (
    <div className={`rounded-2xl border p-5 ${allDone ? 'border-emerald-500/30 bg-emerald-500/5' : 'b-theme bg-surface'}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">PM Setup Checklist</p>
          <p className="text-[11px] t3 mt-0.5">
            {allDone
              ? 'All set — your agent is fully configured'
              : `${completedCount} / ${totalCount} complete`}
          </p>
        </div>
        <div className={`text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full ${
          allDone
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-amber-500/15 text-amber-400'
        }`}>
          {completedCount}/{totalCount}
        </div>
      </div>

      <ul className="space-y-2">
        {items.map(item => (
          <li key={item.key} className="flex items-center gap-2.5">
            {item.ok ? (
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" className="text-emerald-400">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            ) : (
              <span className="w-4 h-4 rounded-full border border-amber-500/40 bg-amber-500/10 flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              </span>
            )}
            <span className={`text-[11px] flex-1 ${item.ok ? 't2' : 't3'}`}>
              {item.ok ? item.label : (
                item.href ? (
                  <a
                    href={item.href}
                    className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
                    onClick={e => {
                      if (item.href?.startsWith('#')) {
                        e.preventDefault()
                        const el = document.getElementById(item.href.slice(1))
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                    }}
                  >
                    {item.hint ?? item.label}
                  </a>
                ) : (
                  <span className="text-amber-400">{item.hint ?? item.label}</span>
                )
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
