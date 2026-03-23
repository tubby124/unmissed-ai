'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { usePatchSettings, type CardMode } from './usePatchSettings'
import { useDirtyGuard } from './useDirtyGuard'

interface IvrMenuCardProps {
  clientId: string
  isAdmin: boolean
  initialEnabled: boolean
  initialPrompt: string
  businessName: string | null
  agentName: string | null
  previewMode?: boolean
  mode?: CardMode
  onSave?: () => void
}

export default function IvrMenuCard({
  clientId,
  isAdmin,
  initialEnabled,
  initialPrompt,
  businessName,
  agentName,
  previewMode,
  mode = 'settings',
  onSave,
}: IvrMenuCardProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [promptText, setPromptText] = useState(initialPrompt)
  const { saving, saved, error, patch } = usePatchSettings(clientId, isAdmin, { onSave })
  const { markDirty, markClean } = useDirtyGuard('ivr-' + clientId)

  const defaultPrompt = `Hi, you've reached ${businessName || 'our office'}. Press 1 to leave a voicemail, or stay on the line and ${agentName || 'our assistant'} will be with you shortly.`

  async function save() {
    const res = await patch({ ivr_enabled: enabled, ivr_prompt: promptText.trim() || null })
    if (res?.ok) markClean()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <div className="rounded-2xl border b-theme bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Voicemail Menu (IVR)</p>
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
        {error && <p className="text-[11px] text-red-400">{error}</p>}

        <p className="text-[11px] t3">
          {mode === 'onboarding'
            ? 'Add a press-1-for-voicemail option before callers connect to your AI agent.'
            : 'Play a short menu before callers connect to your agent. Useful when callers are used to leaving voicemail.'}
        </p>

        {/* Toggle */}
        <div
          onClick={() => { setEnabled(v => !v); markDirty() }}
          className="flex items-center justify-between rounded-xl border b-theme p-3.5 cursor-pointer hover:bg-white/5 transition-colors"
        >
          <div>
            <p className="text-[13px] font-medium t1">Enable voicemail menu</p>
            <p className="text-[11px] t3 mt-0.5">
              Callers hear: &quot;Press 1 for voicemail, or stay on the line&quot;
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={e => { e.stopPropagation(); setEnabled(v => !v); markDirty() }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enabled ? 'bg-indigo-600' : 'bg-white/10'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Custom prompt */}
        {enabled && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium t2">Menu message</p>
            <textarea
              rows={3}
              value={promptText}
              onChange={e => { setPromptText(e.target.value); markDirty() }}
              className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors resize-y"
              placeholder={defaultPrompt}
            />
            <p className="text-[10px] t3">
              Leave blank to use the default. Keep under 15 seconds — callers won&apos;t wait longer.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
