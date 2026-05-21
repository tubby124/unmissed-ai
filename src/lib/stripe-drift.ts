/**
 * stripe-drift.ts — pure check functions for nightly Stripe↔Supabase drift harness.
 *
 * Why split out from scripts/stripe-drift-check.ts: the comparison logic must be
 * unit-testable against synthetic Stripe payloads (no live key, no network). The
 * script is the IO orchestration layer (Supabase fetch + Stripe SDK + Telegram);
 * this file is the rules.
 *
 * What this catches that nothing else does:
 *   - Customer cancels in Stripe Customer Portal → Stripe sets status=canceled,
 *     missed webhook leaves clients.subscription_status='active'. Silent revenue
 *     leak: we keep treating them as paying; they freeloaded.
 *   - Refund issued in Stripe → DB never downgraded. Pro features retained.
 *   - Charge failed (insufficient funds / dispute) → Stripe moves to past_due;
 *     DB stays active.
 *   - DB has stripe_subscription_id that no longer exists in Stripe.
 *   - DB says trialing but Stripe trial converted weeks ago.
 *   - DB has stripe_customer_id pointing at a deleted Stripe customer.
 *   - (Reverse) Stripe has an active sub whose customer_id is orphaned (DB
 *     doesn't know about it).
 *
 * The webhook handler in src/app/api/webhook/stripe/route.ts is the primary
 * sync path. This harness is the safety net for when a webhook delivery is
 * dropped, a handler errors out mid-update, or someone clicks something in the
 * Stripe Dashboard that doesn't emit the event we expect.
 *
 * Severity model (maps to harness-writer.ts Severity):
 *   P0 — silent revenue leak in progress (DB says paying, Stripe says not)
 *   P1 — billing condition the DB hasn't picked up yet (past_due, orphan)
 *   PASS — silent
 */

import type { Severity } from './harness-writer'

// ─── Minimal Stripe shape projections ─────────────────────────────────
// Why hand-rolled types instead of importing from the Stripe SDK: keeps this
// file zero-dependency so it tree-shakes into anything that wants the pure
// logic (including tests that don't want to load the Stripe SDK). The script
// layer projects live Stripe.Subscription / Stripe.Customer objects down to
// these shapes before calling the checks.

export interface StripeSubProjection {
  id: string
  /** Stripe API status enum. Common values:
   * 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' |
   * 'incomplete_expired' | 'unpaid' | 'paused' */
  status: string
  /** Unix seconds when the trial ends. null if no trial. */
  trial_end: number | null
  customer_id: string | null
}

export interface StripeCustomerProjection {
  id: string
  /** Stripe's `deleted: true` flag on retrieved Customer objects. */
  deleted: boolean
}

export type StripeSubLookup =
  | { kind: 'found'; sub: StripeSubProjection }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string }

export type StripeCustomerLookup =
  | { kind: 'found'; customer: StripeCustomerProjection }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string }

// ─── Inputs ───────────────────────────────────────────────────────────

export interface DbClientForStripeCheck {
  id: string
  slug: string
  subscription_status: string | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  selected_plan: string | null
}

export interface StripeSnapshotForClient {
  /** Result of stripe.subscriptions.retrieve(stripe_subscription_id), or null if
   *  the DB row had no stripe_subscription_id to look up. */
  sub: StripeSubLookup | null
  /** Result of stripe.customers.retrieve(stripe_customer_id), or null if
   *  the DB row had no stripe_customer_id to look up. */
  customer: StripeCustomerLookup | null
}

// ─── Finding shape (compatible with harness-writer Finding) ────────────

export interface StripeDriftFinding {
  check_name: string
  severity: Severity
  client_slug: string | null
  summary: string
  details: Record<string, unknown>
}

// ─── DB-anchored statuses we expect Stripe to corroborate ─────────────

const DB_PAYING_STATUSES = new Set(['active', 'trialing', 'past_due'])
const STRIPE_DEAD_STATUSES = new Set(['canceled', 'incomplete_expired', 'unpaid', 'paused'])

