/**
 * Shared email footer for all End Voicemail transactional + lifecycle emails.
 *
 * Why: Gmail bulk-sender rules (Feb 2024) require List-Unsubscribe headers + a
 * visible unsubscribe in the body. CASL (Canadian Anti-Spam Law) also requires
 * a physical mailing address + unsubscribe in every commercial email.
 *
 * Use via `buildBrandedFooter()` — never inline a footer per email site.
 */

import { BRAND_NAME, BRAND_DOMAIN, HELLO_EMAIL, SUPPORT_EMAIL } from '@/lib/brand'

const MAILING_ADDRESS =
  process.env.BRAND_MAILING_ADDRESS ||
  'End Voicemail · Calgary, AB · Canada'

export interface FooterContext {
  /** Recipient's email — used to build one-click unsubscribe URL */
  recipientEmail?: string | null
  /** Recipient's client_id (preferred — exact match in unsubscribe handler) */
  clientId?: string | null
  /** Slug for context (optional, narrows the unsubscribe match) */
  clientSlug?: string | null
  /** Why are they getting this? Plain English. */
  reason?: string
}

/** Build the one-click unsubscribe URL (matches /api/email/unsubscribe-one-click contract). */
export function buildUnsubscribeUrl(ctx: FooterContext): string {
  const params = new URLSearchParams()
  if (ctx.recipientEmail) params.set('email', ctx.recipientEmail)
  if (ctx.clientId) params.set('cid', ctx.clientId)
  if (ctx.clientSlug) params.set('slug', ctx.clientSlug)
  return `https://${BRAND_DOMAIN}/api/email/unsubscribe-one-click?${params.toString()}`
}

export interface FooterHtmlText {
  html: string
  text: string
}

/** Build the HTML + plain-text footer block for transactional emails. */
export function buildBrandedFooter(ctx: FooterContext): FooterHtmlText {
  const unsubUrl = buildUnsubscribeUrl(ctx)
  const reason =
    ctx.reason ||
    `You're receiving this because you have an account at ${BRAND_NAME}.`

  const html = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:32px;border-top:1px solid #eee;padding-top:20px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <tr><td style="font-size:13px;color:#555;line-height:1.5">
    <strong style="color:#111">${BRAND_NAME}</strong> — End voicemail. Answer every call.<br>
    <a href="https://${BRAND_DOMAIN}" style="color:#555;text-decoration:none">${BRAND_DOMAIN}</a>
    &nbsp;·&nbsp;
    <a href="mailto:${HELLO_EMAIL}" style="color:#555;text-decoration:none">${HELLO_EMAIL}</a>
    &nbsp;·&nbsp;
    <a href="mailto:${SUPPORT_EMAIL}" style="color:#555;text-decoration:none">${SUPPORT_EMAIL}</a>
  </td></tr>
  <tr><td style="font-size:12px;color:#888;line-height:1.5;padding-top:12px">
    ${reason}<br>
    <a href="${unsubUrl}" style="color:#888;text-decoration:underline">Unsubscribe</a>
    &nbsp;·&nbsp;
    <a href="https://${BRAND_DOMAIN}/dashboard/notifications" style="color:#888;text-decoration:underline">Manage email preferences</a>
  </td></tr>
  <tr><td style="font-size:11px;color:#aaa;line-height:1.5;padding-top:12px">
    ${MAILING_ADDRESS}
  </td></tr>
</table>`.trim()

  const text = `
—
${BRAND_NAME} — End voicemail. Answer every call.
${BRAND_DOMAIN}  ·  ${HELLO_EMAIL}  ·  ${SUPPORT_EMAIL}

${reason}
Unsubscribe: ${unsubUrl}
Manage email preferences: https://${BRAND_DOMAIN}/dashboard/notifications

${MAILING_ADDRESS}
`.trim()

  return { html, text }
}

/** Build the standard List-Unsubscribe headers for Gmail RFC 8058. */
export function buildUnsubscribeHeaders(
  ctx: FooterContext
): Record<string, string> {
  const url = buildUnsubscribeUrl(ctx)
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
