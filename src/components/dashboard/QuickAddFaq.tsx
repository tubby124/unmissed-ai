'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'

interface QuickAddFaqProps {
  clientId: string
  topics: string[]
  transcript: Array<{ role: string; text: string }> | null
}

interface FaqItem {
  q: string
  a: string
}

function findRelevantQuestion(topic: string, transcript: Array<{ role: string; text: string }> | null): string {
  if (!transcript || transcript.length === 0) return topic
  // Search transcript for a caller question mentioning this topic
  const topicLower = topic.toLowerCase()
  for (const msg of transcript) {
    if (msg.role !== 'user') continue
    const text = msg.text.toLowerCase()
    if (text.includes(topicLower) && text.length < 200) {
      return msg.text
    }
  }
  // Also try partial word match
  const words = topicLower.split(/\s+/).filter(w => w.length > 3)
  for (const msg of transcript) {
    if (msg.role !== 'user') continue
    const text = msg.text.toLowerCase()
    if (words.some(w => text.includes(w)) && msg.text.includes('?')) {
      return msg.text
    }
  }
  return topic
}

export default function QuickAddFaq({ clientId, topics, transcript }: QuickAddFaqProps) {
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [addedTopics, setAddedTopics] = useState<Set<string>>(new Set())

  function handleExpand(topic: string) {
    if (expandedTopic === topic) {
      setExpandedTopic(null)
      setQuestion('')
      setAnswer('')
      return
    }
    setExpandedTopic(topic)
    setQuestion(findRelevantQuestion(topic, transcript))
    setAnswer('')
  }

  async function handleSave() {
    if (!question.trim() || !answer.trim() || saving) return
    setSaving(true)

    try {
      // Fetch current extra_qa from Supabase
      const supabase = createBrowserClient()
      const { data: row, error: fetchErr } = await supabase
        .from('clients')
        .select('extra_qa')
        .eq('id', clientId)
        .single()

      if (fetchErr) throw new Error('Failed to load current FAQs')

      const currentQa: FaqItem[] = Array.isArray(row?.extra_qa) ? (row.extra_qa as FaqItem[]) : []
      const newQa = [...currentQa, { q: question.trim(), a: answer.trim() }]

      // PATCH settings with the updated extra_qa
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, extra_qa: newQa }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to save FAQ' }))
        throw new Error(data.error ?? 'Failed to save FAQ')
      }

      toast.success('FAQ added — your agent will know this on every call')
      setAddedTopics(prev => new Set(prev).add(expandedTopic!))
      setExpandedTopic(null)
      setQuestion('')
      setAnswer('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save FAQ'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const remainingTopics = topics.filter(t => !addedTopics.has(t))

  if (remainingTopics.length === 0 && addedTopics.size > 0) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-2 t3">
          Add to your agent&apos;s knowledge
        </p>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-xs text-green-400">All topics added as FAQs</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-3 t3">
        Add to your agent&apos;s knowledge
      </p>
      <p className="text-[11px] mb-3" style={{ color: 'var(--color-text-3)' }}>
        Topics from this call. Add answers so your agent knows them next time.
      </p>

      <div className="flex flex-wrap gap-2">
        {topics.map(topic => {
          const isAdded = addedTopics.has(topic)
          const isExpanded = expandedTopic === topic

          return (
            <div key={topic} className={isExpanded ? 'w-full' : ''}>
              {isAdded ? (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border"
                  style={{ color: 'var(--color-text-3)', borderColor: 'var(--color-border)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {topic}
                  <span className="text-[10px] text-green-400">Added</span>
                </span>
              ) : (
                <button
                  onClick={() => handleExpand(topic)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors cursor-pointer"
                  style={{
                    color: isExpanded ? 'var(--color-text-1)' : 'var(--color-text-2)',
                    backgroundColor: isExpanded ? 'rgba(99,102,241,0.05)' : 'transparent',
                    borderColor: isExpanded ? 'rgba(99,102,241,0.25)' : 'var(--color-border)',
                  }}
                >
                  {topic}
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'rgba(99,102,241,0.1)',
                      color: 'rgb(129,140,248)',
                      border: '1px solid rgba(99,102,241,0.2)',
                    }}
                  >
                    {isExpanded ? 'Cancel' : 'Add as FAQ'}
                  </span>
                </button>
              )}

              {/* Inline form */}
              {isExpanded && (
                <div
                  className="mt-2 rounded-xl border p-3 space-y-2"
                  style={{ borderColor: 'rgba(99,102,241,0.15)', backgroundColor: 'rgba(99,102,241,0.02)' }}
                >
                  <div>
                    <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--color-text-3)' }}>
                      Question
                    </label>
                    <input
                      type="text"
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      className="w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500/50 transition-colors"
                      style={{
                        backgroundColor: 'transparent',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-1)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--color-text-3)' }}>
                      Answer
                    </label>
                    <textarea
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      placeholder="Type the answer your agent should give..."
                      rows={2}
                      className="w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500/50 resize-none transition-colors"
                      style={{
                        backgroundColor: 'transparent',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-1)',
                      }}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setExpandedTopic(null); setQuestion(''); setAnswer('') }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                      style={{ color: 'var(--color-text-3)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !question.trim() || !answer.trim()}
                      className="px-4 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {saving ? 'Saving...' : 'Save as FAQ'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
