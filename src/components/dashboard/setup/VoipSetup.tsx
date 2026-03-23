'use client'

import { motion, AnimatePresence } from 'motion/react'
import { VOIP_PLATFORMS, VOIP_INSTRUCTIONS } from './constants'
import { CopyButton, ActiveBadge, ConfirmActivation } from './shared'

interface VoipSetupProps {
  rawNumber: string
  displayNumber: string
  voipPlatform: string
  onPlatformChange: (id: string) => void
  checkedSteps: Set<number>
  onToggleStep: (i: number) => void
  isActive: boolean
  onActivated: () => void
}

export default function VoipSetup({
  rawNumber, displayNumber, voipPlatform, onPlatformChange, checkedSteps, onToggleStep, isActive, onActivated,
}: VoipSetupProps) {
  const voipInstructions = voipPlatform ? VOIP_INSTRUCTIONS[voipPlatform] : null
  const showVoipCodes = !!voipPlatform && !!voipInstructions

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.12 }}
    >

      <div className="flex items-start gap-2.5">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
        <p className="text-xs t3 leading-relaxed">
          VoIP systems use your admin portal instead of star codes. Works with any 10-digit North American number — no extra cost or delay.
        </p>
      </div>

      <div>
        <p className="text-[10px] t3 uppercase tracking-widest font-semibold mb-2">VoIP Platform</p>
        <select
          value={voipPlatform}
          onChange={e => { onPlatformChange(e.target.value) }}
          className="w-full bg-input border b-input rounded-xl px-3 py-2.5 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer"
        >
          <option value="">Select your platform...</option>
          {VOIP_PLATFORMS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <AnimatePresence mode="wait">
        {showVoipCodes && voipInstructions && (
          <motion.div
            key={voipPlatform}
            className="space-y-4"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold t1">
                {VOIP_PLATFORMS.find(p => p.id === voipPlatform)?.name} — Setup Steps
              </p>
              <span className="text-[10px] font-mono t3 tabular-nums">
                {checkedSteps.size}/{voipInstructions.steps.length}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-0.5 bg-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500/60 transition-all duration-500 rounded-full"
                style={{ width: `${(checkedSteps.size / voipInstructions.steps.length) * 100}%` }}
              />
            </div>

            <ol className="space-y-2">
              {voipInstructions.steps.map((step, i) => (
                <li
                  key={i}
                  onClick={() => onToggleStep(i)}
                  className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
                    checkedSteps.has(i)
                      ? 'bg-emerald-500/[0.05] border-emerald-500/20'
                      : 'bg-input b-theme hover:b-theme hover:bg-hover'
                  }`}
                >
                  <span className="text-sm font-black font-mono text-blue-500/30 w-7 shrink-0 mt-0.5 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className={`text-sm leading-relaxed flex-1 transition-colors ${
                    checkedSteps.has(i) ? 't3 line-through decoration-zinc-700' : 't2'
                  }`}>
                    {step}
                  </p>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all duration-150 ${
                    checkedSteps.has(i)
                      ? 'bg-emerald-500/25 border-emerald-500/40'
                      : 'b-theme'
                  }`}>
                    {checkedSteps.has(i) && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {rawNumber && (
              <div className="bg-input border b-theme rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-[11px] t3 shrink-0">Agent number</span>
                <span className="font-mono text-sm t1 flex-1">{displayNumber}</span>
                <CopyButton value={rawNumber} />
              </div>
            )}

            {voipInstructions.note && (
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60 mt-1.5 shrink-0" />
                <p className="text-[11px] text-amber-700 dark:text-amber-200/50 leading-relaxed">{voipInstructions.note}</p>
              </div>
            )}

            {isActive ? <ActiveBadge /> : <ConfirmActivation onConfirmed={onActivated} />}
          </motion.div>
        )}
      </AnimatePresence>

      {!voipPlatform && (
        <div className="text-center py-12 t3 text-sm">
          Select your VoIP platform above to see the setup steps.
        </div>
      )}

      <p className="text-[11px] t3 text-center pb-2">
        Once saved in the portal, forwarding stays active permanently. Your business number remains unchanged for outbound calls.
      </p>
    </motion.div>
  )
}
