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

function buildTranscriptContext(topic: string, transcript: Array<{ role: string; text: string }> | null): string {
  if (!transcript || transcript.length === 0) return ''
  const topicLower = topic.toLowerCase()
  const words = topicLower.split(/\s+/).filter(w => w.length > 3)
  // Find up to 4 lines near where the topic was discussed
  const lines: string[] = []
  for (let i = 0; i < transcript.length; i++) {
    const msg = transcript[i]
    const text = msg.text.toLowerCase()
    if (text.includes(topicLower) || words.some(w => text.includes(w))) {
      // Include 1 line before and after for context
      const start = Math.max(0, i - 1)
      const end = Math.min(transcript.length - 1, i + 1)
      for (let j = start; j <= end; j++) {
        const label = transcript[j].role === 'user' ? 'Caller' : 'Agent'
        const line = `${label}: ${transcript[j].text.slice(0, 150)}`
        if (!lines.includes(line)) lines.push(line)
      }
      if (lines.length >= 6) break
    }
  }
  return lines.join('\n')
}

export default function QuickAddFaq({ clientId, topics, transcript }: QuickAddFaqProps) {
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [aiSuggested, setAiSuggested] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addedTopics, setAddedTopics] = useState<Set<string>>(new Set())

  async function handleExpand(topic: string) {
    if (expandedTopic === topic) {
      setExpandedTopic(null)
      setQuestion('')
      setAnswer('')
      setAiSuggested(false)
      return
    }
    setExpandedTopic(topic)
    setQuestion(findRelevantQuestion(topic, transcript))
    setAnswer('')
    setAiSuggested(false)

    // Fire AI suggestion immediately
    setSuggesting(true)
    try {
      const transcriptContext = buildTranscriptContext(topic, transcript)
      const res = await fetch('/api/dashboard/knowledge/suggest-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          client_id: clientId,
          transcript_context: transcriptContext || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json() as { answer?: string }
        if (data.answer) {
          setAnswer(data.answer)
          setAiSuggested(true)
        }
      }
    } catch {
      // Non-fatal — user can still type their own answer
    } finally {
      setSuggesting(false)
    }
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
      setAiSuggested(false)
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-semibold" style={{ color: 'var(--color-text-3)' }}>
                        Answer
                      </label>
                      {suggesting && (
                        <span className="text-[10px] flex items-center gap-1" style={{ color: 'rgb(129,140,248)' }}>
                          <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          AI writing suggestion…
                        </span>
                      )}
                      {!suggesting && aiSuggested && (
                        <span className="text-[10px]" style={{ color: 'rgb(129,140,248)' }}>
                          AI suggested · edit if needed
                        </span>
                      )}
                    </div>
                    <textarea
                      value={suggesting ? '' : answer}
                      onChange={e => { setAnswer(e.target.value); setAiSuggested(false) }}
                      placeholder={suggesting ? 'Generating suggestion…' : 'Type the answer your agent should give...'}
                      disabled={suggesting}
                      rows={3}
                      className="w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500/50 resize-none transition-colors disabled:opacity-50"
                      style={{
                        backgroundColor: 'transparent',
                        borderColor: aiSuggested && !suggesting ? 'rgba(99,102,241,0.3)' : 'var(--color-border)',
                        color: 'var(--color-text-1)',
                      }}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setExpandedTopic(null); setQuestion(''); setAnswer(''); setAiSuggested(false) }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                      style={{ color: 'var(--color-text-3)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || suggesting || !question.trim() || !answer.trim()}
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
