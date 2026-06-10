/**
 * Trial welcome email — sent automatically after /api/provision/trial succeeds.
 *
 * Parameterized version of the manually-sent concierge welcome
 * (scripts/send-aman-welcome.ts): same structure, sections, and inline styles,
 * but generic — no per-client hardcoded numbers, credentials, or personal
 * reply-to. Replies route to hello@ (brand inbox), not a personal Gmail.
 *
 * `buildTrialWelcomeEmail()` is pure (testable — no env, no I/O).
 * `sendTrialWelcomeEmail()` wraps it with sendBrandedEmail() so the email gets
 * List-Unsubscribe headers, plain-text body, branded footer, and a
 * notification_logs audit row for free.
 */

import { BRAND_NAME, HELLO_EMAIL } from '@/lib/brand'
import { APP_URL } from '@/lib/app-url'
import { CARRIER_CODES, fillEnableCode } from '@/lib/carrier-codes'
import { sendBrandedEmail, type BrandedEmailResult } from './send'

export interface TrialWelcomeParams {
  to: string
  /** Owner's name from intake — first name is used in the greeting. */
  contactName?: string | null
  businessName: string
  /** Agent display name (e.g. "Riley"). Falls back to "Your agent". */
  agentName?: string | null
  clientId: string
  clientSlug: string
  /** clients.carrier_id — key into CARRIER_CODES. Carrier section omitted when unknown. */
  carrierId?: string | null
  /** AI number to forward to. Trials have none — codes render with a placeholder. */
  twilioNumber?: string | null
  trialDays?: number
}

export interface TrialWelcomeEmail {
  subject: string
  html: string
}

const STYLES = `
<style>
  .ev-h1 { font-size: 22px; font-weight: 700; margin: 0 0 16px; letter-spacing: -0.01em; color: #0F172A; }
  .ev-lead { font-size: 15.5px; line-height: 1.65; color: #1F2937; margin: 0 0 20px; }
  .ev-section { margin: 28px 0 0; padding: 20px 22px; background: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 10px; }
  .ev-step-badge { display: inline-block; background: #0F172A; color: white; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; margin-bottom: 10px; }
  .ev-step-title { font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 8px; }
  .ev-step-body { font-size: 14.5px; line-height: 1.6; color: #374151; margin: 0; }
  .ev-step-body p { margin: 8px 0; }
  .ev-step-body ul { margin: 8px 0 0; padding-left: 20px; }
  .ev-step-body li { margin: 4px 0; }
  .ev-cta { display: inline-block; background: #4F46E5; color: white !important; text-decoration: none; padding: 13px 24px; border-radius: 8px; font-weight: 600; font-size: 14.5px; margin: 6px 0; }
  .ev-code-box { background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px 16px; margin: 12px 0; font-size: 14px; }
  .ev-code-box code { background: #F3F4F6; padding: 2px 6px; border-radius: 4px; font-family: SF Mono, Menlo, Consolas, monospace; font-size: 13px; color: #0F172A; }
  .ev-code-row { margin: 6px 0; }
  .ev-sig { margin-top: 28px; font-size: 15px; color: #1F2937; }
</style>
`.trim()

