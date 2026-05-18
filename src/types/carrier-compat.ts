/**
 * Carrier + device compatibility types for the forwarding pre-flight checker.
 *
 * See spec: ~/Downloads/Obsidian Vault/Projects/unmissed/Product/carrier-compatibility-checker-spec.md
 * See concept page: ~/Downloads/Obsidian Vault/knowledge/concepts/unmissed/unmissed-carrier-compatibility-matrix.md
 * See durable rule: ~/.claude/projects/-Users-owner/memory/unmissed-carrier-voicemail-removal.md
 */

export type CarrierId =
  | 'rogers' | 'rogers-business'
  | 'bell' | 'bell-mobility'
  | 'telus' | 'telus-business'
  | 'fido' | 'chatr'
  | 'koodo' | 'public-mobile' | 'lucky-mobile' | 'pc-mobile' | 'virgin-plus'
  | 'freedom' | 'videotron'
  | 'other'

export type DeviceClass = 'iphone' | 'android' | 'landline' | 'voip'

export type VmState = 'active' | 'removed' | 'busy' | 'unknown'
export type VvmState = 'active' | 'inactive' | 'unknown' | 'na'

export type DiagnosticResult =
  | 'pass'
  | 'fail_vm_intercept'
  | 'fail_ring_forever'
  | 'fail_busy'

export interface CarrierProfile {
  id: CarrierId
  displayName: string
  supportNumber: string
  supportHours?: string
  requiresAddon: boolean
  doubleHashDisable: boolean
  vmRemovalScript: string
  escalationNote?: string
  validated: boolean
}

export interface CompatCheckState {
  carrierId: CarrierId | null
  deviceClass: DeviceClass | null
  vmState: VmState
  vvmState: VvmState
  removalConfirmed: boolean
  diagnosticResult: DiagnosticResult | null
  diagnosticRunAt: string | null
}

export const DEFAULT_COMPAT_STATE: CompatCheckState = {
  carrierId: null,
  deviceClass: null,
  vmState: 'unknown',
  vvmState: 'na',
  removalConfirmed: false,
  diagnosticResult: null,
  diagnosticRunAt: null,
}

const GENERIC_SCRIPT = `Please fully remove voicemail from my line. Not reset — delete the voicemail box from my line profile. I'm using a third-party answering service and the carrier voicemail is blocking my conditional call forwarding.`

const IPHONE_VVM_TAIL = ` If I have Visual Voicemail (VVM) on this line, please remove that as well — both the base voicemail and VVM.`

