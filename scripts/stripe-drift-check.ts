/**
 * stripe-drift-check.ts — nightly Stripe ↔ Supabase drift harness.
 *
 * Catches the class of bug that no other harness catches: silent revenue leak
 * where Stripe and our DB disagree on subscription state. See
 * src/lib/stripe-drift.ts for the comparison rules + rationale per check.
 *
 * What this is NOT: an auto-fixer. We never mutate clients.* or call Stripe
 * write endpoints from here. Findings go to harness_findings via
 * recordFindings(); the operator triages from /admin/harness and corrects DB
 * (or re-emits the Stripe webhook) by hand. Auto-mutation of billing state is
 * a foot-gun we don't want a cron pulling on its own.
 *
 * Pairing with other nightlies (UTC schedule):
 *   09:00 nightly-drift-check          (Supabase ↔ Ultravox)
 *   09:30 data-hygiene-check           (Supabase-only audit)
 *   09:45 stripe-drift-check           (Supabase ↔ Stripe)  ← this one
 *
 * Run:
 *   npx tsx scripts/stripe-drift-check.ts            # report + Telegram + recordFindings
 *   npx tsx scripts/stripe-drift-check.ts --dry-run  # log only, no DB writes, no Telegram
 *
 * Exit codes (see exitCodeForFindings):
 *   0 = clean, 1 = any P0, 2 = any P1 (and no P0).
 *
 * Required env:
 *   STRIPE_SECRET_KEY               — live mode key (sk_live_*) for prod runs
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TELEGRAM_BOT_TOKEN              — only required unless --dry-run
 *   TELEGRAM_OWNER_CHAT_ID          — optional; falls back to hasan-sharif.telegram_chat_id
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { recordFindings, type Finding } from '../src/lib/harness-writer.js'
import {
  checkClient,
  checkOrphanActiveSubs,
  exitCodeForFindings,
  type DbClientForStripeCheck,
  type StripeCustomerLookup,
  type StripeDriftFinding,
  type StripeSnapshotForClient,
  type StripeSubLookup,
} from '../src/lib/stripe-drift.js'

const DRY_RUN = process.argv.includes('--dry-run')

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID

if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('[stripe-drift] Missing required env: STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}
if (!DRY_RUN && !TELEGRAM_BOT_TOKEN) {
  console.error('[stripe-drift] Missing TELEGRAM_BOT_TOKEN (required unless --dry-run)')
  process.exit(2)
}

const RUN_ID = process.env.GITHUB_RUN_ID ?? String(Date.now())

function getStripe(): Stripe {
  // Same apiVersion as src/app/api/webhook/stripe/route.ts — keep these in lock-step.
  return new Stripe(STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
}

/** Convert any thrown error into a string we can record in details/log. */
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

/** Wrap a Stripe SDK retrieve into the StripeSubLookup union. */
async function fetchSub(stripe: Stripe, subId: string): Promise<StripeSubLookup> {
  try {
    const sub = await stripe.subscriptions.retrieve(subId)
    return {
      kind: 'found',
      sub: {
        id: sub.id,
        status: sub.status,
        trial_end: sub.trial_end ?? null,
        customer_id: typeof sub.customer === 'string' ? sub.customer : (sub.customer as { id: string } | null)?.id ?? null,
      },
    }
  } catch (e) {
    // Stripe SDK throws StripeInvalidRequestError with code 'resource_missing' on 404.
    const code = (e as { code?: string }).code
    const statusCode = (e as { statusCode?: number }).statusCode
    if (code === 'resource_missing' || statusCode === 404) {
      return { kind: 'not_found' }
    }
    return { kind: 'error', message: errMsg(e) }
  }
}

/** Wrap a Stripe SDK retrieve into the StripeCustomerLookup union. */
async function fetchCustomer(stripe: Stripe, customerId: string): Promise<StripeCustomerLookup> {
  try {
    const c = await stripe.customers.retrieve(customerId)
    // Stripe types retrieved Customer as Customer | DeletedCustomer (union by `deleted`).
    if ((c as { deleted?: boolean }).deleted) {
      return { kind: 'found', customer: { id: c.id, deleted: true } }
    }
    return { kind: 'found', customer: { id: c.id, deleted: false } }
  } catch (e) {
    const code = (e as { code?: string }).code
    const statusCode = (e as { statusCode?: number }).statusCode
    if (code === 'resource_missing' || statusCode === 404) {
      return { kind: 'not_found' }
    }
    return { kind: 'error', message: errMsg(e) }
  }
}

/**
 * Pull DB rows that have any Stripe linkage worth comparing. We deliberately
 * include rows where subscription_status is in (active|trialing|past_due) OR
 * either stripe_*_id is non-null — that way we catch (a) rows that lost their
 * Stripe id mid-flight and (b) rows that have a Stripe id but are flagged
 * inactive in our DB (we still want to verify Stripe hasn't moved them).
 */
