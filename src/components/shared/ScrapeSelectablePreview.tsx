'use client'

import { useState } from 'react'

export interface ScrapeSelectablePreviewProps {
  facts: string[]
  qa: { q: string; a: string }[]
  selectedFacts: Set<number>
  selectedQa: Set<number>
  onToggleFact: (i: number) => void
  onToggleQa: (i: number) => void
}

/**
 * Shared selectable preview for scrape results.
 * Used in both WebsiteKnowledgeCard (dashboard) and WebsiteScrapePreview (onboarding).
 */
export function ScrapeSelectablePreview({
  facts,
  qa,
  selectedFacts,
  selectedQa,
  onToggleFact,
  onToggleQa,
}: ScrapeSelectablePreviewProps) {
  const [expanded, setExpanded] = useState(true)
  const allFactsSelected = facts.every((_, i) => selectedFacts.has(i))
  const allQaSelected = qa.every((_, i) => selectedQa.has(i))

  return (
    <div className="mb-2 rounded-xl border b-theme overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] t3 hover:t1 text-left transition-colors"
        type="button"
      >
        <span className="font-medium">
          Select items to add
          <span className="ml-1.5 t3 font-normal">
            ({selectedFacts.size + selectedQa.size} of {facts.length + qa.length} selected)
          </span>
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          className={`transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t b-theme space-y-3">
          {facts.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] t3">
                  Facts ({facts.length})
                </p>
                <button
                  type="button"
                  className="text-[9px] t3 hover:t1 underline underline-offset-2"
                  onClick={() => {
                    if (allFactsSelected) {
                      facts.forEach((_, i) => { if (selectedFacts.has(i)) onToggleFact(i) })
                    } else {
                      facts.forEach((_, i) => { if (!selectedFacts.has(i)) onToggleFact(i) })
                    }
                  }}
                >
                  {allFactsSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <ul className="space-y-1">
                {facts.map((f, i) => (
                  <li key={i}>
                    <label className="flex gap-2 items-start cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedFacts.has(i)}
                        onChange={() => onToggleFact(i)}
                        className="mt-[3px] shrink-0 accent-[var(--color-primary)]"
                      />
                      <span className={`text-[10px] leading-relaxed transition-colors ${selectedFacts.has(i) ? 't2' : 't3 line-through opacity-50'}`}>
                        {f}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {qa.length > 0 && (
            <div className={facts.length > 0 ? 'pt-1 border-t b-theme' : 'pt-2'}>
              <div className="flex items-center justify-between mb-1.5 pt-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] t3">
                  Q&amp;A ({qa.length})
                </p>
                <button
                  type="button"
                  className="text-[9px] t3 hover:t1 underline underline-offset-2"
                  onClick={() => {
                    if (allQaSelected) {
                      qa.forEach((_, i) => { if (selectedQa.has(i)) onToggleQa(i) })
                    } else {
                      qa.forEach((_, i) => { if (!selectedQa.has(i)) onToggleQa(i) })
                    }
                  }}
                >
                  {allQaSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <ul className="space-y-2">
                {qa.map((item, i) => (
                  <li key={i}>
                    <label className="flex gap-2 items-start cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedQa.has(i)}
                        onChange={() => onToggleQa(i)}
                        className="mt-[3px] shrink-0 accent-[var(--color-primary)]"
                      />
                      <div className={`text-[10px] leading-relaxed transition-colors ${selectedQa.has(i) ? '' : 'opacity-50'}`}>
                        <p className={`font-medium ${selectedQa.has(i) ? 't1' : 't3 line-through'}`}>{item.q}</p>
                        <p className="t3 mt-0.5">{item.a}</p>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
