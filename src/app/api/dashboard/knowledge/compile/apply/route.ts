/**
 * POST /api/dashboard/knowledge/compile/apply
 *
 * Writes human-approved items from the AI compiler into the knowledge store.
 *
 * - faq_items  → merged into clients.extra_qa (dedup by question, lowercase key)
 *               + reseedKnowledgeFromSettings() if knowledge_backend='pgvector'
 * - fact_items → embedChunks() with source='compiled_import' + syncClientTools()
 * - call_behavior_instruction / unsupported / conflict items are NEVER written here
 *   (the UI prevents approving them; this route ignores any that slip through)
 *
 * Body: { faq_items: {q,a}[], fact_items: {kind,text}[], client_id?: string }
 * Response: { ok: true, faqsAdded: number, chunksCreated: number }
 */

import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedChunks, reseedKnowledgeFromSettings, type ChunkInput } from '@/lib/embeddings'
import { syncClientTools } from '@/lib/sync-client-tools'
import { getPlanEntitlements } from '@/lib/plan-entitlements'

const COMPILER_MODEL = 'claude-haiku-4-5-20251001'

const BLOCKED_KINDS = new Set([
  'call_behavior_instruction',
  'unsupported_or_ambiguous',
  'conflict_flag',
])

// High-risk kinds get trustTier='medium' — content is time-sensitive or easily stale
const HIGH_RISK_KINDS = new Set([
  'pricing_or_offer',
  'hours_or_availability',
  'location_or_service_area',
  'operating_policy',
])

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || !['admin', 'owner'].includes(cu.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as {
    faq_items?: { q: string; a: string }[]
    fact_items?: { kind: string; text: string }[]
    client_id?: string
    raw_input_hash?: string
    model_used?: string
  }

  if (body.client_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(body.client_id)) {
    return NextResponse.json({ error: 'Invalid client_id' }, { status: 400 })
  }

  const clientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id
  if (!clientId) return NextResponse.json({ error: 'No client found' }, { status: 400 })

  const faqItems = (body.faq_items ?? []).filter(i => i.q?.trim() && i.a?.trim())
  const factItems = (body.fact_items ?? []).filter(i => i.text?.trim() && !BLOCKED_KINDS.has(i.kind))

  if (faqItems.length + factItems.length > 200) {
    return NextResponse.json({ error: 'Too many items (max 200)' }, { status: 400 })
  }

  if (faqItems.length === 0 && factItems.length === 0) {
    return NextResponse.json({ ok: true, faqsAdded: 0, chunksCreated: 0 })
  }

  // ── Fetch client + plan gate ──────────────────────────────────────────────────
  const svc = createServiceClient()
  const { data: client } = await svc
    .from('clients')
    .select('extra_qa, business_facts, knowledge_backend, selected_plan, subscription_status')
    .eq('id', clientId)
    .maybeSingle()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const plan = getPlanEntitlements(
    client.subscription_status === 'trialing' ? 'trial' : client.selected_plan,
  )
  if (!plan.fileUploadEnabled) {
    return NextResponse.json(
      { error: 'AI compilation is not available on your current plan.' },
      { status: 403 },
    )
  }

  let faqsAdded = 0
  let chunksCreated = 0

  // ── Merge FAQ items ───────────────────────────────────────────────────────────
  if (faqItems.length > 0) {
    const existingQa: { q: string; a: string }[] = Array.isArray(client.extra_qa)
      ? (client.extra_qa as { q: string; a: string }[])
      : []

    // Dedup by question (lowercase key, last-write-wins — same as settings-schema.ts)
    const seen = new Map<string, { q: string; a: string }>()
    for (const pair of existingQa) {
      if (pair.q?.trim() && pair.a?.trim()) {
        seen.set(pair.q.trim().toLowerCase(), { q: pair.q.trim(), a: pair.a.trim() })
      }
    }
    // Count items that are truly new or change an existing answer (not pure no-op duplicates)
    for (const pair of faqItems) {
      const key = pair.q.trim().toLowerCase()
      const existing = seen.get(key)
      if (!existing || existing.a !== pair.a.trim()) faqsAdded++
      seen.set(key, { q: pair.q.trim(), a: pair.a.trim() })
    }

    const mergedQa = Array.from(seen.values())

    const { error: updateErr } = await svc
      .from('clients')
      .update({ extra_qa: mergedQa })
      .eq('id', clientId)

    if (updateErr) {
      console.error('[compile/apply] extra_qa update failed:', updateErr)
      return NextResponse.json({ error: 'Failed to save FAQs' }, { status: 500 })
    }

    // Reseed knowledge if pgvector active
    if (client.knowledge_backend === 'pgvector') {
      void reseedKnowledgeFromSettings(
        clientId,
        (client.business_facts as string | null) ?? null,
        mergedQa,
      )
    }
  }

  // ── Embed fact items ──────────────────────────────────────────────────────────
  if (factItems.length > 0) {
    const chunks: ChunkInput[] = factItems.map(item => ({
      content: item.text.trim(),
      chunkType: 'document',
      source: 'compiled_import',
      status: 'approved',
      trustTier: HIGH_RISK_KINDS.has(item.kind) ? 'medium' : 'high',
    }))

    // Write compiler_runs provenance row before embedding
    const highRiskCount = factItems.filter(i => HIGH_RISK_KINDS.has(i.kind)).length
    const rawInputHash = body.raw_input_hash
      ?? createHash('sha256').update(JSON.stringify(factItems)).digest('hex').slice(0, 32)
    const modelUsed = body.model_used ?? COMPILER_MODEL

    let compileRunId: string | undefined
    const { data: runRow, error: runErr } = await svc
      .from('compiler_runs')
      .insert({
        client_id: clientId,
        model_used: modelUsed,
        raw_input_hash: rawInputHash,
        total_extracted: factItems.length + faqItems.length,
        approved_count: factItems.length,
        faq_count: faqItems.length,
        high_risk_count: highRiskCount,
        chunk_count: chunks.length,
        created_by_user_id: user.id,
      })
      .select('id')
      .single()

    if (runErr) {
      console.error('[compile/apply] compiler_runs insert failed:', runErr)
    } else {
      compileRunId = runRow.id
    }

    try {
      const result = await embedChunks(clientId, chunks, `compiled-import-${Date.now()}`, compileRunId)
      chunksCreated = result.stored
      if (result.failed > 0) {
        console.error(`[compile/apply] ${result.failed} chunks failed to embed`)
      }
    } catch (err) {
      console.error('[compile/apply] embedChunks failed:', err)
      return NextResponse.json({ error: 'Failed to embed knowledge items' }, { status: 500 })
    }

    // Sync agent tools (registers queryKnowledge when first chunks appear)
    try {
      await syncClientTools(svc, clientId)
    } catch (err) {
      console.error('[compile/apply] tools sync failed:', err)
    }
  }

  return NextResponse.json({ ok: true, faqsAdded, chunksCreated })
}
