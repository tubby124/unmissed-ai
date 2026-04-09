#!/usr/bin/env node
// admin-trial-cleanup.mjs — Manual cleanup for stale trialing rows.
//
// Surfaced by Phase F pre-flight (2026-04-09): the Railway `trial-expiry` cron
// is either not firing or silently failing, leaving ~25 expired-trialing rows
// stuck at `status='active' AND subscription_status='trialing'`. This script
// runs the same transition the cron is SUPPOSED to run, but from Hasan's local
// shell, with a dry-run default and a paper trail.
//
// What it does (matches src/app/api/cron/trial-expiry/route.ts):
//   1. Finds clients where trial_expires_at < now() AND trial_converted = false
//      AND status = 'active'
//   2. In --force mode: flips status → 'paused', subscription_status → 'expired'
//   3. Optionally releases Twilio numbers for clients paused > 7 days
//
// Usage:
//   source ~/.secrets
//   node scripts/admin-trial-cleanup.mjs                    # dry-run (default)
//   node scripts/admin-trial-cleanup.mjs --force            # actually flip rows
//   node scripts/admin-trial-cleanup.mjs --force --release  # also release Twilio numbers
//   node scripts/admin-trial-cleanup.mjs --slug foo-bar     # target one client only
//
// Required env (from ~/.secrets):
//   SUPABASE_SERVICE_KEY
//   (for --release) TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qwhvblomlgeapzhnuwlb.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY not set. Run: source ~/.secrets')
  process.exit(1)
}

const args = process.argv.slice(2)
const force = args.includes('--force')
const release = args.includes('--release')
const slugFlag = args.indexOf('--slug')
const onlySlug = slugFlag >= 0 ? args[slugFlag + 1] : null

const mode = force ? 'FORCE' : 'DRY-RUN'
console.log(`\n▶ admin-trial-cleanup — mode: ${mode}${release ? ' +release' : ''}`)
if (onlySlug) console.log(`  scoped to slug: ${onlySlug}`)
console.log('')

const supa = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Phase 1: find expired trials ─────────────────────────────────────────────
let q = supa
  .from('clients')
  .select('id, slug, business_name, status, subscription_status, trial_expires_at, trial_converted, twilio_number, updated_at')
  .lt('trial_expires_at', new Date().toISOString())
  .eq('trial_converted', false)
  .eq('status', 'active')
  .order('trial_expires_at', { ascending: true })

if (onlySlug) q = q.eq('slug', onlySlug)

const { data: expired, error: queryErr } = await q

if (queryErr) {
  console.error('Query failed:', queryErr)
  process.exit(1)
}

if (!expired || expired.length === 0) {
  console.log('✓ No stale trialing rows to clean up.')
} else {
  console.log(`Found ${expired.length} expired-trialing row(s):\n`)
  for (const row of expired) {
    const daysExpired = Math.floor((Date.now() - new Date(row.trial_expires_at).getTime()) / (1000 * 60 * 60 * 24))
    console.log(`  ${row.slug.padEnd(40)}  expired ${daysExpired}d ago  ${row.twilio_number || '(no number)'}  "${row.business_name}"`)
  }
  console.log('')

  if (force) {
    console.log('Applying status → paused, subscription_status → expired...')
    for (const row of expired) {
      const { error: updErr } = await supa
        .from('clients')
        .update({
          status: 'paused',
          subscription_status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      if (updErr) console.error(`  ✗ ${row.slug}: ${updErr.message}`)
      else console.log(`  ✓ ${row.slug} → paused`)
    }
  } else {
    console.log('(dry-run — no rows modified. Re-run with --force to apply.)')
  }
}

// ── Phase 2: release Twilio numbers for clients paused > 7 days ──────────────
if (release) {
  console.log('')
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let relQ = supa
    .from('clients')
    .select('id, slug, twilio_number')
    .lt('trial_expires_at', sevenDaysAgo)
    .eq('trial_converted', false)
    .eq('status', 'paused')
    .not('twilio_number', 'is', null)

  if (onlySlug) relQ = relQ.eq('slug', onlySlug)

  const { data: toRelease, error: relErr } = await relQ

  if (relErr) {
    console.error('Release query failed:', relErr)
  } else if (!toRelease || toRelease.length === 0) {
    console.log('✓ No Twilio numbers eligible for release (7-day grace).')
  } else {
    console.log(`Found ${toRelease.length} Twilio number(s) past 7-day grace:\n`)
    for (const c of toRelease) {
      console.log(`  ${c.slug.padEnd(40)}  ${c.twilio_number}`)
    }
    console.log('')

    if (!force) {
      console.log('(dry-run — no numbers released. Re-run with --force --release to apply.)')
    } else {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      if (!accountSid || !authToken) {
        console.error('✗ TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set — cannot release numbers.')
        process.exit(1)
      }
      const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
      const APP_URL = process.env.APP_URL || 'https://unmissed.ai'

      for (const c of toRelease) {
        const { data: invRow } = await supa
          .from('number_inventory')
          .select('id, twilio_sid')
          .eq('phone_number', c.twilio_number)
          .maybeSingle()

        if (invRow) {
          const patchUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${invRow.twilio_sid}.json`
          const patchRes = await fetch(patchUrl, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${twilioAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              VoiceUrl: `${APP_URL}/api/webhook/inventory-idle`,
              VoiceMethod: 'POST',
              VoiceFallbackUrl: `${APP_URL}/api/webhook/inventory-idle`,
              VoiceFallbackMethod: 'POST',
            }).toString(),
            signal: AbortSignal.timeout(30_000),
          })
          if (!patchRes.ok) {
            console.error(`  ✗ ${c.slug}: Twilio PATCH failed (${patchRes.status})`)
          } else {
            await supa
              .from('number_inventory')
              .update({
                status: 'available',
                assigned_client_id: null,
                reserved_intake_id: null,
                reserved_at: null,
              })
              .eq('id', invRow.id)
            console.log(`  ✓ ${c.slug}: ${c.twilio_number} → available`)
          }
        } else {
          console.log(`  ~ ${c.slug}: ${c.twilio_number} not in number_inventory — clearing clients.twilio_number only`)
        }

        await supa
          .from('clients')
          .update({ twilio_number: null, updated_at: new Date().toISOString() })
          .eq('id', c.id)
      }
    }
  }
}

console.log('')
console.log('✓ admin-trial-cleanup complete.')
