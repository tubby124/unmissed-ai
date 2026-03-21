import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/embeddings'
import { syncClientTools } from '@/lib/sync-client-tools'

type ApprovedPackage = {
  businessFacts: string[]
  extraQa: { q: string; a: string }[]
  serviceTags: string[]
}

/**
 * Approve website-scraped knowledge.
 * Saves extracted facts + Q&A as knowledge_chunks with status=pending (for review)
 * or status=approved (if auto_approve=true and user is admin).
 *
 * Also merges into business_facts/extra_qa on the client row for backward compat
 * (agent-context.ts injects these into the prompt at call time).
 */
export async function POST(req: NextRequest) {
  // ── Auth — admin or client owner ──────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .single()

  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse body ────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as {
    clientId?: string
    approved?: ApprovedPackage
    auto_approve?: boolean
  }
  const clientId = body.clientId?.trim()

  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // ── Permission check ──────────────────────────────────────────────────────
  if (cu.role !== 'admin' && cu.client_id !== clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()

  // ── Load client row ───────────────────────────────────────────────────────
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('business_facts, extra_qa, website_url, website_scrape_pages, website_knowledge_preview, slug, system_prompt')
    .eq('id', clientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // ── Resolve approved package ──────────────────────────────────────────────
  const approved: ApprovedPackage | null =
    body.approved ?? (client.website_knowledge_preview as ApprovedPackage | null)

  if (!approved || !approved.businessFacts || !approved.extraQa) {
    return NextResponse.json(
      { error: 'No approved data provided and no website_knowledge_preview stored' },
      { status: 400 },
    )
  }

  // ── Determine chunk status based on role ──────────────────────────────────
  const chunkStatus = body.auto_approve && cu.role === 'admin' ? 'approved' : 'pending'
  const sourceUrl = Array.isArray(client.website_scrape_pages) && client.website_scrape_pages.length > 0
    ? client.website_scrape_pages[0]
    : client.website_url ?? 'website_scrape'
  const runId = `website-scrape-${Date.now()}`

  // ── Create knowledge chunks from facts ────────────────────────────────────
  let stored = 0
  let failed = 0
  const errors: string[] = []

  for (const fact of approved.businessFacts) {
    if (!fact?.trim()) continue
    const embedding = await embedText(fact.trim())
    if (!embedding) {
      failed++
      errors.push(`Embedding failed: ${fact.slice(0, 60)}...`)
      continue
    }

    const { error } = await svc
      .from('knowledge_chunks')
      .upsert(
        {
          client_id: clientId,
          content: fact.trim(),
          chunk_type: 'fact',
          source: 'website_scrape',
          source_run_id: runId,
          trust_tier: 'medium',
          status: chunkStatus,
          embedding: JSON.stringify(embedding),
          metadata: { url: sourceUrl },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id,content_hash,chunk_type,source' },
      )

    if (error) {
      failed++
      errors.push(`DB: ${error.message}`)
    } else {
      stored++
    }
  }

  // ── Create knowledge chunks from Q&A pairs ────────────────────────────────
  for (const qa of approved.extraQa) {
    if (!qa.q?.trim() || !qa.a?.trim()) continue
    const content = `Q: ${qa.q.trim()}\nA: ${qa.a.trim()}`
    const embedding = await embedText(content)
    if (!embedding) {
      failed++
      errors.push(`Embedding failed: ${qa.q.slice(0, 60)}...`)
      continue
    }

    const { error } = await svc
      .from('knowledge_chunks')
      .upsert(
        {
          client_id: clientId,
          content,
          chunk_type: 'qa',
          source: 'website_scrape',
          source_run_id: runId,
          trust_tier: 'medium',
          status: chunkStatus,
          embedding: JSON.stringify(embedding),
          metadata: { url: sourceUrl, question: qa.q.trim() },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id,content_hash,chunk_type,source' },
      )

    if (error) {
      failed++
      errors.push(`DB: ${error.message}`)
    } else {
      stored++
    }
  }

  // ── Also merge into business_facts/extra_qa for prompt injection ──────────
  // agent-context.ts still reads these for inline prompt injection
  const existingFacts = typeof client.business_facts === 'string' ? client.business_facts : ''
  const existingQa: { q: string; a: string }[] = Array.isArray(client.extra_qa) ? client.extra_qa : []

  const newFactLines = approved.businessFacts.filter(f => f?.trim())
  const existingFactSet = new Set(existingFacts.split('\n').map(l => l.trim().toLowerCase()))
  const dedupedNewFacts = newFactLines.filter(f => !existingFactSet.has(f.trim().toLowerCase()))
  const mergedFacts = dedupedNewFacts.length > 0
    ? (existingFacts ? existingFacts + '\n' : '') + dedupedNewFacts.join('\n')
    : existingFacts

  const existingQaSet = new Set(existingQa.map(q => q.q.trim().toLowerCase()))
  const dedupedNewQa = approved.extraQa.filter(q => q.q?.trim() && !existingQaSet.has(q.q.trim().toLowerCase()))
  const mergedQa = [...existingQa, ...dedupedNewQa]

  // ── Update client row ─────────────────────────────────────────────────────
  const { error: updateErr } = await svc
    .from('clients')
    .update({
      business_facts: mergedFacts,
      extra_qa: mergedQa,
      website_knowledge_approved: approved as unknown as Record<string, unknown>,
      website_scrape_status: 'approved',
    })
    .eq('id', clientId)

  if (updateErr) {
    console.error(`[approve-website-knowledge] Failed to update client ${clientId}:`, updateErr)
    return NextResponse.json({ error: 'Failed to save approved knowledge' }, { status: 500 })
  }

  const factLines = mergedFacts.split('\n').filter((l: string) => l.trim().length > 0)

  console.log(`[approve-website-knowledge] client=${client.slug} stored=${stored} failed=${failed} facts=${factLines.length} qa=${mergedQa.length} chunkStatus=${chunkStatus}`)

  // S5: if chunks were auto-approved, rebuild clients.tools
  if (chunkStatus === 'approved' && stored > 0) {
    syncClientTools(svc, clientId).catch(err =>
      console.error(`[approve-website-knowledge] tools sync failed: ${err}`)
    )
  }

  return NextResponse.json({
    success: true,
    mergedFacts: factLines.length,
    mergedQa: mergedQa.length,
    chunksStored: stored,
    chunksFailed: failed,
    chunkStatus,
    errors: errors.length > 0 ? errors : undefined,
  })
}