async function fetchClients(sb: SupabaseClient): Promise<DbClientForStripeCheck[]> {
  const { data, error } = await sb
    .from('clients')
    .select('id, slug, subscription_status, stripe_subscription_id, stripe_customer_id, selected_plan')
    .or('subscription_status.in.(active,trialing,past_due),stripe_subscription_id.not.is.null,stripe_customer_id.not.is.null')
    .order('slug')

  if (error) throw new Error(`clients query failed: ${error.message}`)
  type Row = {
    id: string
    slug: string
    subscription_status: string | null
    stripe_subscription_id: string | null
    stripe_customer_id: string | null
    selected_plan: string | null
  }
  return (data as Row[] ?? []).map(r => ({
    id: r.id,
    slug: r.slug,
    subscription_status: r.subscription_status,
    stripe_subscription_id: r.stripe_subscription_id,
    stripe_customer_id: r.stripe_customer_id,
    selected_plan: r.selected_plan,
  }))
}

/**
 * Cross-source orphan check. Lists Stripe's currently-active subs and reports
 * any whose customer is not in our DB. Only emits findings when the Stripe sub
 * carries metadata.unmissed_slug — without that tag we can't distinguish "ours
 * but missing" from "billed via another product on the same Stripe account".
 *
 * If no subs have the tag at all, the check is a no-op (we log a note). When
 * the tag convention is added to checkout sessions later, this check starts
 * producing findings automatically with no code change.
 */
async function fetchStripeOrphanCandidates(stripe: Stripe): Promise<Array<{
  id: string; customer_id: string | null; status: string; metadata_slug: string | null
}>> {
  const out: Array<{ id: string; customer_id: string | null; status: string; metadata_slug: string | null }> = []
  for await (const sub of stripe.subscriptions.list({ status: 'active', limit: 100 })) {
    const slug =
      (sub.metadata as Record<string, string> | null | undefined)?.unmissed_slug ??
      (sub.metadata as Record<string, string> | null | undefined)?.client_slug ??
      null
    out.push({
      id: sub.id,
      customer_id: typeof sub.customer === 'string' ? sub.customer : (sub.customer as { id: string } | null)?.id ?? null,
      status: sub.status,
      metadata_slug: slug,
    })
  }
  return out
}

async function resolveOwnerChatId(sb: SupabaseClient): Promise<string | null> {
  if (TELEGRAM_OWNER_CHAT_ID) return TELEGRAM_OWNER_CHAT_ID
  const { data, error } = await sb
    .from('clients')
    .select('telegram_chat_id')
    .eq('slug', 'hasan-sharif')
    .maybeSingle()
  if (error) {
    console.warn(`[stripe-drift] owner chat-id lookup failed: ${error.message}`)
    return null
  }
  return (data as { telegram_chat_id: string | null } | null)?.telegram_chat_id ?? null
}

async function sendTelegram(chatId: string, message: string): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    console.error(`[stripe-drift] Telegram send failed HTTP ${res.status}: ${await res.text().catch(() => '')}`)
    return false
  }
  return true
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Telegram body — only P0 findings; P1 is dashboard-only to avoid alert fatigue. */
function formatTelegramMessage(findings: StripeDriftFinding[], checkedCount: number): string {
  const p0 = findings.filter(f => f.severity === 'P0')
  if (p0.length === 0) return ''
  const bySlug = new Map<string, StripeDriftFinding[]>()
  for (const f of p0) {
    const slug = f.client_slug ?? '(fleet)'
    const list = bySlug.get(slug) ?? []
    list.push(f)
    bySlug.set(slug, list)
  }
  const lines: string[] = [
    `💸 <b>Stripe Drift Check</b> — ${p0.length} P0 finding(s) across ${bySlug.size}/${checkedCount} client(s)`,
    `<i>Silent revenue leak class — Stripe and DB disagree.</i>`,
    '',
  ]
  const slugs = Array.from(bySlug.keys()).slice(0, 8)
  for (const slug of slugs) {
    const items = bySlug.get(slug)!
    lines.push(`<b>${escapeHtml(slug)}</b>`)
    for (const f of items.slice(0, 6)) {
      lines.push(`  • <code>${escapeHtml(f.check_name)}</code> — ${escapeHtml(truncate(f.summary, 140))}`)
    }
    if (items.length > 6) lines.push(`  • …and ${items.length - 6} more`)
    lines.push('')
  }
  if (bySlug.size > slugs.length) {
    lines.push(`<i>…and ${bySlug.size - slugs.length} more client(s) — see /admin/harness</i>`)
  }
  return lines.join('\n')
}

