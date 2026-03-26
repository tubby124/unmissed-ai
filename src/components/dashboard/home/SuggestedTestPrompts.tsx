'use client'

/**
 * SuggestedTestPrompts — AC-5
 *
 * Shows 2-3 context-aware prompts derived from live client config.
 * Only visible when homePhase === 'trial_active' AND ≤1 test calls.
 * No new API call — all derived from editableFields passed from ClientHome.
 */

interface SuggestedTestPromptsProps {
  hasHours: boolean
  hasFaqs: boolean
  hasTransfer: boolean
  firstFaqQuestion: string | null
  onPromptClick?: (prompt: string) => void
}

export default function SuggestedTestPrompts({
  hasHours,
  hasFaqs,
  hasTransfer,
  firstFaqQuestion,
  onPromptClick,
}: SuggestedTestPromptsProps) {
  const prompts: string[] = []

  if (hasHours) {
    prompts.push('Ask: What are your hours on Saturday?')
  }
  if (hasFaqs && firstFaqQuestion) {
    const truncated = firstFaqQuestion.length > 60 ? firstFaqQuestion.slice(0, 57) + '…' : firstFaqQuestion
    prompts.push(`Ask: ${truncated}`)
  }
  if (hasTransfer) {
    prompts.push('Ask: Can I speak to someone?')
  }

  // Fallbacks if no configured knowledge
  if (prompts.length === 0) {
    prompts.push('Ask: What services do you offer?')
    prompts.push('Ask: How do I get a quote?')
  }

  // Show max 3
  const visible = prompts.slice(0, 3)

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((prompt, i) => (
        <button
          key={i}
          onClick={() => onPromptClick?.(prompt)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
          style={{
            background: 'var(--color-accent-tint)',
            color: 'var(--color-primary)',
            border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {prompt}
        </button>
      ))}
    </div>
  )
}
