'use client'

import { useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { ConfigRow } from './shared'
import { KNOWN_VOICES } from './constants'

interface AgentConfigCardProps {
  clientId: string
  isAdmin: boolean
  agentVoiceId: string | null
  ultravoxAgentId: string | null
  telegramChatId: string | null
}

export default function AgentConfigCard({
  clientId,
  isAdmin,
  agentVoiceId,
  ultravoxAgentId,
  telegramChatId,
}: AgentConfigCardProps) {
  const [syncing, setSyncing] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'ok' | 'error'>('idle')
  const [syncError, setSyncError] = useState('')

  const voiceName = agentVoiceId ? (KNOWN_VOICES[agentVoiceId] ?? null) : null

  const syncAgent = useCallback(async () => {
    setSyncing(true)
    setSyncState('idle')
    setSyncError('')
    const body: Record<string, unknown> = {}
    if (isAdmin) body.client_id = clientId
    try {
      const res = await fetch('/api/dashboard/settings/sync-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSyncState('ok')
        setTimeout(() => setSyncState('idle'), 3000)
      } else {
        setSyncState('error')
        setSyncError(data.error || 'Sync failed')
      }
    } catch {
      setSyncState('error')
      setSyncError('Network error')
    }
    setSyncing(false)
  }, [clientId, isAdmin])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.12 }}
    >
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Agent Configuration</p>
        <p className="text-[11px] t3 mb-4">Voice and AI model settings</p>
        {agentVoiceId ? (
          <ConfigRow
            label="Voice"
            value={voiceName ? `${voiceName}  ·  ${agentVoiceId}` : agentVoiceId}
            copyValue={agentVoiceId}
          />
        ) : (
          <ConfigRow label="Voice" value="Not configured" />
        )}
        <div className="py-2">
          <a
            href="/dashboard/voices"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Change voice →
          </a>
        </div>
        <ConfigRow label="AI Model" value="Ultravox v0.7 (fixie-ai)" />
        <ConfigRow label="Client ID" value={clientId} copyValue={clientId} />
        {telegramChatId && (
          <ConfigRow label="Telegram Chat" value={telegramChatId} copyValue={telegramChatId} />
        )}
        {ultravoxAgentId && (
          <div className="flex items-center gap-3 pt-3 mt-1 border-t b-theme">
            <button
              onClick={syncAgent}
              disabled={syncing}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
                syncState === 'ok'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : syncState === 'error'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-hover t2 border b-theme hover:bg-hover hover:t1'
              }`}
            >
              {syncing ? 'Syncing\u2026' : syncState === 'ok' ? '\u2713 Synced' : syncState === 'error' ? '\u2717 Sync failed' : 'Re-sync Agent'}
            </button>
            <span className="text-[11px] t3">
              {syncState === 'error' ? syncError : 'Force-push current prompt + voice to Ultravox'}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