// ─── Check functions ──────────────────────────────────────────────────

/**
 * Compare a single client's DB state to its Stripe state.
 *
 * Order matters: stripe_customer_deleted is reported before
 * stripe_sub_missing because a deleted customer also implicitly invalidates
 * the sub — but the customer-level finding is the more actionable root cause.
 */
export function checkClient(
  client: DbClientForStripeCheck,
  snap: StripeSnapshotForClient,
  now: number = Date.now(),
): StripeDriftFinding[] {
  const findings: StripeDriftFinding[] = []
  const slug = client.slug

  // ── stripe_customer_deleted (P0) ────────────────────────────────────
  // DB believes we have a paying customer in Stripe; Stripe says that customer
  // is deleted. All charges/subs against this customer have stopped. We may
  // still be granting access.
  if (client.stripe_customer_id && snap.customer) {
    if (snap.customer.kind === 'found' && snap.customer.customer.deleted) {
      findings.push({
        check_name: 'stripe_customer_deleted',
        severity: 'P0',
        client_slug: slug,
        summary: `Stripe customer ${client.stripe_customer_id} is deleted; DB still references it`,
        details: {
          stripe_customer_id: client.stripe_customer_id,
          db_subscription_status: client.subscription_status,
        },
      })
    } else if (snap.customer.kind === 'not_found') {
      // Stripe returned a hard 404 — customer object purged entirely. Same
      // category of leak; report as the same finding for dashboard simplicity.
      findings.push({
        check_name: 'stripe_customer_deleted',
        severity: 'P0',
        client_slug: slug,
        summary: `Stripe customer ${client.stripe_customer_id} not found (404); DB still references it`,
        details: {
          stripe_customer_id: client.stripe_customer_id,
          db_subscription_status: client.subscription_status,
          not_found: true,
        },
      })
    }
  }

  // ── stripe_sub_missing (P0) ─────────────────────────────────────────
  // DB has a sub id, Stripe returns 404. Either the sub was deleted (rare —
  // Stripe normally just marks status=canceled and retains the object) or the
  // id was corrupted/swapped in DB. Either way: we cannot reconcile billing.
  if (client.stripe_subscription_id && snap.sub) {
    if (snap.sub.kind === 'not_found') {
      findings.push({
        check_name: 'stripe_sub_missing',
        severity: 'P0',
        client_slug: slug,
        summary: `DB has stripe_subscription_id ${client.stripe_subscription_id} but Stripe returns 404`,
        details: {
          stripe_subscription_id: client.stripe_subscription_id,
          db_subscription_status: client.subscription_status,
        },
      })
    }
  }

  // ── stripe_status_mismatch (P0) ────────────────────────────────────
  // DB says paying (active/trialing/past_due); Stripe says dead. This is the
  // primary "silent revenue leak" finding — caller portal cancels, refunds,
  // unpaid auto-cancels all land here.
  if (
    snap.sub?.kind === 'found' &&
    client.subscription_status &&
    DB_PAYING_STATUSES.has(client.subscription_status) &&
    STRIPE_DEAD_STATUSES.has(snap.sub.sub.status)
  ) {
    findings.push({
      check_name: 'stripe_status_mismatch',
      severity: 'P0',
      client_slug: slug,
      summary: `DB says ${client.subscription_status}, Stripe says ${snap.sub.sub.status}`,
      details: {
        stripe_subscription_id: snap.sub.sub.id,
        db_subscription_status: client.subscription_status,
        stripe_subscription_status: snap.sub.sub.status,
      },
    })
  }

  // ── stripe_trial_converted_db_still_trialing (P0) ───────────────────
  // Stripe shows the trial already ended (trial_end < now AND status='active'),
  // but the DB never flipped from trialing to active. Result: minute caps and
  // entitlement gating still use trial values. Customer is paying but receiving
  // trial-tier service (and vice-versa for plan-gated features).
  if (
    snap.sub?.kind === 'found' &&
    client.subscription_status === 'trialing' &&
    snap.sub.sub.status === 'active' &&
    snap.sub.sub.trial_end !== null &&
    snap.sub.sub.trial_end * 1000 < now
  ) {
    findings.push({
      check_name: 'stripe_trial_converted_db_still_trialing',
      severity: 'P0',
      client_slug: slug,
      summary: `Stripe trial converted (trial_end past); DB still subscription_status=trialing`,
      details: {
        stripe_subscription_id: snap.sub.sub.id,
        stripe_trial_end_iso: new Date(snap.sub.sub.trial_end * 1000).toISOString(),
        db_subscription_status: 'trialing',
        stripe_subscription_status: snap.sub.sub.status,
      },
    })
  }

  // ── stripe_past_due_db_active (P1) ─────────────────────────────────
  // Stripe moved the sub to past_due (failed charge in retry loop). DB hasn't
  // caught up — invoice.payment_failed webhook may have been dropped. Customer
  // still has full access; we have not started the grace-period clock.
  if (
    snap.sub?.kind === 'found' &&
    snap.sub.sub.status === 'past_due' &&
    client.subscription_status === 'active'
  ) {
    findings.push({
      check_name: 'stripe_past_due_db_active',
      severity: 'P1',
      client_slug: slug,
      summary: `Stripe status=past_due; DB still subscription_status=active (grace period not started)`,
      details: {
        stripe_subscription_id: snap.sub.sub.id,
        db_subscription_status: 'active',
        stripe_subscription_status: 'past_due',
      },
    })
  }

  return findings
}

