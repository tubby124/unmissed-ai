/**
 * twilio-ownership — pure-comparison logic for the nightly Twilio ↔ Supabase
 * ownership-drift harness. No network, no Supabase, no Twilio SDK imports here
 * so the rules are unit-testable with fixtures.
 *
 * Catches the silent-fail class where Twilio releases / suspends / ports-out /
 * webhook-redirects a number we still believe we own — inbound calls 404 at
 * Twilio and the only signal in our system is "the phone stopped ringing".
 *
 * See scripts/twilio-ownership-check.ts for the runner that wires this to
 * Supabase + Twilio + harness-writer + Telegram.
 */

import type { Finding as HarnessFinding } from './harness-writer'

/**
 * Slice of clients we care about. Only the columns ownership comparison
 * touches — keeps fixtures small.
 */
export interface OwnershipClientRow {
  slug: string
  twilio_number: string
  sms_enabled?: boolean | null
}

/**
 * Slice of a Twilio IncomingPhoneNumberInstance. Mirrors the fields we read
 * from twilioClient.incomingPhoneNumbers.list({limit: 1000}).
 *
 * `status` values observed in production: 'in-use' (normal), 'suspended'
 * (Twilio compliance hold), 'pending' (provisioning), 'released'
 * (de-provisioned, will not appear in list response — but defensively typed).
 */
export interface TwilioInventoryNumber {
  sid: string
  phoneNumber: string
  status: string
  voiceUrl: string | null
  voiceFallbackUrl: string | null
  statusCallback: string | null
  capabilities: { voice?: boolean; sms?: boolean; mms?: boolean; fax?: boolean }
}

/** Severities + check names accepted by harness-writer. */
export type OwnershipCheckName =
  | 'twilio_number_orphan_in_db'
  | 'twilio_number_suspended'
  | 'twilio_voice_url_mismatch'
  | 'twilio_voice_fallback_url_mismatch'
  | 'twilio_status_callback_mismatch'
  | 'twilio_number_orphan_in_account'
  | 'twilio_number_capabilities_missing'

/**
 * What we expect Twilio to be configured with for a given client slug.
 * These are functions of APP_URL so a domain migration doesn't require a
 * code change here — only the env var.
 */
export interface ExpectedConfig {
  voiceUrl: string
  voiceFallbackUrl: string | null
  statusCallback: string | null
}

export interface ExpectedConfigOpts {
  appUrl: string
  /** Override fallback host — usually fallback.endvoicemail.ai (Cloudflare Worker). NULL skips check. */
  voiceFallbackUrl?: string | null
  /** Status callback URL — NULL means "we don't check this dimension". */
  statusCallback?: string | null
}

export function expectedConfigFor(slug: string, opts: ExpectedConfigOpts): ExpectedConfig {
  const base = opts.appUrl.replace(/\/$/, '')
  return {
    voiceUrl: `${base}/api/webhook/${slug}/inbound`,
    voiceFallbackUrl: opts.voiceFallbackUrl ?? null,
    statusCallback: opts.statusCallback ?? null,
  }
}

/**
 * Twilio's normal in-service status is 'in-use'. Anything else is a billing or
 * compliance state where inbound calls may fail silently.
 *
 * We treat 'in-use' as the ONLY healthy status. 'pending' on a long-lived
 * number means a config push is mid-flight and is also a yellow flag — but
 * since we currently never observe it on prod, surface it the same as
 * suspended (the operator should look).
 */
export function isHealthyStatus(status: string): boolean {
  return status === 'in-use'
}

/**
 * Compare DB clients vs Twilio inventory. Pure: no I/O. The runner script
 * fetches both sides and passes them in.
 */