async function main(): Promise<number> {
  console.log(`[stripe-drift] Starting${DRY_RUN ? ' (dry-run)' : ''} run_id=${RUN_ID}`)
  const sb = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
  const stripe = getStripe()

  const clients = await fetchClients(sb)
  console.log(`[stripe-drift] fetched ${clients.length} client(s) with Stripe linkage`)

  const allFindings: StripeDriftFinding[] = []
  const errors: Array<{ slug: string; where: string; message: string }> = []

  // ── Per-client checks ─────────────────────────────────────────────
  for (const c of clients) {
    let subLookup: StripeSubLookup | null = null
    let custLookup: StripeCustomerLookup | null = null

    if (c.stripe_subscription_id) {
      subLookup = await fetchSub(stripe, c.stripe_subscription_id)
      if (subLookup.kind === 'error') {
        errors.push({ slug: c.slug, where: 'subscriptions.retrieve', message: subLookup.message })
      }
    }
    if (c.stripe_customer_id) {
      custLookup = await fetchCustomer(stripe, c.stripe_customer_id)
      if (custLookup.kind === 'error') {
        errors.push({ slug: c.slug, where: 'customers.retrieve', message: custLookup.message })
      }
    }

    const snap: StripeSnapshotForClient = { sub: subLookup, customer: custLookup }
    const findings = checkClient(c, snap)
    if (findings.length > 0) {
      console.log(`  [DRIFT] ${c.slug} — ${findings.length} finding(s)`)
      for (const f of findings) console.log(`     · [${f.severity}] ${f.check_name}: ${truncate(f.summary, 100)}`)
    } else {
      console.log(`  [OK   ] ${c.slug}`)
    }
    allFindings.push(...findings)
  }

  // ── Orphan-active-sub check (reverse direction) ───────────────────
  try {
    const stripeActive = await fetchStripeOrphanCandidates(stripe)
    const tagged = stripeActive.filter(s => s.metadata_slug)
    if (stripeActive.length > 0 && tagged.length === 0) {
      console.log(`[stripe-drift] orphan check: ${stripeActive.length} active Stripe sub(s) found but none carry metadata.unmissed_slug — skipping (tag not in use yet)`)
    } else if (tagged.length > 0) {
      const dbSubIds = new Set(clients.map(c => c.stripe_subscription_id).filter((x): x is string => !!x))
      const dbCustIds = new Set(clients.map(c => c.stripe_customer_id).filter((x): x is string => !!x))
      const orphans = checkOrphanActiveSubs(tagged, dbSubIds, dbCustIds)
      if (orphans.length > 0) {
        console.log(`[stripe-drift] orphan check: ${orphans.length} orphan finding(s)`)
        for (const f of orphans) console.log(`     · [${f.severity}] ${f.check_name}: ${truncate(f.summary, 100)}`)
      }
      allFindings.push(...orphans)
    }
  } catch (e) {
    console.error(`[stripe-drift] orphan check failed: ${errMsg(e)}`)
    errors.push({ slug: '(fleet)', where: 'subscriptions.list', message: errMsg(e) })
  }

  console.log(`[stripe-drift] checked=${clients.length} findings=${allFindings.length} stripe_errors=${errors.length}`)

  // ── Persist to harness_findings ────────────────────────────────────
  if (!DRY_RUN) {
    const writerFindings: Finding[] = allFindings.map(f => ({
      check_name: f.check_name,
      severity: f.severity,
      client_slug: f.client_slug,
      summary: f.summary,
      details: f.details,
    }))
    if (writerFindings.length > 0) {
      try {
        const res = await recordFindings({ harness: 'stripe-drift', run_id: RUN_ID, findings: writerFindings })
        console.log(`[stripe-drift] recordFindings: written=${res.written} reopened=${res.reopened} errors=${res.errors.length}`)
        for (const errLine of res.errors) console.error(`  [writer] ${errLine}`)
      } catch (e) {
        console.error(`[stripe-drift] recordFindings threw: ${errMsg(e)}`)
      }
    } else {
      console.log('[stripe-drift] No findings — nothing to record.')
    }
  } else {
    console.log(`[stripe-drift] DRY RUN — skipping recordFindings (${allFindings.length} would be written)`)
  }

  // ── Telegram (P0 only) ────────────────────────────────────────────
  if (!DRY_RUN) {
    const tgMsg = formatTelegramMessage(allFindings, clients.length)
    if (tgMsg) {
      const chat = await resolveOwnerChatId(sb)
      if (!chat) {
        console.error('[stripe-drift] No owner chat-id available — cannot send Telegram alert')
      } else {
        const sent = await sendTelegram(chat, tgMsg)
        if (sent) console.log('[stripe-drift] P0 Telegram alert sent')
      }
    } else {
      console.log('[stripe-drift] No P0 findings — no Telegram alert')
    }
  } else if (allFindings.some(f => f.severity === 'P0')) {
    console.log('[stripe-drift] DRY RUN — would send Telegram for P0 findings')
  }

  return exitCodeForFindings(allFindings)
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('[stripe-drift] Fatal:', err)
    process.exit(2)
  })
