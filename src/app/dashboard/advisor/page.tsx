'use client'

import { useState, useCallback } from 'react'
import HistorySidebar from '@/components/advisor/HistorySidebar'
import ChatView from '@/components/advisor/ChatView'
import ModelPicker from '@/components/advisor/ModelPicker'
import CreditDisplay from '@/components/advisor/CreditDisplay'
import ConversationLimitBanner from '@/components/advisor/ConversationLimitBanner'
import ChineseInfraNotice from '@/components/advisor/ChineseInfraNotice'
import { createBrowserClient } from '@/lib/supabase/client'
import { DEFAULT_MODEL_ID } from '@/lib/advisor-constants'

export default function AdvisorPage() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('advisor_model') || DEFAULT_MODEL_ID
    }
    return DEFAULT_MODEL_ID
  })
  const [messageCount, setMessageCount] = useState(0)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [sidebarKey, setSidebarKey] = useState(0)

  const handleModelChange = useCallback((id: string) => {
    setSelectedModel(id)
    if (typeof window !== 'undefined') {
      localStorage.setItem('advisor_model', id)
    }
  }, [])

  const handleNewConversation = useCallback(() => {
    setConversationId(null)
    setMessageCount(0)
  }, [])

  const handleConversationCreated = useCallback((id: string) => {
    setConversationId(id)
    setSidebarKey(k => k + 1)
  }, [])

  const handleSummarize = useCallback(async () => {
    if (!conversationId) return
    setIsSummarizing(true)
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/advisor/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ conversationId }),
      })
      if (res.ok) {
        const { newConversationId } = await res.json()
        setConversationId(newConversationId)
        setMessageCount(1)
        setSidebarKey(k => k + 1)
      }
    } catch (err) {
      console.error('[advisor] summarize failed:', err)
    } finally {
      setIsSummarizing(false)
    }
  }, [conversationId])

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-screen">
      {/* Sidebar — hidden on mobile */}
      <div
        className="hidden md:flex w-72 shrink-0 flex-col border-r"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <HistorySidebar
          key={sidebarKey}
          activeConversationId={conversationId}
          onSelectConversation={setConversationId}
          onNewConversation={handleNewConversation}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-1)' }}>
              Advisor
            </h1>
            <ModelPicker value={selectedModel} onChange={handleModelChange} />
          </div>
          <CreditDisplay />
        </div>

        {/* Chinese infra notice */}
        <ChineseInfraNotice modelId={selectedModel} />

        {/* Conversation limit banner */}
        <ConversationLimitBanner
          messageCount={messageCount}
          onSummarize={handleSummarize}
          isSummarizing={isSummarizing}
        />

        {/* Chat */}
        <div className="flex-1 min-h-0">
          <ChatView
            conversationId={conversationId}
            onConversationCreated={handleConversationCreated}
            onMessageCountChange={setMessageCount}
            selectedModel={selectedModel}
            isFullPage
          />
        </div>
      </div>
    </div>
  )
}
