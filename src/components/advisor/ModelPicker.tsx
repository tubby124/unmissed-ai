'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  AI_MODELS,
  TIER_LABELS,
  TIER_ORDER,
  type ModelTier,
  type AIModel,
  getModelById,
  getClientCostPer1k,
} from '@/lib/ai-models'

interface ModelPickerProps {
  value: string
  onChange: (modelId: string) => void
}

function getModelsByTier(tier: ModelTier): AIModel[] {
  return AI_MODELS.filter((m) => m.tier === tier)
}

export default function ModelPicker({ value, onChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = getModelById(value)

  const handleSelect = useCallback(
    (modelId: string) => {
      onChange(modelId)
      localStorage.setItem('advisor_model', modelId)
      setOpen(false)
    },
    [onChange]
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-[var(--color-hover)]"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-1)',
        }}
      >
        <span className="font-medium">{selected?.name ?? 'Select model'}</span>
        {selected && (
          <span
            className="rounded px-1.5 py-0.5 text-xs"
            style={{
              backgroundColor: 'var(--color-bg-raised)',
              color: 'var(--color-text-3)',
            }}
          >
            {selected.provider}
          </span>
        )}
        <svg
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--color-text-3)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-lg border shadow-lg"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="max-h-96 overflow-y-auto py-1">
            {TIER_ORDER.map((tier) => {
              const models = getModelsByTier(tier)
              if (models.length === 0) return null
              return (
                <div key={tier}>
                  <div
                    className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-3)' }}
                  >
                    {TIER_LABELS[tier]}
                  </div>
                  {models.map((model) => {
                    const isSelected = model.id === value
                    const isFree = model.costPer1kTokens === 0
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleSelect(model.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-hover)]"
                        style={{ color: 'var(--color-text-1)' }}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate font-medium">
                            {model.name}
                          </span>
                          {model.isChineseInfra && (
                            <span className="shrink-0 text-xs" title="Chinese infrastructure">
                              🇨🇳
                            </span>
                          )}
                          <span
                            className="shrink-0 rounded px-1.5 py-0.5 text-xs"
                            style={{
                              backgroundColor: 'var(--color-bg-raised)',
                              color: 'var(--color-text-3)',
                            }}
                          >
                            {model.provider}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {isFree ? (
                            <span className="rounded px-1.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30">
                              Free
                            </span>
                          ) : (() => {
                            const clientCost = getClientCostPer1k(model)
                            return (
                              <span
                                className="text-xs"
                                style={{ color: 'var(--color-text-3)' }}
                              >
                                {clientCost < 1
                                  ? `${clientCost.toFixed(1)}¢/1k`
                                  : `${clientCost.toFixed(0)}¢/1k`}
                              </span>
                            )
                          })()}
                          {isSelected && (
                            <svg
                              className="h-4 w-4 text-amber-600 dark:text-amber-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