export const CARRIER_PROFILES: Record<CarrierId, CarrierProfile> = {
  'rogers': {
    id: 'rogers',
    displayName: 'Rogers',
    supportNumber: '1-800-764-3771',
    supportHours: '24/7',
    requiresAddon: false,
    doubleHashDisable: false,
    vmRemovalScript: GENERIC_SCRIPT,
    validated: true,
  },
  'rogers-business': {
    id: 'rogers-business',
    displayName: 'Rogers Business',
    supportNumber: '1-866-727-2141',
    supportHours: 'Mon-Fri 8am-9pm ET, weekends 9am-6pm ET',
    requiresAddon: false,
    doubleHashDisable: false,
    vmRemovalScript: GENERIC_SCRIPT,
    validated: true,
  },
  'bell': {
    id: 'bell',
    displayName: 'Bell',
    supportNumber: '1-800-668-6878',
    requiresAddon: false,
    doubleHashDisable: false,
    vmRemovalScript: GENERIC_SCRIPT,
    validated: false,
  },
  'bell-mobility': {
    id: 'bell-mobility',
    displayName: 'Bell Mobility',
    supportNumber: '1-800-667-0123',
    requiresAddon: false,
    doubleHashDisable: false,
    vmRemovalScript: GENERIC_SCRIPT,
    escalationNote: 'Forwarding works to Canadian and US numbers only.',
    validated: false,
  },
  'telus': {
    id: 'telus',
    displayName: 'Telus',
    supportNumber: '1-866-558-2273',
    requiresAddon: false,
    doubleHashDisable: false,
    vmRemovalScript: GENERIC_SCRIPT,
    escalationNote: `If the front-line agent says voicemail can't be removed (you may be on a Premium Voicemail plan), ask: "Please escalate me to tier 2 retention or back-office mobility provisioning." Validated 2026-05-05.`,
    validated: true,
  },
  'telus-business': {
    id: 'telus-business',
    displayName: 'Telus Business',
    supportNumber: '1-866-558-2273',
    requiresAddon: false,
    doubleHashDisable: false,
    vmRemovalScript: GENERIC_SCRIPT,
    escalationNote: 'Same Premium VM gotcha as consumer. Ask for tier 2 retention if denied.',
    validated: true,
  },
  'fido': {
    id: 'fido',
    displayName: 'Fido',
    supportNumber: '1-888-481-3436',
    requiresAddon: false,
    doubleHashDisable: true,
    vmRemovalScript: GENERIC_SCRIPT,
    escalationNote: 'Fido conditional forwarding is blocked while "Voice Messaging" is on your account. Voicemail removal is a hard requirement.',
    validated: false,
  },
  'chatr': {
    id: 'chatr',
    displayName: 'Chatr',
    supportNumber: '1-800-485-9745',
    requiresAddon: false,
    doubleHashDisable: true,
    vmRemovalScript: GENERIC_SCRIPT,
    validated: false,
  },
  'koodo': {
    id: 'koodo',
    displayName: 'Koodo',
    supportNumber: '1-866-995-6636',
    requiresAddon: true,
    doubleHashDisable: false,
    vmRemovalScript: GENERIC_SCRIPT,
    escalationNote: 'Koodo requires a Call Forwarding add-on (~$3-5/mo) in the MyKoodo app. Prepaid: only *62 (unreachable) is supported.',
    validated: false,
  },
  'public-mobile': {
    id: 'public-mobile',
    displayName: 'Public Mobile',
    supportNumber: 'Self-serve via app — no phone support',
    requiresAddon: false,
    doubleHashDisable: false,
    vmRemovalScript: 'Disable voicemail via the Self-Serve account at publicmobile.ca → Plan & Add-ons → Voicemail.',
    escalationNote: 'Must be physically on the Public Mobile network in Canada when configuring forwarding.',
    validated: false,
  },
  'lucky-mobile': {
    id: 'lucky-mobile',
    displayName: 'Lucky Mobile',
    supportNumber: 'Self-serve via app',
    requiresAddon: false,
    doubleHashDisable: false,
    vmRemovalScript: 'Behaves as parent network (Bell). Self-serve disable in the My Lucky app, then escalate to Bell support if needed.',
    validated: false,
  },
  'pc-mobile': {
    id: 'pc-mobile',
    displayName: 'PC Mobile',
    supportNumber: '1-877-284-6361',
    requiresAddon: false,
    doubleHashDisable: false,
    vmRemovalScript: GENERIC_SCRIPT,
    validated: false,
  },
  'virgin-plus': {
    id: 'virgin-plus',
    displayName: 'Virgin Plus',
    supportNumber: '1-888-999-2321',
    requiresAddon: false,
    doubleHashDisable: false,
    vmRemovalScript: GENERIC_SCRIPT,
    escalationNote: 'Virgin runs on Bell network — escalate to Bell tier-2 if removal denied.',
    validated: false,
  },
  'freedom': {
    id: 'freedom',
    displayName: 'Freedom Mobile',
    supportNumber: '1-877-946-3184',
    requiresAddon: false,
    doubleHashDisable: false,
    vmRemovalScript: GENERIC_SCRIPT,
    escalationNote: 'Limited coverage areas can trigger CFNRc (unreachable) unexpectedly — *62 must be set even if you mostly stay in-coverage.',
    validated: false,
  },
  'videotron': {
    id: 'videotron',
    displayName: 'Videotron',
    supportNumber: '1-877-380-7222',
    requiresAddon: false,
    doubleHashDisable: false,
    vmRemovalScript: GENERIC_SCRIPT,
    escalationNote: 'Quebec-only. Primary support may answer in French — ask for English service if needed.',
    validated: false,
  },
  'other': {
    id: 'other',
    displayName: 'Other / Unlisted',
    supportNumber: 'Check your carrier\'s billing statement or website',
    requiresAddon: false,
    doubleHashDisable: false,
    vmRemovalScript: GENERIC_SCRIPT,
    escalationNote: 'If your carrier insists conditional forwarding can\'t be enabled, contact End Voicemail support — we can verify your line\'s feature set.',
    validated: false,
  },
}

export function appendIphoneVvmTail(script: string): string {
  return script + IPHONE_VVM_TAIL
}
