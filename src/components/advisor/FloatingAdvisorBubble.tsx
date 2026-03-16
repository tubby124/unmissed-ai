'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ChatView from './ChatView'
import ModelPicker from './ModelPicker'
import CreditDisplay from './CreditDisplay'

interface FloatingAdvisorBubbleProps {
  isAdmin: boolean
}

const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free'
const LS_KEY = 'advisor_model'

function getStoredModel(): string {
  if (typeof window === 'undefined') return DEFAULT_MODEL
  try {
    return localStorage.getItem(LS_KEY) || DEFAULT_MODEL
  } catch {
    return DEFAULT_MODEL
  }
}

export default function FloatingAdvisorBubble({ isAdmin }: FloatingAdvisorBubbleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messageCount, setMessageCount] = useState(0)
  const [hasPulsed, setHasPulsed] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    setSelectedModel(getStoredModel())
  }, [])

  useEffect(() => {
    if (!hasPulsed) {
      const timer = setTimeout(() => setHasPulsed(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [hasPulsed])

  const handleModelChange = useCallback((id: string) => {
    setSelectedModel(id)
    try {
      localStorage.setItem(LS_KEY, id)
    } catch {
      // localStorage unavailable
    }
  }, [])

  const handleConversationCreated = useCallback((id: string) => {
    setConversationId(id)
  }, [])

  const handleMessageCountChange = useCallback((count: number) => {
    setMessageCount(count)
  }, [])

  // Suppress unused variable warning while keeping prop available
  void isAdmin
  void messageCount

  return (
    <>
      {/* Panel overlay */}
      <div
        ref={panelRef}
        className={`fixed z-50 transition-all duration-200 ease-out ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
        style={{
          bottom: '5.5rem',
          right: '1.5rem',
          width: '400px',
          height: '500px',
          maxWidth: 'calc(100vw - 2rem)',
          maxHeight: 'calc(100vh - 8rem)',
        }}
      >
        <div
          className="flex flex-col h-full rounded-2xl overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span
                className="text-sm font-semibold text-amber-600 dark:text-amber-400"
              >
                Advisor
              </span>
              <div className="flex-1 min-w-0">
                <ModelPicker value={selectedModel} onChange={handleModelChange} />
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--color-hover)] transition-colors"
              style={{ color: 'var(--color-text-3)' }}
              aria-label="Close advisor"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Credit display */}
          <div
            className="px-4 py-1.5 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <CreditDisplay />
          </div>

          {/* Chat area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatView
              conversationId={conversationId}
              onConversationCreated={handleConversationCreated}
              onMessageCountChange={handleMessageCountChange}
              selectedModel={selectedModel}
            />
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2 flex-shrink-0"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <button
              onClick={() => {
                setIsOpen(false)
                router.push('/dashboard/advisor')
              }}
              className="text-xs flex items-center gap-1 hover:opacity-80 transition-opacity text-amber-600 dark:text-amber-400"
            >
              Open full page
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M7 17l9.2-9.2M17 17V7.8H7.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Floating bubble button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`fixed z-50 bottom-6 right-6 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 ${
          isOpen ? 'rotate-0' : ''
        }`}
        style={{
          backgroundColor: 'rgb(217 119 6)',
          boxShadow: hasPulsed
            ? '0 4px 14px rgba(217, 119, 6, 0.4)'
            : undefined,
          animation: hasPulsed ? undefined : 'advisor-pulse 1.5s ease-in-out infinite',
        }}
        aria-label={isOpen ? 'Close advisor' : 'Open advisor'}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="10" r="1" fill="white" />
            <circle cx="12" cy="10" r="1" fill="white" />
            <circle cx="15" cy="10" r="1" fill="white" />
          </svg>
        )}
      </button>

      {/* Pulse animation */}
      <style>{`
        @keyframes advisor-pulse {
          0%, 100% {
            box-shadow: 0 4px 14px rgba(217, 119, 6, 0.4);
          }
          50% {
            box-shadow: 0 4px 24px rgba(217, 119, 6, 0.7), 0 0 40px rgba(217, 119, 6, 0.3);
          }
        }
      `}</style>
    </>
  )
}
