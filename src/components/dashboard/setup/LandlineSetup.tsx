'use client'

import { motion, AnimatePresence } from 'motion/react'
import { LANDLINE_CODES, LANDLINE_NOTES } from './constants'
import { StarCard, CodeRow, InlineNotes, ActiveBadge, ConfirmActivation, MarkActiveButton } from './shared'

interface LandlineSetupProps {
  rawNumber: string
  displayNumber: string
  landlineCarrier: string
  onCarrierChange: (id: string) => void
  telusOption: 'A' | 'B'
  onTelusOptionChange: (opt: 'A' | 'B') => void
  isActive: boolean
  onActivated: () => void
}

export default function LandlineSetup({
  rawNumber, displayNumber, landlineCarrier, onCarrierChange, telusOption, onTelusOptionChange, isActive, onActivated,
}: LandlineSetupProps) {
  const landlineCodes = landlineCarrier ? LANDLINE_CODES[landlineCarrier] : null
  const landlineNotes = landlineCarrier ? (LANDLINE_NOTES[landlineCarrier] ?? []) : []
  const isTelus = landlineCarrier === 'telus-wireline'
  const showLandlineCodes = !!landlineCarrier && !!rawNumber && !!landlineCodes

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.06 }}
    >

      <div>
        <p className="text-[10px] t3 uppercase tracking-widest font-semibold mb-2">Landline Provider</p>
        <select
          value={landlineCarrier}
          onChange={e => { onCarrierChange(e.target.value) }}
          className="w-full bg-input border b-input rounded-xl px-3 py-2.5 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer"
        >
          <option value="">Select your provider...</option>
          <optgroup label="Saskatchewan">
            <option value="sasktel">SaskTel (IBC)</option>
          </optgroup>
          <optgroup label="National Carriers">
            <option value="rogers-business">Rogers Business / Shaw Business</option>
            <option value="bell-business">Bell Business</option>
            <option value="telus-wireline">Telus Business (wireline)</option>
            <option value="cogeco">Cogeco Business</option>
          </optgroup>
          <optgroup label="">
            <option value="other-landline">Other Landline</option>
          </optgroup>
        </select>
      </div>

      {landlineCarrier && landlineNotes.length > 0 && <InlineNotes notes={landlineNotes} />}

      <AnimatePresence mode="wait">
        {showLandlineCodes && !isTelus && (
          <motion.div
            key={landlineCarrier}
            className="space-y-3"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <div className="bg-input border b-theme rounded-xl px-4 py-3">
              <p className="text-[11px] t2 leading-relaxed">{landlineCodes!.process}</p>
            </div>

            {landlineCodes!.noAnswerOn && (
              <StarCard
                stepNum="01"
                label="No Answer"
                desc="Forwards when you don't pick up"
                code={`${landlineCodes!.noAnswerOn} ${rawNumber}`}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
              />
            )}

            {landlineCodes!.busyOn && (
              <StarCard
                stepNum="02"
                label="Busy"
                desc="Forwards when your line is busy"
                code={`${landlineCodes!.busyOn} ${rawNumber}`}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <line x1="8" y1="6" x2="8" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="16" y1="6" x2="16" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                }
              />
            )}

            <p className="text-[10px] t3">No # suffix needed — landline star codes work differently from mobile GSM codes.</p>
            {isActive ? <ActiveBadge /> : <ConfirmActivation onConfirmed={onActivated} />}
          </motion.div>
        )}
      </AnimatePresence>

      {landlineCarrier === 'telus-wireline' && rawNumber && (
        <div className="space-y-4">
          <div className="flex gap-1 p-1 bg-input border b-theme rounded-xl">
            {(['A', 'B'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => onTelusOptionChange(opt)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  telusOption === opt ? 'bg-hover text-white' : 't3 hover:t1'
                }`}
              >
                Option {opt} — {opt === 'A' ? 'Star Code (manual)' : 'Call Telus (easier)'}
              </button>
            ))}
          </div>

          {telusOption === 'A' && (
            <div className="space-y-3">
              <div className="bg-input border b-theme rounded-xl px-4 py-3">
                <p className="text-[11px] t2 leading-relaxed">
                  Dial from your desk phone. The destination phone will ring —{' '}
                  <span className="text-amber-300 font-medium">you must answer it</span> to confirm activation.
                </p>
              </div>
              <StarCard
                stepNum="01"
                label="Activate Call Forwarding"
                desc="If *72 doesn't work, try #72"
                code={`*72 ${rawNumber}`}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
              />
            </div>
          )}

          {telusOption === 'B' && (
            <div className="rounded-2xl border b-theme bg-input overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b b-theme">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center shrink-0 text-emerald-400">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white">Call Telus Business Support</p>
              </div>
              <div className="px-5 py-4 space-y-4">
                <p className="text-xs t2 leading-relaxed">
                  Skip the star code entirely. Call Telus Business and they&apos;ll enable it for you — takes about 5 minutes. No answer-to-confirm step required.
                </p>
                <div className="bg-black/40 rounded-xl px-4 py-3.5 space-y-2 border b-theme">
                  <p className="text-xs t2"><span className="t3 w-10 inline-block">Call</span> 1-866-771-9666</p>
                  <p className="text-xs t2"><span className="t3 w-10 inline-block">Say</span> &quot;Please enable Call Forward No Answer on my line to {displayNumber}&quot;</p>
                </div>
              </div>
            </div>
          )}

          {isActive ? <ActiveBadge /> : <MarkActiveButton onClick={onActivated} />}
        </div>
      )}

      {landlineCarrier && landlineCodes && (
        <div className="space-y-px pt-1">
          {landlineCodes.unconditionalOn && !isTelus && (
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
                <p className="text-[11px] text-red-300/60 mb-3">Your desk phone will not ring. Every caller goes directly to the agent.</p>
                <CodeRow label="Enable unconditional" code={`${landlineCodes.unconditionalOn} ${rawNumber}`} />
              </div>
            </details>
          )}

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
              {landlineCodes.noAnswerOff && <CodeRow label="Disable no-answer forward"     code={landlineCodes.noAnswerOff} />}
              {landlineCodes.busyOff && <CodeRow label="Disable busy forward"              code={landlineCodes.busyOff} />}
              {landlineCodes.unconditionalOff && <CodeRow label="Disable unconditional forward" code={landlineCodes.unconditionalOff} />}
              <p className="pt-3 text-[11px] t3">Pick up the receiver, dial the code, hang up when you hear the confirmation tone.</p>
            </div>
          </details>
        </div>
      )}

      {!landlineCarrier && (
        <div className="text-center py-12 t3 text-sm">
          Select your landline provider above to see the forwarding codes.
        </div>
      )}

      <p className="text-[11px] t3 text-center pb-2">
        Forwarding stays active until disabled — even after restarts or power outages.
      </p>
    </motion.div>
  )
}
