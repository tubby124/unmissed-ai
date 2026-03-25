#!/usr/bin/env npx tsx
/**
 * canary-truth-snapshot.ts — Read-only operator debug tool for the self-serve funnel.
 *
 * Prints AUTH / CLIENT / LINKING / BILLING / ONBOARDING truth for a given identity.
 * Flags suspicious drift (paid but no Twilio number, missing client_users, etc.).
 * NEVER mutates anything.
 *
 * Usage:
 *   npx tsx scripts/canary-truth-snapshot.ts --email user@example.com
 *   npx tsx scripts/canary-truth-snapshot.ts --client-id <uuid>
 *
 * Env vars (reads .env.local then ~/.secrets automatically):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// ── Env loading (same pattern as backfill-chunks.ts) ────────────────────────
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) dotenv.config({ path: envPath })

const secretsPath = path.join(process.env.HOME || '', '.secrets')
if (fs.existsSync(secretsPath)) {
  const content = fs.readFileSync(secretsPath, 'utf-8')
  for (const line of content.split('\n')) {
    const match = line.match(/^export\s+(\w+)=["']?(.+?)["']?\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined
}

const byEmail = getArg('--email')
const byClientId = getArg('--client-id')

if (!byEmail && !byClientId) {
  console.error('Usage:')
  console.error('  npx tsx scripts/canary-truth-snapshot.ts --email user@example.com')
  console.error('  npx tsx scripts/canary-truth-snapshot.ts --client-id <uuid>')
  process.exit(1)
}

// ── Supabase admin client ────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

// Inline fetch-based Supabase admin client — no SDK version dependency issues
async function supabaseSelect(table: string, filter: string): Promise<any[]> {
  const url = `${supabaseUrl}/rest/v1/${table}?${filter}&select=*`
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase query failed on ${table}: ${res.status} ${text}`)
  }
  return res.json()
}

async function supabaseAdminGetUser(userId: string): Promise<any> {
  const url = `${supabaseUrl}/auth/v1/admin/users/${userId}`
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey}`,
    },
  })
  if (!res.ok) return null
  return res.json()
}

async function supabaseAdminListUsers(): Promise<any[]> {
  const url = `${supabaseUrl}/auth/v1/admin/users?per_page=1000`
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey}`,
    },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.users ?? []
}

// ── Output helpers ───────────────────────────────────────────────────────────
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const DIM = '\x1b[2m'

function header(title: string) {
  console.log(`\n${BOLD}══ ${title} ${'═'.repeat(Math.max(0, 50 - title.length))}${RESET}`)
}

function field(label: string, value: string | null | undefined | boolean | number, flags?: string[]) {
  const display = value === null || value === undefined ? `${DIM}(null)${RESET}` : String(value)
  const flagStr = flags && flags.length > 0 ? `  ${RED}⚠  ${flags.join(' | ')}${RESET}` : ''
  console.log(`  ${label.padEnd(32)} ${display}${flagStr}`)
}

function drift(msg: string) {
  console.log(`  ${RED}⚡ DRIFT: ${msg}${RESET}`)
}

function ok(msg: string) {
  console.log(`  ${GREEN}✓ ${msg}${RESET}`)
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n${BOLD}canary-truth-snapshot${RESET}  ${DIM}read-only${RESET}`)
  console.log(`query: ${byEmail ? `email=${byEmail}` : `client_id=${byClientId}`}`)

  let authUser: any = null
  let client: any = null

  // ── AUTH ────────────────────────────────────────────────────────────────────
  header('AUTH')

  if (byEmail) {
    const allUsers = await supabaseAdminListUsers()
    authUser = allUsers.find((u: any) => u.email?.toLowerCase() === byEmail.toLowerCase()) ?? null
  }

  if (authUser) {
    const providers = (authUser.identities ?? []).map((i: any) => i.provider).join(', ')
    field('auth user id', authUser.id)
    field('email', authUser.email)
    field('email confirmed', authUser.email_confirmed_at ? `yes (${authUser.email_confirmed_at})` : 'NO')
    field('providers', providers || '(none)')
    field('last sign in', authUser.last_sign_in_at ?? null)
    field('created at', authUser.created_at)
    if (!authUser.email_confirmed_at) drift('email not confirmed — user cannot log in')
  } else if (byEmail) {
    field('auth user exists?', 'NO — not found in auth.users')
    drift(`no auth.users row for ${byEmail}`)
  }

  // ── CLIENT ──────────────────────────────────────────────────────────────────
  header('CLIENT')

  if (byClientId) {
    const rows = await supabaseSelect('clients', `id=eq.${byClientId}`)
    client = rows[0] ?? null
  } else if (authUser) {
    // Try client_users link first
    const cuRows = await supabaseSelect('client_users', `user_id=eq.${authUser.id}`)
    if (cuRows.length > 0) {
      const cid = cuRows[0].client_id
      const rows = await supabaseSelect('clients', `id=eq.${cid}`)
      client = rows[0] ?? null
    }
  }

  // Fallback: search by contact_email
  if (!client && byEmail) {
    const rows = await supabaseSelect('clients', `contact_email=eq.${encodeURIComponent(byEmail)}`)
    client = rows[0] ?? null
    if (client) console.log(`  ${YELLOW}(found via contact_email match, not client_users link)${RESET}`)
  }

  if (client) {
    field('client_id', client.id)
    field('slug', client.slug)
    field('business_name', client.business_name)
    field('contact_email', client.contact_email)
    field('niche', client.niche)
    field('status', client.status)
    field('subscription_status', client.subscription_status)
    field('selected_plan', client.selected_plan)
    field('setup_complete', client.setup_complete)
    field('twilio_number', client.twilio_number)
    field('twilio_subaccount_sid', client.twilio_subaccount_sid)
    field('forwarding_number', client.forwarding_number)
    field('booking_enabled', client.booking_enabled)
    field('sms_enabled', client.sms_enabled)
    field('notification_method', client.notification_method ?? client.telegram_notifications_enabled ? 'telegram' : null)
    field('telegram_chat_id', client.telegram_chat_id)
    field('telegram_registration_token', client.telegram_registration_token)
    field('ultravox_agent_id', client.ultravox_agent_id)
    field('monthly_minute_limit', client.monthly_minute_limit)
    field('minutes_used_this_month', client.minutes_used_this_month)
    field('trial_expires_at', client.trial_expires_at)
    field('trial_converted', client.trial_converted)
    field('created_at', client.created_at)
    field('updated_at', client.updated_at)

    // ── Drift checks ──────────────────────────────────────────────────────────
    // isPaidLive = has an active Stripe subscription (not just status='active' on the client row,
    // which is also set during trial). Both fields must agree to be considered truly paid.
    const isTrial = client.subscription_status === 'trialing'
    const isPaidLive = client.subscription_status === 'active' && !!client.stripe_subscription_id

    if (isPaidLive && !client.twilio_number) {
      drift('paid subscription active (stripe_subscription_id present) but twilio_number is NULL — Twilio provisioning may have failed')
    } else if (isTrial && !client.twilio_number) {
      ok('no Twilio number — expected for trial accounts')
    }
    if (isTrial && client.twilio_number) {
      drift('subscription_status=trialing but twilio_number is present — unexpected for trial')
    }
    if (isPaidLive && !client.stripe_subscription_id) {
      // Unreachable given isPaidLive definition, but kept for explicitness
      drift('subscription_status=active but stripe_subscription_id is NULL')
    }
    if (!client.ultravox_agent_id) {
      drift('ultravox_agent_id is NULL — agent not provisioned')
    }
    if (client.status === 'active' && !client.setup_complete && client.twilio_number) {
      drift('twilio_number present but setup_complete=false — may need manual flip')
    }
    if (isTrial && !client.trial_expires_at) {
      drift('trial but trial_expires_at is NULL — trial expiry not set')
    }
    if (isTrial && client.monthly_minute_limit !== 50) {
      drift(`trial minute limit is ${client.monthly_minute_limit}, expected 50`)
    }
  } else {
    field('client row found?', 'NO')
    drift('no clients row found for this identity')
  }

  // ── LINKING ─────────────────────────────────────────────────────────────────
  header('LINKING (client_users)')

  const cuRows = client
    ? await supabaseSelect('client_users', `client_id=eq.${client.id}`)
    : authUser
    ? await supabaseSelect('client_users', `user_id=eq.${authUser.id}`)
    : []

  if (cuRows.length === 0) {
    field('client_users row?', 'MISSING')
    drift('no client_users row — user cannot access their dashboard')
  } else {
    for (const cu of cuRows) {
      field('client_users.id', cu.id)
      field('client_users.user_id', cu.user_id)
      field('client_users.client_id', cu.client_id)
      field('client_users.role', cu.role)
      field('client_users.created_at', cu.created_at)
      if (!cu.user_id) drift('client_users row exists but user_id is NULL — not yet linked to auth')
      if (!cu.client_id) drift('client_users row exists but client_id is NULL')
    }
  }

  // Cross-check: auth user_id vs client.user_id (legacy field)
  if (authUser && client && client.user_id && client.user_id !== authUser.id) {
    drift(`clients.user_id (${client.user_id}) does not match auth.users.id (${authUser.id})`)
  }

  // ── BILLING ─────────────────────────────────────────────────────────────────
  header('BILLING')

  if (client) {
    field('stripe_customer_id', client.stripe_customer_id)
    field('stripe_subscription_id', client.stripe_subscription_id)
    field('subscription_status', client.subscription_status)
    field('selected_plan', client.selected_plan)
    field('subscription_current_period_end', client.subscription_current_period_end)
    field('grace_period_end', client.grace_period_end)
    field('stripe_discount_name', client.stripe_discount_name)
    field('effective_monthly_rate', client.effective_monthly_rate)

    if (!client.stripe_customer_id && client.subscription_status === 'active') {
      drift('active subscription but no stripe_customer_id')
    }
    if (client.stripe_subscription_id && !client.subscription_status) {
      drift('stripe_subscription_id present but subscription_status is NULL')
    }
  } else {
    console.log('  (no client row — skipping billing)')
  }

  // ── ONBOARDING / INTAKE ─────────────────────────────────────────────────────
  header('INTAKE / ONBOARDING')

  if (client) {
    // Look for intake rows (client_intake table if it exists, or onboarding_data)
    let intakeRows: any[] = []
    try {
      intakeRows = await supabaseSelect('client_intake', `client_id=eq.${client.id}&order=created_at.desc&limit=1`)
    } catch {
      // table may not exist
    }

    if (intakeRows.length > 0) {
      const intake = intakeRows[0]
      field('intake row id', intake.id)
      field('intake province', intake.province)
      field('intake area_code', intake.area_code)
      field('intake created_at', intake.created_at)
    } else {
      // Fall back to fields on client row itself
      field('province (on client)', client.province ?? null)
      field('area_code (on client)', client.area_code ?? null)
      field('website_url', client.website_url)
      field('website_scrape_status', client.website_scrape_status)
      field('knowledge_backend', client.knowledge_backend)
    }
  } else {
    console.log('  (no client row — skipping intake)')
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(56)}`)
  if (!authUser && byEmail) {
    console.log(`${RED}SUMMARY: No auth user found for ${byEmail}${RESET}`)
  } else if (!client) {
    console.log(`${YELLOW}SUMMARY: Auth user found but no client row located${RESET}`)
  } else {
    const status = client.subscription_status ?? 'unknown'
    const plan = client.selected_plan ?? 'unset'
    const hasTwilio = client.twilio_number ? `twilio=${client.twilio_number}` : 'no twilio number'
    const hasAgent = client.ultravox_agent_id ? 'agent provisioned' : 'NO AGENT'
    console.log(`${GREEN}SUMMARY:${RESET} ${client.slug} | ${status} | plan=${plan} | ${hasTwilio} | ${hasAgent}`)
  }
  console.log()
}

run().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
