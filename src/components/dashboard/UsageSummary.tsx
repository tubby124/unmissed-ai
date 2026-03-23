'use client'

import { useState, useEffect } from 'react'
import { SkeletonBox } from '@/components/dashboard/SkeletonLoader'

interface UsageData {
  [key: string]: unknown
}

interface UsageSummaryProps {
  isAdmin: boolean
}

export default function UsageSummary({ isAdmin }: UsageSummaryProps) {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return

    async function fetchUsage() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/dashboard/usage')
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        setUsage(data.usage)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load usage data')
      } finally {
        setLoading(false)
      }
    }

    fetchUsage()
  }, [isAdmin])

  if (!isAdmin) return null

  const parseMinutes = (val: unknown): number | null => {
    if (typeof val === 'number') return Math.round(val)
    if (typeof val === 'string') {
      const match = val.match(/^([\d.]+)s?$/)
      if (match) return Math.round(parseFloat(match[1]) / 60)
    }
    return null
  }

  const formatCurrency = (val: unknown): string | null => {
    if (typeof val === 'number') return `$${val.toFixed(2)}`
    if (typeof val === 'string') {
      const n = parseFloat(val)
      if (!isNaN(n)) return `$${n.toFixed(2)}`
    }
    return null
  }

  const renderMetric = (label: string, value: string | null) => {
    if (value === null) return null
    return (
      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-bg-raised)',
        }}
      >
        <p
          className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-1"
          style={{ color: 'var(--color-text-3)' }}
        >
          {label}
        </p>
        <p
          className="text-lg font-semibold font-mono tabular-nums"
          style={{ color: 'var(--color-text-1)' }}
        >
          {value}
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <p
        className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-4"
        style={{ color: 'var(--color-text-3)' }}
      >
        Ultravox Account Usage
      </p>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <SkeletonBox key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 dark:text-red-400 py-4 text-center">
          {error}
        </div>
      ) : !usage ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-3)' }}>
          No usage data available.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {renderMetric(
              'Total Minutes',
              usage.totalMinutes != null
                ? `${parseMinutes(usage.totalMinutes) ?? usage.totalMinutes} min`
                : usage.billedDuration != null
                  ? `${parseMinutes(usage.billedDuration) ?? usage.billedDuration} min`
                  : null
            )}
            {renderMetric('Total Cost', formatCurrency(usage.totalCost ?? usage.cost))}
            {renderMetric(
              'Total Calls',
              usage.totalCalls != null ? String(usage.totalCalls) : null
            )}
            {renderMetric(
              'Free Minutes Used',
              usage.freeMinutesUsed != null
                ? `${parseMinutes(usage.freeMinutesUsed) ?? usage.freeMinutesUsed} min`
                : null
            )}
            {renderMetric(
              'Paid Minutes',
              usage.paidMinutes != null
                ? `${parseMinutes(usage.paidMinutes) ?? usage.paidMinutes} min`
                : null
            )}
            {renderMetric('Period', typeof usage.period === 'string' ? usage.period : null)}
          </div>

          {/* Render any remaining top-level fields as key-value pairs */}
          {(() => {
            const knownKeys = new Set([
              'totalMinutes', 'billedDuration', 'totalCost', 'cost',
              'totalCalls', 'freeMinutesUsed', 'paidMinutes', 'period',
            ])
            const extras = Object.entries(usage).filter(
              ([k]) => !knownKeys.has(k)
            )
            if (extras.length === 0) return null

            return (
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--color-bg-raised)' }}
              >
                <p
                  className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-2"
                  style={{ color: 'var(--color-text-3)' }}
                >
                  Additional Details
                </p>
                <div className="space-y-1">
                  {extras.map(([key, val]) => (
                    <div
                      key={key}
                      className="flex items-baseline justify-between text-xs"
                    >
                      <span
                        className="font-mono"
                        style={{ color: 'var(--color-text-3)' }}
                      >
                        {key}
                      </span>
                      <span
                        className="font-mono text-right ml-4 truncate max-w-[60%]"
                        style={{ color: 'var(--color-text-1)' }}
                      >
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