/**
 * Cross-check Stripe-side active subs against the DB.
 *
 * Returns one P1 finding per Stripe active sub whose customer is unknown to
 * the DB. We dedupe by stripe_subscription_id.
 *
 * Important: only safe to call this when sub.metadata.unmissed_slug (or other
 * tagged convention) is populated — without a tag we cannot distinguish "ours
 * but missing" from "billed via another product/integration on the same Stripe
 * account". The script is responsible for filtering accordingly.
 *
 * `dbStripeSubIds` and `dbStripeCustomerIds` come from the DB pull; if the
 * Stripe sub's id is in either set we consider it known.
 */
export function checkOrphanActiveSubs(
  stripeActiveSubs: Array<{
    id: string
    customer_id: string | null
    status: string
    metadata_slug?: string | null
  }>,
  dbStripeSubIds: Set<string>,
  dbStripeCustomerIds: Set<string>,
): StripeDriftFinding[] {
  const findings: StripeDriftFinding[] = []
  for (const sub of stripeActiveSubs) {
    if (dbStripeSubIds.has(sub.id)) continue
    if (sub.customer_id && dbStripeCustomerIds.has(sub.customer_id)) continue
    findings.push({
      check_name: 'stripe_orphan_active_sub',
      severity: 'P1',
      client_slug: sub.metadata_slug ?? null,
      summary: `Stripe active sub ${sub.id} (customer ${sub.customer_id ?? 'unknown'}) not present in DB`,
      details: {
        stripe_subscription_id: sub.id,
        stripe_customer_id: sub.customer_id,
        stripe_subscription_status: sub.status,
        metadata_slug: sub.metadata_slug ?? null,
      },
    })
  }
  return findings
}

/**
 * Aggregate severity for exit-code logic.
 *   P0 → exit 1
 *   P1 (no P0) → exit 2
 *   none → exit 0
 *
 * Why exit 2 for P1 instead of 1: lets the GH workflow distinguish "wake the
 * owner" (P0) from "ticket in the morning" (P1) without parsing logs.
 */
export function exitCodeForFindings(findings: StripeDriftFinding[]): 0 | 1 | 2 {
  if (findings.some(f => f.severity === 'P0')) return 1
  if (findings.some(f => f.severity === 'P1')) return 2
  return 0
}
