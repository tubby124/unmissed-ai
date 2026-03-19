import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { mergeWithExisting } from '@/lib/knowledge-extractor'
import { syncClientCorpus } from '@/lib/ultravox-corpus'

type ApprovedPackage = {
  businessFacts: string[]
  extraQa: { q: string; a: string }[]
  serviceTags: string[]
}

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
    .select('business_facts, extra_qa, corpus_id, ultravox_corpus_source_id, website_url, website_scrape_pages, website_knowledge_preview, slug')
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

  // ── Merge with existing facts/QA ──────────────────────────────────────────
  const existingQa: { q: string; a: string }[] = Array.isArray(client.extra_qa)
    ? client.extra_qa
    : []

  const { mergedFacts, mergedQa } = mergeWithExisting(
    approved.businessFacts,
    approved.extraQa,
    client.business_facts as string | null,
    existingQa,
  )

  // ── Sync Ultravox corpus ──────────────────────────────────────────────────
  const sourceUrls: string[] =
    Array.isArray(client.website_scrape_pages) && client.website_scrape_pages.length > 0
      ? client.website_scrape_pages
      : client.website_url
        ? [client.website_url]
        : []

  const corpusState = await syncClientCorpus(
    client.slug,
    sourceUrls,
    client.corpus_id ?? null,
    client.ultravox_corpus_source_id ?? null,
  )

  // ── Update client row ─────────────────────────────────────────────────────
  const { error: updateErr } = await svc
    .from('clients')
    .update({
      business_facts: mergedFacts,
      extra_qa: mergedQa,
      website_knowledge_approved: approved as unknown as Record<string, unknown>,
      website_scrape_status: 'approved',
      corpus_id: corpusState.corpusId,
      corpus_enabled: true,
      ultravox_corpus_source_id: corpusState.sourceId,
      ultravox_corpus_status: corpusState.status,
      ultravox_corpus_synced_at: new Date().toISOString(),
    })
    .eq('id', clientId)

  if (updateErr) {
    console.error(`[approve-website-knowledge] Failed to update client ${clientId}:`, updateErr)
    return NextResponse.json({ error: 'Failed to save approved knowledge' }, { status: 500 })
  }

  const factLines = mergedFacts.split('\n').filter((l: string) => l.trim().length > 0)

  return NextResponse.json({
    success: true,
    mergedFacts: factLines.length,
    mergedQa: mergedQa.length,
    corpusStatus: corpusState.status,
  })
}
