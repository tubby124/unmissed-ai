/**
 * POST /api/dashboard/generate-prompt
 *
 * Takes an intakeId → generates system prompt → creates Ultravox agent →
 * upserts clients row → seeds classification_rules → creates prompt_versions row →
 * marks intake as provisioned.
 *
 * Admin only. Called from admin dashboard after reviewing an intake submission.
 *
 * Body: { intakeId: string }
 *
 * Returns: { clientId, agentId, clientSlug, charCount, warnings }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { buildPromptFromIntake, validatePrompt, NICHE_CLASSIFICATION_RULES } from '@/lib/prompt-builder'
import { createAgent, updateAgent, buildAgentTools, resolveVoiceId } from '@/lib/ultravox'
import { enrichWithSonar } from '@/lib/sonar-enrichment'
import { scrapeWebsite } from '@/lib/website-scraper'

export async function POST(req: NextRequest) {
  // ── Auth — admin only ──────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { intakeId?: string; enrichWithSonar?: boolean }
  const intakeId = body.intakeId?.trim()
  const shouldEnrichSonar = body.enrichWithSonar === true
  if (!intakeId) return NextResponse.json({ error: 'intakeId required' }, { status: 400 })

  // ── Load intake submission ─────────────────────────────────────────────────
  const svc = createServiceClient()

  const { data: intake, error: intakeErr } = await svc
    .from('intake_submissions')
    .select('id, niche, business_name, client_slug, contact_email, intake_json, status')
    .eq('id', intakeId)
    .single()

  if (intakeErr || !intake) {
    return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
  }

  if (intake.status === 'provisioned') {
    return NextResponse.json({ error: 'Intake already provisioned. Use sync-agent to re-sync.' }, { status: 409 })
  }

  // ── Generate prompt ────────────────────────────────────────────────────────
  const intakeData = (intake.intake_json as Record<string, unknown>) || {}
  // Ensure niche is present (intake_json may have camelCase niche; prefer top-level niche field)
  if (!intakeData.niche && intake.niche) intakeData.niche = intake.niche

  // Preserve existing agent_name ONLY when re-generating for an already-active client.
  // First-time provisioning: trust the intake form's agent_name.
  if (intake.client_slug) {
    const { data: clientRow } = await svc
      .from('clients')
      .select('agent_name, status')
      .eq('slug', intake.client_slug)
      .single()
    if (clientRow?.agent_name && clientRow.status === 'active') {
      intakeData.db_agent_name = clientRow.agent_name
    }
  }

  // ── Optional Sonar Pro enrichment ──────────────────────────────────────────
  if (shouldEnrichSonar) {
    const businessName = (intakeData.business_name as string) || intake.business_name || ''
    const city = (intakeData.city as string) || (intakeData.location as string) || ''
    const niche = intake.niche || 'other'
    const websiteUrl = (intakeData.website_url as string) || undefined

    if (businessName && city) {
      const sonarResult = await enrichWithSonar(businessName, city, niche, websiteUrl)
      if (sonarResult) {
        const existingFaq = (intakeData.caller_faq as string) || ''
        intakeData.caller_faq = `LOCAL BUSINESS FACTS (researched):\n${sonarResult}\n\nCLIENT-PROVIDED FAQ:\n${existingFaq}`
        console.log(`[generate-prompt] Sonar enrichment: ${sonarResult.length} chars added for "${businessName}"`)
      }
    } else {
      console.warn('[generate-prompt] Sonar enrichment requested but business_name or city missing — skipping')
    }
  }

  // ── Optional website scraping ──────────────────────────────────────────────
  let websiteContent = ''
  const websiteUrl = (intakeData.website_url as string) || (intakeData.websiteUrl as string) || ''
  if (websiteUrl) {
    const niche = intake.niche || 'other'
    const scrapeResult = await scrapeWebsite(websiteUrl, niche)
    if (scrapeResult.rawContent) {
      // Combine structured facts into a text block for prompt injection
      const factLines = scrapeResult.businessFacts.map(f => `- ${f}`).join('\n')
      const qaLines = scrapeResult.extraQa.map(qa => `Q: ${qa.q}\nA: ${qa.a}`).join('\n\n')
      websiteContent = [factLines, qaLines].filter(Boolean).join('\n\n')
      if (websiteContent) {
        console.log(`[generate-prompt] Website scraping: ${websiteContent.length} chars extracted from ${websiteUrl}`)
      }

      // Persist extracted knowledge to clients row for future use
      if (intake.client_slug) {
        await svc
          .from('clients')
          .update({
            website_url: websiteUrl,
            website_knowledge_preview: scrapeResult,
            website_scrape_status: 'extracted',
            website_last_scraped_at: new Date().toISOString(),
            website_scrape_pages: [websiteUrl],
          })
          .eq('slug', intake.client_slug)
        console.log(`[generate-prompt] Persisted website knowledge for ${intake.client_slug}`)
      }
    }
  }

  // Fetch knowledge docs uploaded during onboarding
  let knowledgeDocs = ''
  const { data: kDocs } = await svc
    .from('client_knowledge_docs')
    .select('content_text')
    .eq('intake_id', intakeId)
  if (kDocs && kDocs.length > 0) {
    knowledgeDocs = kDocs.map((d: { content_text: string }) => d.content_text).join('\n\n---\n\n')
  }

  let prompt: string
  try {
    prompt = buildPromptFromIntake(intakeData, websiteContent, knowledgeDocs)
  } catch (err) {
    console.error('[generate-prompt] buildPromptFromIntake failed:', err)
    return NextResponse.json({ error: 'Prompt generation failed', detail: String(err) }, { status: 500 })
  }

  // ── Validate prompt ────────────────────────────────────────────────────────
  const validation = validatePrompt(prompt)
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Prompt failed validation', errors: validation.errors, charCount: validation.charCount },
      { status: 422 },
    )
  }

  // ── Resolve slug, niche, voice ─────────────────────────────────────────────
  const businessName = (intakeData.business_name as string) || intake.business_name || 'unmissed-agent'
  const niche = intake.niche || 'other'
  const clientSlug = intake.client_slug || slugify(businessName)

  const voiceId = resolveVoiceId(
    intakeData.niche_voiceId as string | null,
    intakeData.niche_voiceGender as string | null,
    niche,
  )

  // ── Look up existing client (needed before agent create/update) ────────────
  const classificationRules = NICHE_CLASSIFICATION_RULES[niche] || NICHE_CLASSIFICATION_RULES.other
  const timezone = (intakeData.timezone as string) || 'America/Chicago'

  const { data: existingClient } = await svc
    .from('clients')
    .select('id, ultravox_agent_id, forwarding_number, booking_enabled, sms_enabled, knowledge_backend, transfer_conditions')
    .eq('slug', clientSlug)
    .maybeSingle()

  // ── Create or update Ultravox agent ───────────────────────────────────────
  // Reuse the existing agent if the client already has one — avoids orphaning old agents.
  let agentId: string
  const existingAgentId = existingClient?.ultravox_agent_id as string | undefined
  try {
    const agentName = clientSlug.slice(0, 64) || 'unmissed-agent'
    if (existingAgentId) {
      // Existing client — pass all flags so tools are rebuilt correctly
      const knowledgeBackend = (existingClient?.knowledge_backend as string | null) || undefined
      let knowledgeChunkCount: number | undefined
      if (knowledgeBackend === 'pgvector') {
        const { count } = await svc
          .from('knowledge_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', existingClient!.id)
          .eq('status', 'approved')
        knowledgeChunkCount = count ?? 0
      }

      const agentFlags: Parameters<typeof updateAgent>[1] = {
        systemPrompt: prompt,
        voice: voiceId,
        booking_enabled: existingClient?.booking_enabled ?? false,
        slug: clientSlug,
        forwarding_number: (existingClient?.forwarding_number as string | null) || undefined,
        transfer_conditions: (existingClient?.transfer_conditions as string | null) || undefined,
        sms_enabled: existingClient?.sms_enabled ?? false,
        knowledge_backend: knowledgeBackend,
        knowledge_chunk_count: knowledgeChunkCount,
      }

      await updateAgent(existingAgentId, agentFlags)

      // Keep clients.tools in sync (S1a pattern)
      const syncTools = buildAgentTools(agentFlags)
      await svc.from('clients').update({ tools: syncTools }).eq('id', existingClient!.id)

      agentId = existingAgentId
      console.log(`[generate-prompt] Ultravox agent updated: ${agentId} for "${businessName}"`)
    } else {
      agentId = await createAgent({ systemPrompt: prompt, name: agentName, voice: voiceId, slug: clientSlug })
      console.log(`[generate-prompt] Ultravox agent created: ${agentId} for "${businessName}"`)
    }
  } catch (err) {
    console.error('[generate-prompt] agent create/update failed:', err)
    return NextResponse.json({ error: 'Ultravox agent creation/update failed', detail: String(err) }, { status: 502 })
  }

  let clientId: string

  if (existingClient) {
    // Update existing client
    clientId = existingClient.id as string

    const { error: updateErr } = await svc
      .from('clients')
      .update({
        system_prompt: prompt,
        ultravox_agent_id: agentId,
        agent_voice_id: voiceId,
        classification_rules: classificationRules,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)

    if (updateErr) {
      console.error('[generate-prompt] clients update failed:', updateErr)
      return NextResponse.json({ error: 'Failed to update client', detail: updateErr.message }, { status: 500 })
    }

    console.log(`[generate-prompt] Updated existing client ${clientSlug} (${clientId})`)
  } else {
    // Create new client row
    const { data: newClient, error: insertErr } = await svc
      .from('clients')
      .insert({
        slug: clientSlug,
        business_name: businessName,
        niche,
        status: 'setup',
        system_prompt: prompt,
        ultravox_agent_id: agentId,
        agent_voice_id: voiceId,
        classification_rules: classificationRules,
        timezone,
      })
      .select('id')
      .single()

    if (insertErr || !newClient) {
      console.error('[generate-prompt] clients insert failed:', insertErr)
      return NextResponse.json({ error: 'Failed to create client', detail: insertErr?.message }, { status: 500 })
    }

    clientId = newClient.id as string
    console.log(`[generate-prompt] Created new client ${clientSlug} (${clientId})`)
  }

  // ── Create prompt_versions row with audit trail ────────────────────────────
  const { data: latestVersion } = await svc
    .from('prompt_versions')
    .select('version, char_count')
    .eq('client_id', clientId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = (latestVersion?.version ?? 0) + 1

  await svc.from('prompt_versions').update({ is_active: false }).eq('client_id', clientId)

  await svc.from('prompt_versions').insert({
    client_id: clientId,
    version: nextVersion,
    content: prompt,
    change_description: `Auto-generated from intake (niche: ${niche}, ${validation.charCount} chars)`,
    is_active: true,
    triggered_by_user_id: user.id,
    triggered_by_role: 'admin',
    char_count: validation.charCount,
    prev_char_count: latestVersion?.char_count ?? null,
  })

  // ── Mark intake as provisioned ─────────────────────────────────────────────
  await svc
    .from('intake_submissions')
    .update({ status: 'provisioned', client_id: clientId })
    .eq('id', intakeId)

  console.log(`[generate-prompt] Done — intake ${intakeId} → client ${clientSlug} (${clientId}) → agent ${agentId}`)

  return NextResponse.json({
    clientId,
    agentId,
    clientSlug,
    charCount: validation.charCount,
    warnings: validation.warnings,
    promptPreview: prompt.slice(0, 200) + '…',
  })
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
