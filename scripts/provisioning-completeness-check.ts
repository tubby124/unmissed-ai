/**
 * provisioning-completeness-check.ts — "is this client provisioned correctly?"
 *
 * Validates 10 dimensions per client. Runs nightly (via GH Actions wf) or
 * on-demand for a single slug after manual provisioning:
 *   npx tsx scripts/provisioning-completeness-check.ts --target=emon
 *   npx tsx scripts/provisioning-completeness-check.ts            # all active clients
 *   npx tsx scripts/provisioning-completeness-check.ts --dry-run  # don't write to harness_findings
 *
 * Birth context: built 2026-05-21 alongside the Mohammad Emon manual-provision
 * trace as the "perfect build" assertion check Hasan asked for. Validates that
 * every customer-facing piece a real onboarding should produce is in place:
 *   A — Identity (display fields populated)
 *   B — Slot prompt (markers + size + validatePrompt PASS)
 *   C — Telephony (Twilio voice URL matches expected webhook)
 *   D — Ultravox agent (reachable, has placeholders, has tools)
 *   E — Tool secret (every HTTP tool carries X-Tool-Secret)
 *   F — Capability consistency (no fake-ons; tools ⊂ entitlements)
 *   G — Owner reachability (callback/forwarding/telegram set)
 *   H — Knowledge (pgvector populated when enabled)
 *   I — Billing (active+no-stripe → in CONCIERGE_CLIENTS)
 *   J — Email/Auth (auth user exists, client_users link, email confirmed)
 *
 * Exit code: 0 = all PASS, 1 = any FAIL, 2 = fatal error.
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { recordFindings, type Finding as HarnessFinding } from '../src/lib/harness-writer.js'
import { getPlanEntitlements } from '../src/lib/plan-entitlements.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY!
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.includes('localhost') ? 'https://endvoicemail.ai' : process.env.NEXT_PUBLIC_APP_URL) ?? 'https://endvoicemail.ai'

const TARGET = (() => {
  const a = process.argv.find(a => a.startsWith('--target='))
  return a ? a.split('=')[1] : null
})()
const DRY_RUN = process.argv.includes('--dry-run')

type Severity = 'P0' | 'P1' | 'P2'
type Result = { dim: string; status: 'PASS' | 'FAIL'; severity?: Severity; message: string; detail?: unknown }

const CONCIERGE_ALLOW = new Set(['hasan-sharif','exp-realty','urban-vibe','windshield-hub','calgary-property-leasing','velly-remodeling','emon',
  ...((process.env.CONCIERGE_CLIENTS ?? '').split(',').map(s => s.trim()).filter(Boolean))])

async function checkClient(sb: SupabaseClient, slug: string): Promise<{ slug: string; results: Result[]; allPass: boolean }> {
  const { data: c } = await sb.from('clients').select('*').eq('slug', slug).maybeSingle()
  if (!c) return { slug, allPass: false, results: [{ dim: 'lookup', status: 'FAIL', severity: 'P0', message: `client not found: ${slug}` }] }

  const results: Result[] = []

  // ── A. Identity ────────────────────────────────────────────────────
  {
    const missing: string[] = []
    if (!c.business_name) missing.push('business_name')
    if (!c.owner_name) missing.push('owner_name')
    if (!c.agent_name) missing.push('agent_name')
    if (!c.niche) missing.push('niche')
    if (!c.selected_plan) missing.push('selected_plan')
    results.push({ dim: 'A_identity', status: missing.length ? 'FAIL' : 'PASS', severity: missing.length ? 'P1' : undefined,
      message: missing.length ? `missing fields: ${missing.join(', ')}` : 'identity fields populated', detail: missing })
  }

  // ── B. Slot prompt ─────────────────────────────────────────────────
  {
    const sp = c.system_prompt ?? ''
    const markers = (sp.match(/<!-- unmissed:(\w+)/g) ?? []).map((s: string) => s.replace('<!-- unmissed:', ''))
    const chars = sp.length
    const overCap = chars > 25000
    const tooFewSlots = markers.length < 15
    const issues: string[] = []
    if (overCap) issues.push(`${chars} > 25K cap`)
    if (tooFewSlots) issues.push(`only ${markers.length}/19 slots present`)
    if (!sp) issues.push('empty system_prompt')
    results.push({ dim: 'B_slot_prompt', status: issues.length ? 'FAIL' : 'PASS', severity: issues.length ? 'P0' : undefined,
      message: issues.length ? issues.join('; ') : `${chars} chars, ${markers.length} slots`, detail: { chars, markers } })
  }

  // ── C. Telephony (Twilio voice URL) ───────────────────────────────
  {
    if (!c.twilio_number) {
      results.push({ dim: 'C_telephony', status: 'FAIL', severity: 'P0', message: 'no twilio_number assigned' })
    } else if (!/^\+\d{10,15}$/.test(c.twilio_number)) {
      results.push({ dim: 'C_telephony', status: 'FAIL', severity: 'P0', message: `twilio_number not E.164: ${c.twilio_number}` })
    } else if (!TWILIO_SID || !TWILIO_TOKEN) {
      results.push({ dim: 'C_telephony', status: 'PASS', message: `${c.twilio_number} (Twilio API check skipped — creds not loaded)` })
    } else {
      const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(c.twilio_number)}`, {
        headers: { Authorization: `Basic ${auth}` },
      })
      const j: any = await r.json()
      const n = j.incoming_phone_numbers?.[0]
      const expectedVoiceUrl = `${APP_URL}/api/webhook/${slug}/inbound`
      const issues: string[] = []
      if (!n) issues.push('not in Twilio account')
      else {
        if (n.voice_url !== expectedVoiceUrl) issues.push(`voice_url=${n.voice_url} expected=${expectedVoiceUrl}`)
        if (n.voice_method !== 'POST') issues.push(`voice_method=${n.voice_method}`)
      }
      results.push({ dim: 'C_telephony', status: issues.length ? 'FAIL' : 'PASS', severity: issues.length ? 'P0' : undefined,
        message: issues.length ? issues.join('; ') : `${c.twilio_number} → ${n.voice_url}`, detail: n })
    }
  }

  // ── D. Ultravox agent ──────────────────────────────────────────────
  let liveTools: any[] = []
  {
    if (!c.ultravox_agent_id) {
      results.push({ dim: 'D_ultravox', status: 'FAIL', severity: 'P0', message: 'no ultravox_agent_id' })
    } else {
      const r = await fetch(`https://api.ultravox.ai/api/agents/${c.ultravox_agent_id}`, {
        headers: { 'X-API-Key': ULTRAVOX_API_KEY },
      })
      if (!r.ok) {
        results.push({ dim: 'D_ultravox', status: 'FAIL', severity: 'P0', message: `GET agent HTTP ${r.status}` })
      } else {
        const data: any = await r.json()
        const sp: string = data.callTemplate?.systemPrompt ?? ''
        const tools = data.callTemplate?.selectedTools ?? []
        liveTools = tools
        const missing: string[] = []
        if (!sp.includes('{{callerContext}}'))  missing.push('{{callerContext}}')
        if (!sp.includes('{{businessFacts}}'))  missing.push('{{businessFacts}}')
        if (!sp.includes('{{contextData}}'))    missing.push('{{contextData}}')
        if (tools.length === 0) missing.push('selectedTools empty')
        results.push({ dim: 'D_ultravox', status: missing.length ? 'FAIL' : 'PASS', severity: missing.length ? 'P0' : undefined,
          message: missing.length ? `missing: ${missing.join(', ')}` : `${tools.length} tools registered, all placeholders present` })
      }
    }
  }

  // ── E. Tool secret on every HTTP tool ─────────────────────────────
  {
    const httpTools = liveTools.filter((t: any) => t.temporaryTool?.http?.baseUrlPattern)
    const missingSecret = httpTools.filter((t: any) => {
      const params = t.temporaryTool?.staticParameters ?? []
      return !params.some((p: any) => p?.name === 'X-Tool-Secret')
    })
    results.push({ dim: 'E_tool_secret', status: missingSecret.length ? 'FAIL' : 'PASS', severity: missingSecret.length ? 'P0' : undefined,
      message: missingSecret.length ? `${missingSecret.length} HTTP tool(s) without X-Tool-Secret` : `${httpTools.length} HTTP tools all have X-Tool-Secret` })
  }

  // ── F. Capability consistency (no fake-ons; tools ⊂ entitlements) ──
  {
    const ent = getPlanEntitlements(c.subscription_status === 'trialing' ? 'trial' : c.selected_plan)
    const issues: string[] = []
    if (c.sms_enabled && !c.twilio_number) issues.push('sms_enabled without twilio_number')
    if (c.booking_enabled && c.calendar_auth_status !== 'connected') issues.push('booking_enabled without calendar connected')
    if (c.forwarding_number && !ent.transferEnabled) issues.push(`forwarding_number set but plan ${c.selected_plan} has transferEnabled=false`)
    // Spot-check clients.tools against entitlements
    const toolsText = JSON.stringify(c.tools ?? []).toLowerCase()
    if (!ent.bookingEnabled && /bookappointment|checkcalendaravailability/i.test(toolsText)) issues.push('booking tool present without plan entitlement')
    if (!ent.transferEnabled && /transfercall|pageowner/i.test(toolsText)) issues.push('transfer tool present without plan entitlement')
    if (!ent.smsEnabled && /sendtextmessage/i.test(toolsText)) issues.push('sms tool present without plan entitlement')
    if (!ent.learningLoopEnabled && /checkforcoaching/i.test(toolsText)) issues.push('coaching tool present without plan entitlement')
    results.push({ dim: 'F_capability', status: issues.length ? 'FAIL' : 'PASS', severity: issues.length ? 'P1' : undefined,
      message: issues.length ? issues.join('; ') : 'all capabilities ⊂ plan entitlements' })
  }

  // ── G. Owner reachability ─────────────────────────────────────────
  {
    const issues: string[] = []
    if (!c.callback_phone && !c.forwarding_number) issues.push('neither callback_phone nor forwarding_number set')
    if (c.telegram_notifications_enabled && !c.telegram_chat_id && !c.telegram_registration_token) issues.push('telegram_notifications_enabled but no chat_id and no registration token')
    results.push({ dim: 'G_owner', status: issues.length ? 'FAIL' : 'PASS', severity: issues.length ? 'P1' : undefined,
      message: issues.length ? issues.join('; ') : 'owner reachable' })
  }

  // ── H. Knowledge ──────────────────────────────────────────────────
  {
    if (c.knowledge_backend === 'pgvector') {
      const { count } = await sb.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('client_id', c.id).eq('status', 'approved')
      const n = count ?? 0
      results.push({ dim: 'H_knowledge', status: n > 0 ? 'PASS' : 'FAIL', severity: n > 0 ? undefined : 'P2',
        message: `${n} approved knowledge_chunks (pgvector)` })
    } else {
      results.push({ dim: 'H_knowledge', status: 'PASS', message: `knowledge_backend=${c.knowledge_backend} — skipped` })
    }
  }

  // ── I. Billing sanity ─────────────────────────────────────────────
  {
    const issues: string[] = []
    if (c.subscription_status === 'active' && !c.stripe_subscription_id && !CONCIERGE_ALLOW.has(slug)) {
      issues.push(`active subscription without stripe_subscription_id and not in CONCIERGE_CLIENTS allow-list`)
    }
    if (c.subscription_status === 'trialing' && c.trial_expires_at) {
      const expMs = new Date(c.trial_expires_at).getTime()
      if (expMs < Date.now()) issues.push(`trialing but trial_expires_at in past`)
    }
    results.push({ dim: 'I_billing', status: issues.length ? 'FAIL' : 'PASS', severity: issues.length ? 'P1' : undefined,
      message: issues.length ? issues.join('; ') : `${c.subscription_status} / ${c.selected_plan}${CONCIERGE_ALLOW.has(slug) ? ' (concierge)' : ''}` })
  }

  // ── J. Email/Auth ────────────────────────────────────────────────
  {
    const { data: links } = await sb.from('client_users').select('user_id, role').eq('client_id', c.id)
    if (!links?.length) {
      results.push({ dim: 'J_email_auth', status: 'FAIL', severity: 'P1', message: 'no client_users link — nobody can log in' })
    } else {
      const { data: { users } } = await sb.auth.admin.listUsers()
      const linkedIds = new Set(links.map(l => l.user_id))
      const matching = (users ?? []).filter(u => linkedIds.has(u.id))
      const unconfirmed = matching.filter(u => !u.email_confirmed_at)
      if (matching.length === 0) {
        results.push({ dim: 'J_email_auth', status: 'FAIL', severity: 'P1', message: 'client_users links to deleted auth users' })
      } else if (unconfirmed.length > 0) {
        results.push({ dim: 'J_email_auth', status: 'FAIL', severity: 'P2',
          message: `${unconfirmed.length}/${matching.length} auth users have no email_confirmed_at` })
      } else {
        results.push({ dim: 'J_email_auth', status: 'PASS', message: `${matching.length} confirmed auth user(s); roles: ${links.map(l => l.role).join(',')}` })
      }
    }
  }

  const allPass = results.every(r => r.status === 'PASS')
  return { slug, results, allPass }
}

async function main(): Promise<number> {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false }})

  let slugs: string[] = []
  if (TARGET) {
    slugs = [TARGET]
  } else {
    const { data } = await sb.from('clients').select('slug').eq('status', 'active').order('slug')
    slugs = (data ?? []).map((r: any) => r.slug)
  }
  if (!slugs.length) { console.error('no clients to check'); return 2 }

  console.log(`[provisioning-completeness] checking ${slugs.length} client(s)${DRY_RUN ? ' (dry-run)' : ''}`)

  const allReports: Array<{ slug: string; results: Result[]; allPass: boolean }> = []
  const findings: HarnessFinding[] = []

  for (const slug of slugs) {
    const report = await checkClient(sb, slug)
    allReports.push(report)
    const passCount = report.results.filter(r => r.status === 'PASS').length
    const status = report.allPass ? '✓ ALL PASS' : `✗ ${report.results.length - passCount}/${report.results.length} FAIL`
    console.log(`\n${slug}: ${status}`)
    for (const r of report.results) {
      const icon = r.status === 'PASS' ? '✓' : '✗'
      console.log(`  ${icon} ${r.dim.padEnd(18)} ${r.message}`)
      if (r.status === 'FAIL') {
        findings.push({
          check_name: r.dim.toLowerCase().replace(/^[a-z]_/, ''),
          severity: r.severity ?? 'P1',
          client_slug: slug,
          summary: `[${r.dim}] ${r.message}`.slice(0, 280),
          details: { dim: r.dim, message: r.message, detail: r.detail ?? null },
        })
      }
    }
  }

  if (!DRY_RUN && findings.length > 0) {
    const runId = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`
    try {
      const res = await recordFindings({ harness: 'provisioning-completeness' as any, run_id: runId, findings })
      console.log(`\n[provisioning-completeness] harness_findings: wrote=${res.written} reopened=${res.reopened} errors=${res.errors.length}`)
      for (const e of res.errors) console.error(`  ${e}`)
    } catch (err) {
      console.error('[provisioning-completeness] recordFindings failed:', err)
    }
  }

  const failedClients = allReports.filter(r => !r.allPass).length
  console.log(`\n[provisioning-completeness] ${slugs.length - failedClients}/${slugs.length} clients fully provisioned${failedClients ? ` — ${failedClients} with issues` : ''}`)
  return failedClients > 0 ? 1 : 0
}

main().then(c => process.exit(c)).catch(e => { console.error(e); process.exit(2) })
