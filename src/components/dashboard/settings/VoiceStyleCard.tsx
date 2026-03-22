'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { usePatchSettings, type CardMode } from './usePatchSettings'

const PRESETS = [
  { id: 'casual_friendly', label: 'Casual & Friendly', desc: 'Warm, upbeat, natural fillers and slang — great for trades and small shops' },
  { id: 'professional_warm', label: 'Professional & Warm', desc: 'Polished but friendly, clean sentences, no slang — real estate, law, medical' },
  { id: 'direct_efficient', label: 'Direct & Efficient', desc: 'Minimal small talk, straight to the point — high-volume and busy offices' },
  { id: 'empathetic_care', label: 'Empathetic & Patient', desc: 'Extra validation, slower pace, gentle tone — healthcare and senior services' },
] as const

interface VoiceStyleCardProps {
  clientId: string
  isAdmin: boolean
  initialPreset: string
  previewMode?: boolean
  mode?: CardMode
  onSave?: () => void
  onPromptChange?: (prompt: string) => void
}

export default function VoiceStyleCard({ clientId, isAdmin, initialPreset, previewMode, mode = 'settings', onSave, onPromptChange }: VoiceStyleCardProps) {
  const [preset, setPreset] = useState(initialPreset || 'casual_friendly')
  const { saving, saved, error, syncStatus, patch } = usePatchSettings(clientId, isAdmin, { onSave, onPromptChange })

  async function save() {
    await patch({ voice_style_preset: preset })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.03 }}
    >
      <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">{mode === 'onboarding' ? 'How Should Your Agent Sound?' : 'Voice Style'}</p>
          </div>
          <p className="text-[11px] t3 mt-1">{mode === 'onboarding' ? 'Pick a personality. You can change this anytime in settings.' : 'How your agent sounds on calls — tone, pacing, and filler words.'}</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRESETS.map(p => {
            const selected = preset === p.id
            return (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                aria-pressed={selected}
                className={`text-left rounded-xl border p-3 transition-all ${
                  selected
                    ? 'border-blue-500/60 bg-blue-500/[0.06]'
                    : 'border-white/[0.06] bg-hover hover:border-white/[0.12]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 ${
                    selected ? 'border-blue-400 bg-blue-400' : 'border-zinc-600'
                  }`} />
                  <span className="text-xs font-medium t1">{p.label}</span>
                </div>
                <p className="text-[11px] t3 ml-[18px]">{p.desc}</p>
              </button>
            )
          })}
        </div>
        <div className="px-5 py-3 border-t border-white/[0.04]">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={save}
              disabled={saving || previewMode}
              className="text-xs px-4 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] t2 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : saved ? (syncStatus === 'synced' ? '\u2713 Synced' : syncStatus === 'failed' ? '\u26A0 Saved' : '\u2713 Saved') : 'Save Style'}
            </button>
          </div>
          {saved && syncStatus === 'synced' && (
            <p className="text-[10px] text-green-400/70 text-right mt-1.5">Prompt updated &amp; synced to agent</p>
          )}
          {saved && syncStatus === 'failed' && (
            <p className="text-[10px] text-amber-400/70 text-right mt-1.5">Saved to DB but agent sync failed — changes may not take effect until next deploy</p>
          )}
          {error && <p className="text-[11px] text-red-400 text-right mt-1.5">{error}</p>}
        </div>
      </div>
    </motion.div>
  )
}
