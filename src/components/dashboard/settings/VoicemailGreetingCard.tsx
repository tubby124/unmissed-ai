'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { usePatchSettings } from './usePatchSettings'

interface VoicemailGreetingCardProps {
  clientId: string
  isAdmin: boolean
  initialText: string
  businessName: string | null
  hasAudioGreeting: boolean
  previewMode?: boolean
}

export default function VoicemailGreetingCard({
  clientId,
  isAdmin,
  initialText,
  businessName,
  hasAudioGreeting,
  previewMode,
}: VoicemailGreetingCardProps) {
  const [text, setText] = useState(initialText)
  const { saving, saved, patch } = usePatchSettings(clientId, isAdmin)

  async function save() {
    await patch({ voicemail_greeting_text: text })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Voicemail Greeting</p>
          <button
            onClick={save}
            disabled={saving || previewMode}
            className={`px-3 py-1 text-[11px] font-medium rounded-lg transition-colors ${
              saved
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/5 hover:bg-white/10 t2 border b-theme'
            }`}
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
        <p className="text-[11px] t3 mb-3">
          Played to callers when the AI agent is temporarily unavailable. Leave blank to auto-generate from your business name.
        </p>
        <textarea
          rows={3}
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors resize-y"
          placeholder={`Hi, you've reached ${businessName || 'our office'}. We're unable to take your call right now. Please leave a message after the beep and we'll get back to you as soon as possible.`}
        />
        <p className="text-[10px] t3 mt-1.5">
          {hasAudioGreeting
            ? 'Custom audio greeting is active (set by admin). Text greeting is used as fallback.'
            : 'Tip: Contact support to upload a custom audio greeting for a more personalized experience.'}
        </p>
      </div>
    </motion.div>
  )
}
