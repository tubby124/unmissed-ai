'use client'

import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'

interface ClientInfo {
  id: string
  slug: string
  business_name: string
  niche?: string | null
  status?: string | null
  twilio_number?: string | null
  seconds_used_this_month?: number | null
  monthly_minute_limit?: number | null
  bonus_minutes?: number | null
}

interface HotLead {
  client_id?: string | null
  started_at: string
}

interface ClientHealthBarProps {
  adminClients: ClientInfo[]
  hotLeads?: HotLead[]
}

function statusDot(status: string | null | undefined) {
  if (status === 'active') return 'bg-green-500'
  if (status === 'paused') return 'bg-zinc-500'
  if (status === 'churned') return 'bg-red-500'
  return 'bg-zinc-600'
}

function slaColor(ageHours: number) {
  if (ageHours < 1) return 'text-emerald-400'
  if (ageHours < 3) return 'text-amber-400'
  return 'text-red-400'
}

export default function ClientHealthBar({ adminClients, hotLeads = [] }: ClientHealthBarProps) {
  if (adminClients.length === 0) return null

  const now = Date.now()

  return (
    <div className="rounded-2xl border b-theme overflow-hidden bg-surface">
      <div className="px-4 py-2.5 border-b b-theme bg-surface">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">
          Client Health
        </p>
      </div>
      <div>
        {adminClients.map((client, i) => {
          const minutesUsed = Math.ceil((client.seconds_used_this_month ?? 0) / 60)
          const minuteLimit = (client.monthly_minute_limit ?? DEFAULT_MINUTE_LIMIT) + (client.bonus_minutes ?? 0)
          const usagePct = minuteLimit > 0 ? (minutesUsed / minuteLimit) * 100 : 0
          const barColor =
            usagePct > 95 ? 'bg-red-500' :
            usagePct > 80 ? 'bg-amber-500' :
            'bg-blue-500'

          const clientHotLeads = hotLeads.filter(h => h.client_id === client.id)
          const oldestHotAgeHours = clientHotLeads.length > 0
            ? Math.max(...clientHotLeads.map(h => (now - new Date(h.started_at).getTime()) / 3600000))
            : 0

          return (
            <div
              key={client.id}
              className={`flex items-center gap-3 px-4 py-2.5 hover:bg-hover transition-colors${i < adminClients.length - 1 ? ' border-b b-theme' : ''}`}
            >
              {/* Status dot */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot(client.status)}`} />

              {/* Name + niche */}
              <div className="min-w-0 w-32 shrink-0">
                <p className="text-[12px] font-medium truncate t1">
                  {client.business_name}
                </p>
                {client.niche && (
                  <p className="text-[10px] font-mono truncate t3">
                    {client.niche.replace(/_/g, ' ')}
                  </p>
                )}
              </div>

              {/* Minute usage bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono t3">
                    {minutesUsed}/{minuteLimit} min
                  </span>
                  <span className={`text-[10px] font-mono ${usagePct > 80 ? 'text-amber-400' : 't3'}`}>
                    {Math.round(usagePct)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-hover">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${Math.min(usagePct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Hot lead SLA */}
              {clientHotLeads.length > 0 && (
                <div className={`shrink-0 text-[10px] font-mono ${slaColor(oldestHotAgeHours)} ${oldestHotAgeHours >= 3 ? 'animate-pulse' : ''}`}>
                  {clientHotLeads.length} hot · {Math.floor(oldestHotAgeHours)}h
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
