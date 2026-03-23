'use client'

import type { ClientConfig } from '@/app/dashboard/settings/page'
import { NICHE_CONFIG, DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'
import { fmtPhone, getPlanName } from '@/lib/settings-utils'
import { PremiumToggle } from '@/components/ui/bouncy-toggle'

interface AgentIdentityHeaderProps {
  client: ClientConfig
  isActive: boolean
  onToggleStatus: () => void
}

export default function AgentIdentityHeader({ client, isActive, onToggleStatus }: AgentIdentityHeaderProps) {
  const niche = client.niche ?? ''
  const nicheConfig = NICHE_CONFIG[niche] ?? { label: niche || 'General', color: 't2', border: 'border-zinc-500/30' }
  const minuteLimit = client.monthly_minute_limit ?? DEFAULT_MINUTE_LIMIT

  return (
    <div className="flex items-start justify-between gap-4 mb-5">

      {/* Bot + name + pills */}
      <div className="flex items-start gap-3 min-w-0">
        {/* CSS bot */}
        <div className="shrink-0 flex flex-col items-center gap-0 mt-0.5" aria-hidden="true">
          {/* Antenna */}
          <div className="bot-antenna w-0.5 h-3 bg-indigo-400/70 rounded-full mb-0.5" />
          {/* Head */}
          <div className="relative w-9 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
            {/* Eyes */}
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-indigo-400 animate-pulse" style={{ animationDelay: '0s' }} />
              <div className="w-2 h-2 rounded-sm bg-indigo-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
            {/* Scan line */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-indigo-400/30 rounded-full" />
          </div>
          {/* Body */}
          <div className="relative w-7 h-5 rounded bg-indigo-500/15 border border-indigo-500/30 mt-0.5 flex items-center justify-center">
            <div className="w-3 h-1 rounded-full bg-indigo-400/50" />
            {/* Arms */}
            <div className="bot-arm-l absolute -left-2.5 top-0.5 w-2 h-4 rounded-full bg-indigo-500/30 border border-indigo-500/30" />
            <div className="bot-arm-r absolute -right-2.5 top-0.5 w-2 h-4 rounded-full bg-indigo-500/30 border border-indigo-500/30" />
          </div>
          {/* Feet */}
          <div className="flex gap-1 mt-0.5">
            <div className="w-2 h-1.5 rounded-sm bg-indigo-500/30 border border-indigo-500/30" />
            <div className="w-2 h-1.5 rounded-sm bg-indigo-500/30 border border-indigo-500/30" />
          </div>
        </div>

        {/* Name + pills */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold t1">{client.business_name}</h2>
            {niche && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${nicheConfig.color} ${nicheConfig.border} bg-transparent`}>
                {nicheConfig.label}
              </span>
            )}
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
              {getPlanName(client.monthly_minute_limit)} · {minuteLimit} min/mo
              {(client.bonus_minutes ?? 0) > 0 && ` + ${client.bonus_minutes} bonus`}
            </span>
          </div>
          <p className="text-[11px] t3 mt-0.5">{fmtPhone(client.twilio_number)}</p>
        </div>
      </div>

      {/* Status toggle */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <PremiumToggle checked={isActive} onChange={() => onToggleStatus()} />
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
          <span className={`text-[11px] font-medium ${isActive ? 'text-green-400' : 't3'}`}>
            {isActive ? 'Answering calls' : 'Paused'}
          </span>
        </div>
      </div>
    </div>
  )
}
