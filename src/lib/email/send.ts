/**
 * Centralized branded email send helper.
 *
 * Why: every transactional and lifecycle email from End Voicemail must include
 *   - List-Unsubscribe + List-Unsubscribe-Post headers (Gmail Feb 2024 bulk-sender rules)
 *   - Plain-text body alongside HTML (anti-spam signal)
 *   - Branded footer with reason-for-receiving + CASL mailing address
 *   - Consistent Reply-To
 *   - Sender purpose maps to correct From address
 *
 * Direct calls to `resend.emails.send()` skip these — use this helper instead.
 */

import { Resend } from 'resend'
import { BRAND_NAME, HELLO_EMAIL, NOTIFICATIONS_EMAIL, SUPPORT_EMAIL } from '@/lib/brand'
import {
  buildBrandedFooter,
  buildUnsubscribeHeaders,
  type FooterContext,
} from './footer'

export type EmailPurpose = 'system' | 'marketing' | 'support'

export interface BrandedEmailInput extends FooterContext {
  to: string | string[]
  subject: string
  /** Body HTML — footer is appended automatically. Do NOT include your own footer. */
  html: string
  /** Optional plain-text body. If omitted, generated from HTML. */
  text?: string
  /** Choose From address by purpose. Defaults to 'system' (notifications@). */
  purpose?: EmailPurpose
  /** Optional Reply-To override (defaults to support@). */
  replyTo?: string
  /** Tagged for Resend analytics (e.g. 'welcome', 'daily_digest'). */
  tag?: string
}

export interface BrandedEmailResult {
  ok: boolean
  id?: string
  error?: string
}

function pickFrom(purpose: EmailPurpose): string {
  switch (purpose) {
    case 'marketing':
      return `${BRAND_NAME} <${HELLO_EMAIL}>`
    case 'support':
      return `${BRAND_NAME} Support <${SUPPORT_EMAIL}>`
    case 'system':
    default:
      return `${BRAND_NAME} <${NOTIFICATIONS_EMAIL}>`
  }
}

/** Strip HTML for fallback plain-text body. Keeps line breaks and link URLs. */
function htmlToText(html: string): string {
  return html
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function sendBrandedEmail(
  input: BrandedEmailInput
): Promise<BrandedEmailResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'RESEND_API_KEY not configured' }

  const purpose = input.purpose ?? 'system'
  const from = pickFrom(purpose)
  const replyTo = input.replyTo ?? SUPPORT_EMAIL

  const footer = buildBrandedFooter(input)
  const headers = buildUnsubscribeHeaders(input)

  const fullHtml = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
${input.html}
${footer.html}
</div>`

  const baseText = input.text ?? htmlToText(input.html)
  const fullText = `${baseText}\n\n${footer.text}`

  try {
    const resend = new Resend(key)
    const result = await resend.emails.send({
      from,
      to: Array.isArray(input.to) ? input.to : [input.to],
      replyTo,
      subject: input.subject,
      html: fullHtml,
      text: fullText,
      headers,
      tags: input.tag ? [{ name: 'purpose', value: input.tag }] : undefined,
    })
    if (result.error) {
      return { ok: false, error: result.error.message ?? String(result.error) }
    }
    return { ok: true, id: result.data?.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
