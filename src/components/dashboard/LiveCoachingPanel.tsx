'use client'

import { useState, useEffect, useCallback } from 'react'

interface CoachingMessage {
  id: string
  message: string
  status: 'pending' | 'delivered'
  created_at: string
  delivered_at: string | null
}

interface LiveCoachingPanelProps {
  callLogId: string
  ultravoxCallId: string
  clientId?: string
  isAdmin: boolean
}

export default function LiveCoachingPanel({
  callLogId,
  ultravoxCallId,
  clientId,
  isAdmin,
}: LiveCoachingPanelProps) {
  const [messages, setMessages] = useState<CoachingMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendCoaching = useCallback(async () => {
    if (!input.trim()) return
    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/dashboard/coaching/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_log_id: callLogId,
          ultravox_call_id: ultravoxCallId,
          message: input.trim(),
          ...(isAdmin && clientId ? { client_id: clientId } : {}),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      setMessages((prev) => [...prev, { ...data.coaching, message: input.trim() }])
      setInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }, [input, callLogId, ultravoxCallId, clientId, isAdmin])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendCoaching()
    }
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
        className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-4"
        style={{ color: 'var(--color-text-3)' }}
      >
        Live Coaching
      </p>

      {messages.length > 0 && (
        <div className="space-y-2 mb-4 max-h-[240px] overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="rounded-xl px-3 py-2"
              style={{ backgroundColor: 'var(--color-bg-raised)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    msg.status === 'delivered'
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                  }`}
                >
                  {msg.status === 'delivered' ? 'Delivered' : 'Pending'}
                </span>
                <span
                  className="text-[10px] font-mono"
                  style={{ color: 'var(--color-text-3)' }}
                >
                  {new Date(msg.created_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-1)' }}>
                {msg.message}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type coaching message for the agent..."
          rows={2}
          className="flex-1 rounded-xl border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-surface b-theme t1 placeholder:text-zinc-400"
        />
        <button
          type="button"
          onClick={sendCoaching}
          disabled={sending || !input.trim()}
          className="self-end rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}
    </div>
  )
}
