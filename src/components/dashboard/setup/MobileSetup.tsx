'use client'

import { motion, AnimatePresence } from 'motion/react'
import { CARRIER_NOTES, FIDO_DISABLE } from './constants'
import { CopyButton, CodeRow, StarCard, InlineNotes, ActiveBadge, ConfirmActivation } from './shared'

interface MobileSetupProps {
  rawNumber: string
  displayNumber: string
  carrier: string
  onCarrierChange: (id: string) => void
  device: 'iphone' | 'android'
  onDeviceChange: (d: 'iphone' | 'android') => void
  isActive: boolean
  onActivated: () => void
}

export default function MobileSetup({
  rawNumber, displayNumber, carrier, onCarrierChange, device, onDeviceChange, isActive, onActivated,
}: MobileSetupProps) {
  const showMobileCodes = !!carrier && !!rawNumber
  const carrierNotes = carrier ? (CARRIER_NOTES[carrier] ?? []) : []
  const useDoubleHash = FIDO_DISABLE.has(carrier)
  const disablePrefix = useDoubleHash ? '##' : '#'

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.0 }}
    >

      <div className="grid grid-cols-2 gap-3">
        {/* Device toggle */}
        <div>
          <p className="text-[10px] t3 uppercase tracking-widest font-semibold mb-2">Device</p>
          <div className="flex gap-1 p-1 bg-input border b-theme rounded-xl">
            {(['iphone', 'android'] as const).map(d => (
              <button
                key={d}
                onClick={() => { onDeviceChange(d) }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  device === d ? 'bg-hover text-white' : 't3 hover:t1'
                }`}
              >
                {d === 'iphone' ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="5" y="4" width="14" height="16" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M9 2l1 2h4l1-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
                {d === 'iphone' ? 'iPhone' : 'Android'}
              </button>
            ))}
          </div>
        </div>

        {/* Carrier select */}
        <div>
          <p className="text-[10px] t3 uppercase tracking-widest font-semibold mb-2">Carrier</p>
          <select
            value={carrier}
            onChange={e => { onCarrierChange(e.target.value) }}
            className="w-full bg-input border b-input rounded-xl px-3 py-[9px] text-xs t1 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer"
          >
            <option value="">Select carrier...</option>
            <optgroup label="Big Three">
              <option value="rogers">Rogers</option>
              <option value="bell">Bell</option>
              <option value="telus">Telus</option>
            </optgroup>
            <optgroup label="Sub-brands &amp; Independents">
              <option value="chatr">Chatr (Rogers network)</option>
              <option value="fido">Fido (Rogers network)</option>
              <option value="freedom">Freedom Mobile</option>
              <option value="koodo">Koodo (Telus network)</option>
              <option value="lucky-mobile">Lucky Mobile (Bell network)</option>
              <option value="pc-mobile">PC Mobile (Bell network)</option>
              <option value="public-mobile">Public Mobile (Telus network)</option>
              <option value="videotron">Videotron</option>
              <option value="virgin-plus">Virgin Plus (Bell network)</option>
            </optgroup>
            <optgroup label="">
              <option value="other">Other / Unlisted</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Device instructions */}
      {carrier && (
        device === 'iphone' ? (
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3 flex items-start gap-2.5">
            <svg className="text-amber-500/60 shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p className="text-[11px] text-amber-700 dark:text-amber-200/60 leading-relaxed">
              Open your <span className="font-medium">Phone app</span> → tap the keypad → dial each code and press the green Call button. Do <span className="font-medium">not</span> use Settings → Phone → Call Forwarding — those toggles don&apos;t support star codes.
            </p>
          </div>
        ) : (
          <div className="bg-input border b-theme rounded-xl px-4 py-3">
            <p className="text-[11px] t3 leading-relaxed">
              Open <span className="t2 font-medium">Phone app</span> → dial the code and press Call.
              Or: Phone → More (⋮) → Settings → Supplementary Services → Call Forwarding.
            </p>
          </div>
        )
      )}

      {carrier && carrierNotes.length > 0 && <InlineNotes notes={carrierNotes} />}

      {/* Video walkthrough placeholder */}
      {carrier && (
        <div className="rounded-xl border border-dashed b-theme bg-hover flex flex-col items-center justify-center gap-2 py-8 cursor-default">
          <svg className="t3" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <p className="text-[11px] t3">Video walkthrough — coming soon</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {showMobileCodes && (
          <motion.div
            key={carrier}
            className="space-y-3"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <StarCard
              stepNum="01"
              label="No Answer"
              desc="Forwards when you don't pick up"
              code={`*61*${rawNumber}#`}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
            />
            <StarCard
              stepNum="02"
              label="Busy"
              desc="Forwards when your line is busy"
              code={`*67*${rawNumber}#`}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <line x1="8" y1="6" x2="8" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="16" y1="6" x2="16" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              }
            />
            <StarCard
              stepNum="03"
              label="Unreachable"
              desc="Forwards when phone is off or has no signal"
              code={`*62*${rawNumber}#`}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
            />
            {isActive ? <ActiveBadge /> : <ConfirmActivation onConfirmed={onActivated} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible panels */}
      {carrier && rawNumber && (
        <div className="space-y-px pt-1">
          <details className="group">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center gap-2 px-1 py-2.5 t3 hover:t2 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span className="text-xs font-medium">Send all calls to agent</span>
                <svg className="ml-auto group-open:rotate-180 transition-transform duration-200" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </summary>
            <div className="bg-input border border-red-500/15 rounded-xl p-4 mt-1 space-y-2">
              <p className="text-[11px] text-red-300/60 mb-3">Your phone will not ring. Every caller goes directly to the agent.</p>
              <CodeRow label="Enable unconditional" code={`*21*${rawNumber}#`} />
            </div>
          </details>

          <details className="group">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center gap-2 px-1 py-2.5 t3 hover:t2 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-xs font-medium">Turn off forwarding</span>
                <svg className="ml-auto group-open:rotate-180 transition-transform duration-200" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </summary>
            <div className="bg-input border b-theme rounded-xl p-4 mt-1 divide-y divide-white/[0.04]">
              <CodeRow label="Disable no-answer"     code={`${disablePrefix}61#`} />
              <CodeRow label="Disable busy"          code={`${disablePrefix}67#`} />
              <CodeRow label="Disable unreachable"   code={`${disablePrefix}62#`} />
              <CodeRow label="Disable unconditional" code={`${disablePrefix}21#`} />
              <CodeRow label="Disable ALL at once"   code="##002#" />
            </div>
          </details>

          <details className="group">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center gap-2 px-1 py-2.5 t3 hover:t2 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="text-xs font-medium">Check forwarding status</span>
                <svg className="ml-auto group-open:rotate-180 transition-transform duration-200" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </summary>
            <div className="bg-input border b-theme rounded-xl p-4 mt-1 divide-y divide-white/[0.04]">
              <CodeRow label="Check no-answer status"   code="*#61#" />
              <CodeRow label="Check unreachable status" code="*#62#" />
              <CodeRow label="Check busy status"        code="*#67#" />
              <p className="pt-3 text-[11px] t3">Dial the code and press Call. Your carrier displays a message confirming whether forwarding is active.</p>
            </div>
          </details>
        </div>
      )}

      {!carrier && (
        <div className="text-center py-12 t3 text-sm">
          Select your carrier above to see the forwarding codes.
        </div>
      )}

      <p className="text-[11px] t3 text-center pb-2">
        Standard 3GPP GSM codes — work on all Canadian carriers. Set once, stays active permanently.
      </p>
    </motion.div>
  )
}
