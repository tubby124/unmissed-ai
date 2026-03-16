'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import InsightCards from '@/components/advisor/InsightCards'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

interface ChatViewProps {
  conversationId: string | null
  onConversationCreated: (id: string) => void
  onMessageCountChange: (count: number) => void
  selectedModel: string
  isFullPage?: boolean
}

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre style="background-color:var(--color-bg-raised);border:1px solid var(--color-border);border-radius:6px;padding:12px;overflow-x:auto;margin:8px 0;font-size:13px"><code>${code.trim()}</code></pre>`
  })

  html = html.replace(/`([^`]+)`/g, '<code style="background-color:var(--color-bg-raised);padding:1px 5px;border-radius:3px;font-size:13px">$1</code>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\n/g, '<br/>')

  return html
}

export default function ChatView({
  conversationId,
  onConversationCreated,
  onMessageCountChange,
  selectedModel,
  isFullPage = false,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<{ type: string; suggestedModel?: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const currentConvIdRef = useRef<string | null>(conversationId)

  useEffect(() => {
    currentConvIdRef.current = conversationId
  }, [conversationId])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    onMessageCountChange(messages.length)
  }, [messages.length, onMessageCountChange])

  useEffect(() => {
    if (!conversationId) return
    let cancelled = false

    async function loadMessages() {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token || cancelled) return

      try {
        const res = await fetch(`/api/advisor/conversations?id=${conversationId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled && data.messages) {
          setMessages(data.messages.map((m: Message) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
          })))
        }
      } catch {
        // silently fail on load error
      }
    }

    loadMessages()
    return () => { cancelled = true }
  }, [conversationId])

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text || isStreaming) return

    setInput('')
    setError(null)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])

    setIsStreaming(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError({ type: 'unauthorized' })
        setIsStreaming(false)
        setMessages(prev => prev.slice(0, -1))
        return
      }

      const res = await fetch('/api/advisor/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversationId: currentConvIdRef.current,
          message: text,
          model: selectedModel,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const errType = errData.error || 'unknown'

        if (errType === 'rate_limited') {
          setError({ type: 'rate_limited', suggestedModel: errData.suggestedModel })
        } else if (errType === 'insufficient_credits') {
          setError({ type: 'insufficient_credits' })
        } else if (errType === 'model_unavailable') {
          setError({ type: 'model_unavailable' })
        } else {
          setError({ type: errType })
        }

        setMessages(prev => prev.slice(0, -1))
        setIsStreaming(false)
        return
      }

      const newConvId = res.headers.get('X-Conversation-Id')
      if (newConvId && !currentConvIdRef.current) {
        currentConvIdRef.current = newConvId
        onConversationCreated(newConvId)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              accumulated += delta
              const snapshot = accumulated
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: snapshot }
                return updated
              })
            }
          } catch {
            // skip malformed chunk
          }
        }
      }
    } catch {
      setError({ type: 'network_error' })
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming, selectedModel, onConversationCreated])

  const handleSubmit = useCallback(() => {
    sendMessage(input.trim())
  }, [input, sendMessage])

  const handleInsightPrompt = useCallback((prompt: string) => {
    sendMessage(prompt)
  }, [sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const errorMessage = error
    ? error.type === 'rate_limited'
      ? 'Rate limited by the model provider. Wait a moment or try a different model.'
      : error.type === 'insufficient_credits'
        ? 'Not enough credits. Switch to a free model or top up.'
        : error.type === 'model_unavailable'
          ? 'This model is temporarily unavailable. Try another one.'
          : `Something went wrong (${error.type}).`
    : null

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      {/* Messages area */}
      <div className={`flex-1 overflow-y-auto px-4 ${isFullPage ? 'py-6' : 'py-3'}`}>
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <InsightCards onSelectPrompt={handleInsightPrompt} />
          </div>
        )}

        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'
                }`}
                style={
                  msg.role === 'user'
                    ? {
                        backgroundColor: 'var(--color-bg-raised)',
                        color: 'var(--color-text-1)',
                        border: '1px solid var(--color-border)',
                      }
                    : {
                        color: 'var(--color-text-1)',
                      }
                }
              >
                {msg.role === 'user' ? (
                  <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                ) : (
                  <span
                    className="advisor-markdown"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                )}
                {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && (
                  <span
                    className="inline-block w-1.5 h-4 ml-0.5 align-middle"
                    style={{
                      backgroundColor: 'rgb(217 119 6)',
                      animation: 'advisor-cursor-blink 0.8s step-end infinite',
                    }}
                  />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error toast */}
      {errorMessage && (
        <div
          className="mx-4 mb-2 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
          style={{
            backgroundColor: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-2)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10" stroke="rgb(217 119 6)" strokeWidth="1.5" />
            <path d="M12 8v4M12 16h.01" stroke="rgb(217 119 6)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{errorMessage}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs hover:opacity-80"
            style={{ color: 'var(--color-text-3)' }}
          >
            dismiss
          </button>
        </div>
      )}

      {/* Input area */}
      <div
        className="px-4 py-3"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <div
          className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{
            backgroundColor: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              resizeTextarea()
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent resize-none text-sm outline-none placeholder:opacity-50"
            style={{
              color: 'var(--color-text-1)',
              maxHeight: '120px',
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={isStreaming || !input.trim()}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-30"
            style={{ backgroundColor: 'rgb(217 119 6)' }}
            aria-label="Send message"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Cursor blink animation */}
      <style>{`
        @keyframes advisor-cursor-blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
