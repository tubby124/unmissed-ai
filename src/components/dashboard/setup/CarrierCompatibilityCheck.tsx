'use client'

/**
 * Carrier Compatibility Pre-Flight Checker
 *
 * Inserts a 4-question gate BEFORE the dial codes in MobileSetup.tsx are shown.
 * Detects: carrier, device, Apple VVM state, voicemail-active state.
 * Forces voicemail removal at the carrier when detected before unlocking codes.
 *
 * Spec: ~/Downloads/Obsidian Vault/Projects/unmissed/Product/carrier-compatibility-checker-spec.md
 * Concept page: ~/Downloads/Obsidian Vault/knowledge/concepts/unmissed/unmissed-carrier-compatibility-matrix.md
 * Durable rule: ~/.claude/projects/-Users-owner/memory/unmissed-carrier-voicemail-removal.md
 *
 * STATUS: SCAFFOLDED — not yet wired into MobileSetup. Owner reviews, then thread it.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  CARRIER_PROFILES,
  appendIphoneVvmTail,
  type CarrierId,
  type DeviceClass,
  type VmState,
  type VvmState,
  type CompatCheckState,
  DEFAULT_COMPAT_STATE,
} from '@/types/carrier-compat'
import { CopyButton, InlineNotes } from './shared'

interface Props {
  initialState?: Partial<CompatCheckState>
  onComplete: (state: CompatCheckState) => void
  onSkip?: () => void
}

type Stage =
  | 'carrier'
  | 'device'
  | 'vvm'         // iphone only
  | 'vm-probe'
  | 'removal-instructions'
  | 'confirm'
  | 'done'

export default function CarrierCompatibilityCheck({ initialState, onComplete, onSkip }: Props) {
  const [state, setState] = useState<CompatCheckState>({ ...DEFAULT_COMPAT_STATE, ...initialState })
  const [stage, setStage] = useState<Stage>('carrier')

  const profile = state.carrierId ? CARRIER_PROFILES[state.carrierId] : null
  const isIphone = state.deviceClass === 'iphone'
  const removalRequired = state.vmState === 'active' || state.vvmState === 'active'

  function update(patch: Partial<CompatCheckState>) {
    setState((s) => ({ ...s, ...patch }))
  }

  function advance() {
    if (stage === 'carrier') return setStage('device')
    if (stage === 'device') {
      if (state.deviceClass === 'iphone') return setStage('vvm')
      return setStage('vm-probe')
    }
    if (stage === 'vvm') return setStage('vm-probe')
    if (stage === 'vm-probe') {
      if (removalRequired) return setStage('removal-instructions')
      return setStage('confirm')
    }
    if (stage === 'removal-instructions') return setStage('confirm')
    if (stage === 'confirm') {
      setStage('done')
      onComplete(state)
    }
  }

  const canAdvance =
    (stage === 'carrier' && !!state.carrierId) ||
    (stage === 'device' && !!state.deviceClass) ||
    (stage === 'vvm' && state.vvmState !== 'na') ||
    (stage === 'vm-probe' && state.vmState !== 'unknown') ||
    (stage === 'removal-instructions') ||
    (stage === 'confirm' && state.removalConfirmed)

  return (
    <div className="rounded-2xl card-surface p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] t3 font-semibold">Pre-flight</p>
          <h3 className="text-sm t1 font-semibold mt-0.5">Make sure forwarding will actually work</h3>
        </div>
        {onSkip && (
          <button onClick={onSkip} className="text-[11px] t3 hover:t1 transition-colors">
            Skip check
          </button>
        )}
      </div>

      <Progress stage={stage} hasVvm={isIphone} />

      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.16 }}
          className="min-h-[140px]"
        >
          {stage === 'carrier' && (
            <CarrierStage value={state.carrierId} onChange={(id) => update({ carrierId: id })} />
          )}
          {stage === 'device' && (
            <DeviceStage value={state.deviceClass} onChange={(d) => update({ deviceClass: d, vvmState: d === 'iphone' ? 'unknown' : 'na' })} />
          )}
          {stage === 'vvm' && (
            <VvmStage value={state.vvmState} onChange={(v) => update({ vvmState: v })} />
          )}
          {stage === 'vm-probe' && (
            <VmProbeStage value={state.vmState} onChange={(v) => update({ vmState: v })} />
          )}
          {stage === 'removal-instructions' && profile && (
            <RemovalStage profile={profile} isIphone={isIphone} />
          )}
          {stage === 'confirm' && (
            <ConfirmStage
              checked={state.removalConfirmed}
              onChange={(b) => update({ removalConfirmed: b })}
              removalRequired={removalRequired}
            />
          )}
          {stage === 'done' && (
            <div className="text-center py-6">
              <p className="text-sm font-semibold text-emerald-400">Pre-flight passed — forwarding codes unlocked below.</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {stage !== 'done' && (
        <button
          onClick={advance}
          disabled={!canAdvance}
          className="w-full py-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-500/15 transition-colors"
        >
          Continue →
        </button>
      )}
    </div>
  )
}

// ── Sub-stages ────────────────────────────────────────────────────────────────

function Progress({ stage, hasVvm }: { stage: Stage; hasVvm: boolean }) {
  const order: Stage[] = hasVvm
    ? ['carrier', 'device', 'vvm', 'vm-probe', 'removal-instructions', 'confirm']
    : ['carrier', 'device', 'vm-probe', 'removal-instructions', 'confirm']
  const idx = order.indexOf(stage)
  return (
    <div className="flex gap-1">
      {order.map((s, i) => (
        <div
          key={s}
          className={`h-1 flex-1 rounded-full transition-colors ${i <= idx ? 'bg-blue-400/60' : 'bg-input'}`}
        />
      ))}
    </div>
  )
}

function CarrierStage({ value, onChange }: { value: CarrierId | null; onChange: (id: CarrierId) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs t3">Which carrier is on the phone number you want to forward?</p>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value as CarrierId)}
        className="w-full bg-input border b-input rounded-xl px-3 py-2.5 text-sm t1"
      >
        <option value="">Choose your carrier…</option>
        <optgroup label="Big Three">
          <option value="rogers">Rogers</option>
          <option value="rogers-business">Rogers Business</option>
          <option value="bell">Bell</option>
          <option value="bell-mobility">Bell Mobility</option>
          <option value="telus">Telus</option>
          <option value="telus-business">Telus Business</option>
        </optgroup>
        <optgroup label="Sub-brands">
          <option value="fido">Fido (Rogers network)</option>
          <option value="chatr">Chatr (Rogers network)</option>
          <option value="koodo">Koodo (Telus network)</option>
          <option value="public-mobile">Public Mobile (Telus network)</option>
          <option value="lucky-mobile">Lucky Mobile (Bell network)</option>
          <option value="pc-mobile">PC Mobile (Bell network)</option>
          <option value="virgin-plus">Virgin Plus (Bell network)</option>
        </optgroup>
        <optgroup label="Independents">
          <option value="freedom">Freedom Mobile</option>
          <option value="videotron">Videotron</option>
        </optgroup>
        <option value="other">Other / Unlisted</option>
      </select>
    </div>
  )
}

function DeviceStage({ value, onChange }: { value: DeviceClass | null; onChange: (d: DeviceClass) => void }) {
  const options: { id: DeviceClass; label: string; sub: string }[] = [
    { id: 'iphone', label: 'iPhone', sub: 'Apple iOS — Visual Voicemail check applies' },
    { id: 'android', label: 'Android phone', sub: 'Samsung, Pixel, OnePlus, etc.' },
    { id: 'landline', label: 'Desk phone (POTS / wired line)', sub: 'Uses NANP star codes — different setup' },
    { id: 'voip', label: 'VoIP system', sub: 'RingCentral, Ooma, Grasshopper, 8x8, etc.' },
  ]
  return (
    <div className="space-y-2">
      <p className="text-xs t3">What kind of phone is the forwarding line on?</p>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
            value === o.id
              ? 'border-blue-500/40 bg-blue-500/10'
              : 'b-theme bg-input hover:border-blue-500/20'
          }`}
        >
          <p className="text-sm font-semibold t1">{o.label}</p>
          <p className="text-[11px] t3 mt-0.5">{o.sub}</p>
        </button>
      ))}
    </div>
  )
}

function VvmStage({ value, onChange }: { value: VvmState; onChange: (v: VvmState) => void }) {
  const options: { id: VvmState; label: string; sub: string }[] = [
    { id: 'active', label: 'I see a list of voicemail messages (like text messages)', sub: 'Visual Voicemail is active — must be removed at carrier' },
    { id: 'inactive', label: 'Just a "Greeting" / "Set Up" button, or empty', sub: 'No Visual Voicemail, but base voicemail might still be active' },
    { id: 'unknown', label: 'My Phone app has no Voicemail tab', sub: 'Likely no voicemail provisioned — good sign' },
  ]
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-amber-500/[0.04] border border-amber-500/20 px-4 py-3">
        <p className="text-[11px] text-amber-300 leading-relaxed">
          <strong>iPhone check:</strong> open your <strong>Phone app</strong> → tap <strong>Voicemail</strong> at the bottom right. What do you see?
        </p>
      </div>
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
              value === o.id ? 'border-blue-500/40 bg-blue-500/10' : 'b-theme bg-input hover:border-blue-500/20'
            }`}
          >
            <p className="text-sm font-semibold t1">{o.label}</p>
            <p className="text-[11px] t3 mt-0.5">{o.sub}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function VmProbeStage({ value, onChange }: { value: VmState; onChange: (v: VmState) => void }) {
  const options: { id: VmState; label: string }[] = [
    { id: 'active', label: 'Goes to a voicemail greeting (mine or generic carrier)' },
    { id: 'removed', label: 'Just rings forever, no voicemail picks up' },
    { id: 'busy', label: 'Goes to a busy signal' },
    { id: 'unknown', label: 'I don\'t know — I haven\'t tested it' },
  ]
  return (
    <div className="space-y-3">
      <p className="text-xs t3">
        Right now — before we change anything — if someone calls and you don\'t pick up, what happens?
      </p>
      <p className="text-[11px] t3 italic">If you\'re not sure, dial your own number from a different phone and let it ring. Don\'t answer.</p>
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
              value === o.id ? 'border-blue-500/40 bg-blue-500/10' : 'b-theme bg-input hover:border-blue-500/20'
            }`}
          >
            <p className="text-sm t1">{o.label}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function RemovalStage({ profile, isIphone }: { profile: typeof CARRIER_PROFILES[CarrierId]; isIphone: boolean }) {
  const script = isIphone ? appendIphoneVvmTail(profile.vmRemovalScript) : profile.vmRemovalScript
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-red-500/[0.05] border border-red-500/30 px-4 py-3">
        <p className="text-[12px] text-red-300 font-semibold mb-1">Carrier voicemail is blocking conditional forwarding</p>
        <p className="text-[11px] text-red-200/80 leading-relaxed">
          Voicemail and call forwarding share the same network slot. Even if `*61` says "Activation Succeeded", calls will keep hitting voicemail until the box is fully removed at the carrier.
        </p>
      </div>

      <div className="bg-input border b-theme rounded-xl p-4 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest t3 font-semibold">Call</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-base t1 font-mono">{profile.supportNumber}</p>
            <CopyButton value={profile.supportNumber} />
          </div>
          {profile.supportHours && <p className="text-[11px] t3 mt-1">{profile.supportHours}</p>}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest t3 font-semibold">Say exactly</p>
          <div className="mt-1.5 rounded-lg bg-black/40 border b-theme p-3 text-[12px] t1 leading-relaxed italic">
            "{script}"
          </div>
          <CopyButton value={script} label="Copy script" />
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest t3 font-semibold">Wait for verbal confirmation</p>
          <p className="text-[12px] t1 mt-1">"Voicemail has been removed."</p>
          {isIphone && <p className="text-[11px] t3 mt-0.5">For iPhone: also confirm Visual Voicemail service removal.</p>}
        </div>
      </div>

      {profile.escalationNote && (
        <InlineNotes notes={[profile.escalationNote]} />
      )}
    </div>
  )
}

function ConfirmStage({ checked, onChange, removalRequired }: { checked: boolean; onChange: (b: boolean) => void; removalRequired: boolean }) {
  return (
    <div className="space-y-3">
      <p className="text-sm t1">
        {removalRequired
          ? 'Confirm voicemail removal before we unlock the forwarding codes.'
          : 'No voicemail blocker detected — confirm to proceed.'}
      </p>
      <label className="flex items-start gap-3 p-4 rounded-xl border b-theme bg-input cursor-pointer hover:border-blue-500/20 transition-colors">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-blue-400"
        />
        <span className="text-[12px] t1 leading-relaxed">
          {removalRequired
            ? 'I called my carrier and confirmed voicemail is fully removed from this line.'
            : 'I confirm the line is ready for forwarding setup.'}
        </span>
      </label>
    </div>
  )
}