/** First word of the contact name, or null. */
function firstName(name?: string | null): string | null {
  return name?.trim().split(/\s+/)[0] || null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Carrier-specific forwarding section. Returns '' when the carrier is unknown
 * (graceful fallback — the dashboard Go Live flow covers it instead).
 */
function buildCarrierSection(
  carrierId: string | null | undefined,
  twilioNumber: string | null | undefined,
): string {
  const carrier = carrierId ? CARRIER_CODES[carrierId] : undefined
  if (!carrier) return ''

  const hasNumber = !!twilioNumber?.trim()
  const conditions = [
    carrier.conditions.noAnswer,
    carrier.conditions.busy,
    carrier.conditions.unreachable,
  ]

  const enableRows = conditions
    .map((c) => {
      const code = hasNumber
        ? fillEnableCode(c.enable, twilioNumber!.trim())
        : c.enable.replace('{number}', '&lt;your AI number&gt;')
      return `<p class="ev-code-row"><code>${code}</code> — ${escapeHtml(c.desc)}</p>`
    })
    .join('\n      ')

  const disableRows = conditions
    .map((c) => `<code>${c.disable}</code>`)
    .join(' ')

  return `
<div class="ev-section">
  <span class="ev-step-badge">When you're ready for real calls</span>
  <p class="ev-step-title">Forward your ${escapeHtml(carrier.name)} line.</p>
  <div class="ev-step-body">
    <p>Once you activate a real AI number, dial these three codes on your ${escapeHtml(carrier.name)} phone. Your phone keeps ringing first — the AI only picks up when you can't.</p>
    ${hasNumber ? '' : `<p>Your AI number gets assigned when you activate — the dashboard will show these codes pre-filled. Saving them here so you know what's coming:</p>`}
    <div class="ev-code-box">
      ${enableRows}
    </div>
    <p>To turn forwarding off anytime: ${disableRows}</p>
    ${carrier.note ? `<p>${escapeHtml(carrier.note)}</p>` : ''}
  </div>
</div>`.trim()
}

/** Pure builder — no env reads, no I/O. */
export function buildTrialWelcomeEmail(params: TrialWelcomeParams): TrialWelcomeEmail {
  const name = firstName(params.contactName)
  const agent = params.agentName?.trim() || 'Your agent'
  const business = escapeHtml(params.businessName)
  const trialDays = params.trialDays ?? 7
  const loginUrl = `${APP_URL}/login?email=${encodeURIComponent(params.to)}`

  const subject = `${agent === 'Your agent' ? 'Your AI agent' : agent} is live for ${params.businessName}`

  const carrierSection = buildCarrierSection(params.carrierId, params.twilioNumber)

  const html = `
${STYLES}

<p class="ev-h1">Your AI receptionist is live${name ? `, ${escapeHtml(name)}` : ''}.</p>

<p class="ev-lead">
<strong>${escapeHtml(agent)}</strong> is now answering for <strong>${business}</strong>.
${escapeHtml(agent)} takes messages, captures caller details, and flags urgent calls —
so a missed call never means a lost customer.
</p>

<div class="ev-section">
  <span class="ev-step-badge">Step 1</span>
  <p class="ev-step-title">Test ${escapeHtml(agent)} right now.</p>
  <div class="ev-step-body">
    <p>Log into your dashboard and run a browser test call — no phone setup needed. You'll hear exactly what your callers will hear.</p>
    <p style="margin-top: 14px;">
      <a href="${loginUrl}" class="ev-cta">Open my dashboard →</a>
    </p>
    <p>Sign in with this email address — use the magic link or "Sign in with Google".</p>
  </div>
</div>

<div class="ev-section">
  <span class="ev-step-badge">Step 2</span>
  <p class="ev-step-title">Make ${escapeHtml(agent)} yours.</p>
  <div class="ev-step-body">
    <p>Everything is editable from the dashboard. Things people commonly tweak on day one:</p>
    <ul>
      <li><strong>Rename the agent</strong> — Settings → Agent Identity</li>
      <li><strong>Swap the voice</strong> — 20+ options in Settings → Voice</li>
      <li><strong>Edit the greeting</strong> — change what callers hear first</li>
      <li><strong>Add FAQs</strong> — anything you want answered cold (pricing policy, hours, service area)</li>
    </ul>
    <p style="margin-top: 10px;">The defaults are tuned for your industry — it works fine out of the box.</p>
  </div>
</div>

${carrierSection}

<div class="ev-section">
  <span class="ev-step-badge">Your ${trialDays}-day trial</span>
  <p class="ev-step-title">What's included.</p>
  <div class="ev-step-body">
    <ul>
      <li>Unlimited browser test calls to try your agent</li>
      <li>Full dashboard — call log, transcripts, and recordings</li>
      <li>Agent customization — name, voice, greeting, FAQs, hours</li>
    </ul>
    <p style="margin-top: 10px;">When you're ready for real calls, activate a dedicated AI number from the dashboard and forward your line to it. No card needed during the trial.</p>
  </div>
</div>

<p class="ev-step-body" style="margin-top: 24px;">
Anything sounds off — just hit reply. A real person reads every message.
</p>

<p class="ev-sig">— The ${BRAND_NAME} team</p>
`.trim()

  return { subject, html }
}

/**
 * Send the trial welcome email. Never throws — returns { ok: false } on failure
 * so callers can fire-and-forget without an unhandled rejection.
 */
export async function sendTrialWelcomeEmail(
  params: TrialWelcomeParams,
): Promise<BrandedEmailResult> {
  try {
    const { subject, html } = buildTrialWelcomeEmail(params)
    return await sendBrandedEmail({
      to: params.to,
      subject,
      html,
      purpose: 'system',
      replyTo: HELLO_EMAIL,
      tag: 'trial_welcome',
      clientId: params.clientId,
      clientSlug: params.clientSlug,
      recipientEmail: params.to,
      reason: `You're receiving this because you started a ${BRAND_NAME} trial for ${params.businessName}.`,
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