export function diffOwnership(
  clients: OwnershipClientRow[],
  inventory: TwilioInventoryNumber[],
  opts: ExpectedConfigOpts,
): HarnessFinding[] {
  const findings: HarnessFinding[] = []
  const byPhone = new Map<string, TwilioInventoryNumber>()
  for (const n of inventory) byPhone.set(n.phoneNumber, n)
  const dbNumbers = new Set<string>()

  for (const c of clients) {
    dbNumbers.add(c.twilio_number)
    const tw = byPhone.get(c.twilio_number)
    const expected = expectedConfigFor(c.slug, opts)

    // ── twilio_number_orphan_in_db ────────────────────────────────────────
    // DB has a number that Twilio doesn't know about at all. Calls 404.
    if (!tw) {
      findings.push({
        check_name: 'twilio_number_orphan_in_db',
        severity: 'P0',
        client_slug: c.slug,
        summary: `Twilio has no record of ${c.twilio_number} — inbound calls will 404`,
        details: {
          twilio_number: c.twilio_number,
          remediation: 'Repurchase or restore the number in Twilio, then update clients.twilio_number',
        },
      })
      continue
    }

    // ── twilio_number_suspended ──────────────────────────────────────────
    // Anything other than 'in-use' means Twilio is not currently routing
    // calls. Most common: 'suspended' (billing / compliance / TCR violation).
    if (!isHealthyStatus(tw.status)) {
      findings.push({
        check_name: 'twilio_number_suspended',
        severity: 'P0',
        client_slug: c.slug,
        summary: `Twilio status=${tw.status} for ${c.twilio_number} (expected 'in-use')`,
        details: {
          twilio_number: c.twilio_number,
          twilio_sid: tw.sid,
          status: tw.status,
          remediation: 'Check Twilio console → Phone Numbers → status. Resolve compliance / billing hold.',
        },
      })
    }

    // ── twilio_voice_url_mismatch ────────────────────────────────────────
    // Webhook drift. Someone edited it in the Twilio console, or APP_URL
    // changed and we forgot to re-PATCH. Calls reach Twilio but go nowhere.
    if (normUrl(tw.voiceUrl) !== normUrl(expected.voiceUrl)) {
      findings.push({
        check_name: 'twilio_voice_url_mismatch',
        severity: 'P0',
        client_slug: c.slug,
        summary: `voiceUrl drift on ${c.twilio_number}`,
        details: {
          twilio_number: c.twilio_number,
          twilio_sid: tw.sid,
          expected: expected.voiceUrl,
          actual: tw.voiceUrl ?? '(empty)',
          remediation: 'Re-run ensureTwilioProvisioned or PATCH the IncomingPhoneNumber.VoiceUrl in Twilio',
        },
      })
    }

    // ── twilio_voice_fallback_url_mismatch ───────────────────────────────
    if (expected.voiceFallbackUrl && normUrl(tw.voiceFallbackUrl) !== normUrl(expected.voiceFallbackUrl)) {
      findings.push({
        check_name: 'twilio_voice_fallback_url_mismatch',
        severity: 'P1',
        client_slug: c.slug,
        summary: `voiceFallbackUrl drift on ${c.twilio_number}`,
        details: {
          twilio_number: c.twilio_number,
          twilio_sid: tw.sid,
          expected: expected.voiceFallbackUrl,
          actual: tw.voiceFallbackUrl ?? '(empty)',
          remediation: 'Repoint Twilio fallback URL to the Cloudflare Worker (fallback.endvoicemail.ai)',
        },
      })
    }

    // ── twilio_status_callback_mismatch ──────────────────────────────────
    if (expected.statusCallback && normUrl(tw.statusCallback) !== normUrl(expected.statusCallback)) {
      findings.push({
        check_name: 'twilio_status_callback_mismatch',
        severity: 'P1',
        client_slug: c.slug,
        summary: `statusCallback drift on ${c.twilio_number}`,
        details: {
          twilio_number: c.twilio_number,
          twilio_sid: tw.sid,
          expected: expected.statusCallback,
          actual: tw.statusCallback ?? '(empty)',
        },
      })
    }

    // ── twilio_number_capabilities_missing ───────────────────────────────
    // Voice is required for every client. SMS only if the client has
    // sms_enabled in DB. We DON'T alert when Twilio has more capabilities
    // than the client uses — that's normal (long-code SMS is bundled).
    const missing: string[] = []
    if (tw.capabilities.voice === false) missing.push('voice')
    if (c.sms_enabled && tw.capabilities.sms === false) missing.push('sms')
    if (missing.length > 0) {
      findings.push({
        check_name: 'twilio_number_capabilities_missing',
        severity: 'P1',
        client_slug: c.slug,
        summary: `Capability missing on ${c.twilio_number}: ${missing.join(', ')}`,
        details: {
          twilio_number: c.twilio_number,
          twilio_sid: tw.sid,
          missing,
          capabilities: tw.capabilities,
          sms_enabled_in_db: !!c.sms_enabled,
          remediation: 'Twilio cannot add capabilities to an existing number — release + repurchase, or order a number that supports them.',
        },
      })
    }
  }

  // ── twilio_number_orphan_in_account ────────────────────────────────────
  // Twilio has numbers we are not using. We pay $1.15/mo per number; this is
  // pure waste. NULL client_slug because the finding belongs to the account,
  // not a tenant.
  for (const tw of inventory) {
    if (dbNumbers.has(tw.phoneNumber)) continue
    findings.push({
      check_name: 'twilio_number_orphan_in_account',
      severity: 'P1',
      client_slug: null,
      summary: `Unused Twilio number on account: ${tw.phoneNumber} (status=${tw.status})`,
      details: {
        twilio_number: tw.phoneNumber,
        twilio_sid: tw.sid,
        status: tw.status,
        voice_url: tw.voiceUrl,
        remediation: 'If truly unused, release in Twilio console to stop the $1.15/mo charge. If reserved for a future client, document in number_inventory.',
      },
    })
  }

  return findings
}

/**
 * URL comparison helper. Normalizes trailing slash + querystring whitespace
 * so a cosmetic difference between Twilio's stored form and our expected
 * string doesn't generate noise.
 */
function normUrl(u: string | null | undefined): string {
  if (!u) return ''
  return u.trim().replace(/\/+$/, '')
}
