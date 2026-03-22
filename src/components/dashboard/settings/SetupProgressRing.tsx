'use client'

import type { ClientConfig } from '@/app/dashboard/settings/page'

interface SetupProgressRingProps {
  client: ClientConfig
  isAdmin: boolean
}

export default function SetupProgressRing({ client, isAdmin }: SetupProgressRingProps) {
  if (isAdmin) return null

  const checks = [
    { weight: 15, met: !!(client.business_facts?.trim()) },
    { weight: 15, met: !!(client.extra_qa && client.extra_qa.filter(p => p.q?.trim() && p.a?.trim()).length > 0) },
    { weight: 10, met: !!client.business_hours_weekday },
    { weight: 10, met: !!(client.booking_enabled && client.calendar_auth_status === 'connected') },
    { weight: 10, met: !!(client.voice_style_preset && client.voice_style_preset !== 'casual_friendly') },
    { weight: 15, met: client.knowledge_backend === 'pgvector' },
    { weight: 15, met: !!client.setup_complete },
    { weight: 5, met: !!client.sms_enabled },
    { weight: 5, met: !!client.forwarding_number },
  ]

  const percent = checks.reduce((sum, c) => sum + (c.met ? c.weight : 0), 0)
  const isComplete = percent >= 100

  const size = 80
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5 flex items-center gap-5">
      {/* SVG donut */}
      <div className="shrink-0 relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isComplete ? '#22c55e' : '#3b82f6'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isComplete ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-green-400">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <span className="text-lg font-bold t1">{percent}%</span>
          )}
        </div>
      </div>

      {/* Label */}
      <div className="min-w-0 flex-1">
        {isComplete ? (
          <>
            <p className="text-sm font-semibold text-green-400">Fully set up</p>
            <p className="text-[11px] t3 mt-0.5">Your agent is configured and ready to handle calls.</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold t1">Agent setup</p>
            <p className="text-[11px] t3 mt-0.5">
              {percent < 30
                ? 'Get started by adding business facts and hours.'
                : percent < 60
                ? 'Good progress. Add more details to improve call quality.'
                : 'Almost there. A few more settings to complete.'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
