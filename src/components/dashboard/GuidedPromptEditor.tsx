'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface PromptSection {
  id: string
  title: string
  headerLine: string
  content: string
}

interface GuidedPromptEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const SECTION_EXPLANATIONS: Record<string, string> = {
  'IDENTITY': "Your agent's name, role, and the business they represent",
  'GREETING': 'How your agent opens each call',
  'VOICE NATURALNESS': 'Speech patterns that make your agent sound human',
  'BUSINESS KNOWLEDGE': 'Hours, services, location, and other business details',
  'FAQ': 'Common questions and prepared answers',
  'CALL HANDLING': 'How calls are triaged and what info is collected',
  'AFTER-HOURS': 'Behavior outside business hours',
  'AFTER HOURS': 'Behavior outside business hours',
  'CLOSE': 'How your agent wraps up and says goodbye',
  'CLOSING': 'How your agent wraps up and says goodbye',
  'GOODBYE': 'How your agent wraps up and says goodbye',
  'RESTRICTIONS': 'Topics or actions your agent should avoid',
  'TONE AND STYLE': 'The personality, pacing, and speaking style of your agent',
  'TONE & STYLE': 'The personality, pacing, and speaking style of your agent',
  'GOAL': 'The primary objective your agent tries to accomplish on each call',
  'DYNAMIC CONVERSATION FLOW': 'The step-by-step call routing logic',
  'TRIAGE': 'How calls are classified by urgency and type',
  'INFO COLLECTION': 'What information your agent gathers from callers',
  'ESCALATION AND CONFUSION HANDLING': 'How your agent handles requests for a human or confused callers',
  'VEHICLE DETAILS': 'Vehicle information collection flow',
  'SCHEDULING': 'Appointment and scheduling logic',
  'INLINE EXAMPLES': 'Example conversations that guide agent behavior',
  'ABSOLUTE FORBIDDEN ACTIONS': 'Hard rules your agent must never break',
  'LIFE SAFETY EMERGENCY OVERRIDE': 'Emergency 911 routing that overrides all other rules',
  'COMPLETION CHECK': 'Required info verification before ending a call',
}

function getExplanation(title: string): string | null {
  const upper = title.toUpperCase().replace(/^#+\s*/, '').replace(/\d+\.\s*/, '').trim()
  if (SECTION_EXPLANATIONS[upper]) return SECTION_EXPLANATIONS[upper]
  for (const [key, val] of Object.entries(SECTION_EXPLANATIONS)) {
    if (upper.includes(key)) return val
  }
  return null
}

function parsePromptSections(prompt: string): PromptSection[] {
  const lines = prompt.split('\n')
  const sections: PromptSection[] = []
  let currentSection: PromptSection | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    const isMarkdownHeader = /^#{1,3}\s+\S/.test(trimmed)
    const isUppercaseHeader = /^[A-Z][A-Z &/\-—()]{3,}$/.test(trimmed) && trimmed.length >= 4

    if (isMarkdownHeader || isUppercaseHeader) {
      if (currentSection) {
        currentSection.content = currentSection.content.replace(/\n+$/, '')
        sections.push(currentSection)
      }
      const title = trimmed.replace(/^#+\s*/, '')
      currentSection = {
        id: `section-${i}`,
        title,
        headerLine: trimmed,
        content: '',
      }
    } else if (currentSection) {
      currentSection.content += (currentSection.content ? '\n' : '') + line
    } else if (trimmed || sections.length === 0) {
      currentSection = {
        id: 'section-preamble',
        title: 'Preamble',
        headerLine: '',
        content: line,
      }
    }
  }

  if (currentSection) {
    currentSection.content = currentSection.content.replace(/\n+$/, '')
    sections.push(currentSection)
  }

  return sections
}

function reconstructPrompt(sections: PromptSection[]): string {
  return sections
    .map(s => {
      if (s.headerLine) {
        return s.headerLine + '\n' + s.content
      }
      return s.content
    })
    .join('\n\n')
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className={`text-zinc-400 transition-transform duration-200 shrink-0 ${collapsed ? '' : 'rotate-180'}`}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function GuidedPromptEditor({ value, onChange, placeholder }: GuidedPromptEditorProps) {
  const [advancedMode, setAdvancedMode] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  const sections = useMemo(() => parsePromptSections(value), [value])

  const toggleSection = useCallback((id: string) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const updateSection = useCallback((sectionId: string, newContent: string) => {
    const updated = sections.map(s =>
      s.id === sectionId ? { ...s, content: newContent } : s
    )
    onChange(reconstructPrompt(updated))
  }, [sections, onChange])

  const collapseAll = useCallback(() => {
    const allCollapsed: Record<string, boolean> = {}
    sections.forEach(s => { allCollapsed[s.id] = true })
    setCollapsedSections(allCollapsed)
  }, [sections])

  const expandAll = useCallback(() => {
    setCollapsedSections({})
  }, [])

  if (!value.trim()) {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-[480px] bg-black/20 border b-theme rounded-xl p-4 text-sm t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
        spellCheck={false}
        placeholder={placeholder}
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* Mode toggle + bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdvancedMode(false)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              !advancedMode
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'bg-hover t3 border b-theme hover:t2'
            }`}
          >
            Guided
          </button>
          <button
            onClick={() => setAdvancedMode(true)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              advancedMode
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'bg-hover t3 border b-theme hover:t2'
            }`}
          >
            Advanced
          </button>
        </div>
        {!advancedMode && sections.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="px-2 py-1 rounded text-[10px] t3 hover:t2 transition-colors"
            >
              Expand all
            </button>
            <span className="text-[10px] t3">|</span>
            <button
              onClick={collapseAll}
              className="px-2 py-1 rounded text-[10px] t3 hover:t2 transition-colors"
            >
              Collapse all
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {advancedMode ? (
          <motion.div
            key="advanced"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <textarea
              value={value}
              onChange={e => onChange(e.target.value)}
              className="w-full h-[480px] bg-black/20 border b-theme rounded-xl p-4 text-sm t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
              spellCheck={false}
              placeholder={placeholder}
            />
          </motion.div>
        ) : (
          <motion.div
            key="guided"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="space-y-2"
          >
            {sections.map((section) => {
              const isCollapsed = collapsedSections[section.id] ?? false
              const explanation = getExplanation(section.title)
              const lineCount = section.content.split('\n').length

              return (
                <div
                  key={section.id}
                  className={`rounded-xl border transition-colors overflow-hidden ${
                    isCollapsed
                      ? 'border-zinc-700/50 bg-white/[0.01]'
                      : 'border-zinc-600/40 bg-white/[0.02]'
                  }`}
                >
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold t1 truncate">
                          {section.title}
                        </span>
                        {isCollapsed && (
                          <span className="text-[10px] t3 tabular-nums shrink-0">
                            {lineCount} line{lineCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {explanation && (
                        <p className="text-[10px] t3 mt-0.5 truncate">
                          {explanation}
                        </p>
                      )}
                    </div>
                    <ChevronIcon collapsed={isCollapsed} />
                  </button>

                  {/* Section content */}
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        key={`content-${section.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="px-4 pb-3 border-t border-zinc-700/30">
                          <textarea
                            value={section.content}
                            onChange={e => updateSection(section.id, e.target.value)}
                            className="w-full bg-black/20 border b-theme rounded-lg p-3 text-sm t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed mt-3"
                            spellCheck={false}
                            rows={Math.min(Math.max(lineCount + 1, 3), 20)}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
