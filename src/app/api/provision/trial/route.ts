/**
 * POST /api/provision/trial
 *
 * Creates a client in trial mode — no Twilio number, dashboard access + WebRTC demo calls.
 * Rate limited: 3 trials/hr/IP, 1 trial/email.
 */

import { NextRequest, NextResponse } from "next/server";
import { OnboardingData } from "@/types/onboarding";
import { toIntakePayload, slugify } from "@/lib/intake-transform";
import { createServiceClient } from "@/lib/supabase/server";
import { activateClient } from "@/lib/activate-client";
import { buildPromptFromIntake, validatePrompt, NICHE_CLASSIFICATION_RULES } from "@/lib/prompt-builder";
import { createAgent, deleteAgent, resolveVoiceId } from "@/lib/ultravox";
import { rowsToCatalogItems } from "@/lib/service-catalog";
import { scrapeWebsite } from "@/lib/website-scraper";
import { insertPromptVersion } from "@/lib/prompt-version-utils";
import { seedKnowledgeFromScrape } from "@/lib/seed-knowledge";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import { SlidingWindowRateLimiter } from "@/lib/rate-limiter";

const trialRateLimiter = new SlidingWindowRateLimiter(3, 60 * 60 * 1000) // 3/hr/IP

export async function POST(req: NextRequest) {
  const supa = createServiceClient()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'
  if (!trialRateLimiter.check(ip).allowed) {
    return NextResponse.json({ error: 'Too many trial requests. Please try again later.' }, { status: 429 })
  }

  const data: OnboardingData = await req.json();

  // Basic validation
  if (!data.businessName || !data.niche) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!data.contactEmail?.trim()) {
    return NextResponse.json({ error: "Email address is required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail.trim())) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  if (!data.callbackPhone?.trim()) {
    return NextResponse.json({ error: "Business phone number is required" }, { status: 400 });
  }

  // Email uniqueness: check intake_submissions for existing non-abandoned entries
  const { data: existingIntake } = await supa
    .from('intake_submissions')
    .select('id, progress_status')
    .eq('contact_email', data.contactEmail.trim())
    .neq('progress_status', 'abandoned')
    .limit(1)
    .single()

  if (existingIntake) {
    return NextResponse.json({ error: "An account with this email already exists. Please log in instead." }, { status: 409 })
  }

  // W1-B: Guard against auth users from prior trials where intake row was cleared but client row persists
  const { data: existingClientByEmail } = await supa
    .from('clients')
    .select('id')
    .eq('contact_email', data.contactEmail.trim())
    .limit(1)
    .maybeSingle()

  if (existingClientByEmail) {
    return NextResponse.json({ error: 'An account with this email already exists. Please log in instead.' }, { status: 409 })
  }

  trialRateLimiter.record(ip)

  const intakePayload = toIntakePayload(data);

  // D302: Preserve niche intake fields so regenerateSlot() can reconstruct the full intake.
  // toIntakePayload() creates niche_* fields from nicheAnswers (e.g. niche_emergency, niche_clientType).
  // These are consumed once by buildSlotContext() during prompt generation but were never saved to DB.
  // Save them into niche_custom_variables so the round-trip (clientRowToIntake → buildSlotContext) works.
  const nicheIntakeFields: Record<string, string> = {}
  for (const [k, v] of Object.entries(intakePayload)) {
    if (k.startsWith('niche_') && k !== 'niche_custom_variables' && k !== 'niche_faq_pairs' && v) {
      nicheIntakeFields[k] = String(v)
    }
  }
  // Merge with any explicit nicheCustomVariables (TRIAGE_DEEP, etc.) from D258/D259 onboarding fields
  // GAP-2 fix: Set CLOSE_PERSON from owner name so the prompt says "Sal" not "the boss"
  const ownerFirstName = (data.ownerName || data.businessName || '').split(' ')[0]?.trim()
  const mergedNicheVars: Record<string, string> = {
    ...nicheIntakeFields,
    ...(data.nicheCustomVariables ?? {}),
    ...(ownerFirstName ? { CLOSE_PERSON: ownerFirstName } : {}),
  }

  // Gate-13: Enforce plan entitlements server-side — UI can show toggles as disabled
  // but state can still carry values from a previously selected plan or job step.
  // Use toIntakePayload's derived call_handling_mode as the base (handles agent_mode→message_only).
  // Only block full_service for non-Pro plans — message_only and triage are safe to pass through.
  const entitlements = getPlanEntitlements(data.selectedPlan)
  const rawCallHandlingMode = intakePayload.call_handling_mode
  const effectiveCallHandlingMode = (!entitlements.bookingEnabled && rawCallHandlingMode === 'full_service')
    ? 'triage'
    : (rawCallHandlingMode || 'triage')
  const effectiveCallForwardingEnabled = entitlements.transferEnabled
    ? (data.callForwardingEnabled ?? false)
    : false
  const effectiveEmergencyPhone = effectiveCallForwardingEnabled ? (data.emergencyPhone?.trim() || null) : null

  // For real_estate the display name is the agent's personal name (ownerName),
  // not the brokerage (businessName). The brokerage is preserved inside intake_json.
  const displayName = (data.niche === "real_estate" && data.ownerName?.trim())
    ? data.ownerName.trim()
    : data.businessName;

  // Deduplicate slug — append random suffix on collision
  let clientSlug = slugify(displayName);
  const { data: existingSlug } = await supa
    .from('clients')
    .select('id')
    .eq('slug', clientSlug)
    .limit(1)
    .maybeSingle()
  if (existingSlug) {
    const suffix = Math.random().toString(36).slice(2, 6)
    clientSlug = `${clientSlug}-${suffix}`
  }

  // Insert into intake_submissions
  const { data: row, error: insertErr } = await supa
    .from("intake_submissions")
    .insert({
      business_name: displayName,
      niche: data.niche || "other",
      intake_json: { ...data, ...intakePayload, call_handling_mode: effectiveCallHandlingMode },
      status: "pending",
      progress_status: "pending",
      owner_name: data.ownerName || null,
      contact_email: data.contactEmail || null,
      client_slug: clientSlug,
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    console.error("[provision/trial] Insert failed:", insertErr);
    return NextResponse.json({ error: "Failed to save request" }, { status: 500 });
  }

  const intakeId = row.id as string;

  // Create client row with status='setup' (activateClient will flip to 'active')
  const { data: clientRow, error: clientErr } = await supa
    .from("clients")
    .insert({
      slug: clientSlug,
      business_name: displayName,
      niche: data.niche || "other",
      status: 'setup',
      contact_email: data.contactEmail || null,
      agent_name: intakePayload.agent_name || null,  // Gate-14: use niche default when blank
      // Phase 0b: Write onboarding fields so settings dashboard shows them
      business_hours_weekday: intakePayload.hours_weekday || null,
      business_hours_weekend: intakePayload.hours_weekend || null,
      after_hours_behavior: data.afterHoursBehavior || 'take_message',
      after_hours_emergency_phone: data.emergencyPhone || null,
      website_url: data.websiteUrl || null,
      owner_name: data.ownerName || null,
      city: data.city || null,
      state: data.state || null,
      services_offered: intakePayload.services_offered || null,
      callback_phone: intakePayload.callback_phone || null,
      ivr_enabled: data.ivrEnabled ?? false,
      ivr_prompt: data.ivrPrompt || null,
      call_handling_mode: effectiveCallHandlingMode,
      agent_mode: intakePayload.agent_mode ?? 'lead_capture',
      selected_plan: data.selectedPlan || 'core',
      knowledge_backend: 'pgvector',
      // Gate-11+13: Write forwarding_number only when plan entitlement allows it
      forwarding_number: effectiveEmergencyPhone,
      // Use agentTone directly as voice_style_preset (types now aligned)
      voice_style_preset: data.agentTone || 'casual_friendly',
      // Gate-12: Persist notification preference — runtime uses opt-out semantics (null=enabled, false=disabled)
      telegram_notifications_enabled: data.notificationMethod === 'email' ? false : null,
      email_notifications_enabled: data.notificationMethod === 'telegram' ? false : null,
      // Capability flags — must be written at provision time so syncClientTools() picks them up
      booking_enabled: intakePayload.booking_enabled ?? false,
      sms_enabled: data.callerAutoText !== false,
      // Per-call context injection fields
      timezone: intakePayload.timezone || 'America/Edmonton',
      context_data: intakePayload.context_data || null,
      context_data_label: intakePayload.context_data_label || null,
      // D302: Preserve niche intake fields for slot regeneration round-trip
      ...(Object.keys(mergedNicheVars).length > 0 ? { niche_custom_variables: mergedNicheVars } : {}),
    })
    .select("id")
    .single();

  if (clientErr || !clientRow) {
    console.error("[provision/trial] Client insert failed:", clientErr);
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }

  const clientId = clientRow.id as string;

  // Link intake to client
  await supa
    .from("intake_submissions")
    .update({ client_id: clientId })
    .eq("id", intakeId);

  // ── Generate prompt + create Ultravox agent (same as create-public-checkout) ──
  // Gate-13: Apply effective (plan-gated) values so prompt matches actual entitlements
  const intakeData: Record<string, unknown> = {
    ...data,
    ...intakePayload,
    call_handling_mode: effectiveCallHandlingMode,
  };
  if (!intakeData.niche && data.niche) intakeData.niche = data.niche;

  // D112+D326: Inject service_catalog from selectedServices so buildPromptFromIntake()
  // fills SERVICES_OFFERED with the actual services the owner entered during onboarding.
  // D326: parsedServiceDrafts carry description/price/duration from freeform paste+parse flow.
  const selectedServicesForPrompt: string[] = Array.isArray(data.selectedServices) ? data.selectedServices : [];
  const parsedDraftMap = new Map(
    (data.parsedServiceDrafts ?? [])
      .filter((d) => d.name?.trim())
      .map((d) => [d.name.trim().toLowerCase(), d])
  );
  if (selectedServicesForPrompt.length > 0) {
    intakeData.service_catalog = rowsToCatalogItems(
      selectedServicesForPrompt
        .filter((name) => typeof name === 'string' && name.trim())
        .map((name) => {
          const draft = parsedDraftMap.get(name.trim().toLowerCase());
          return {
            name: name.trim().slice(0, 200),
            description: draft?.description ?? '',
            category: '',
            duration_mins: draft?.duration_mins ?? null,
            price: draft?.price ?? '',
            booking_notes: '',
          };
        })
    );
  }

  // Website scraping enrichment
  // H: Skip duplicate scrape when user already previewed their website during onboarding
  let websiteContent = "";
  let rawScrapeResult: Awaited<ReturnType<typeof scrapeWebsite>> | null = null;
  const websiteUrl = data.websiteUrl || "";

  if (data.websiteScrapeResult) {
    // Reconstruct websiteContent from user-approved scrape preview data (saves 10-20s)
    const sr = data.websiteScrapeResult;
    const approvedFacts = sr.businessFacts.filter((_, i) => sr.approvedFacts[i] !== false);
    const approvedQa = sr.extraQa.filter((_, i) => sr.approvedQa[i] !== false);
    const factLines = approvedFacts.map((f: string) => `- ${f}`).join("\n");
    const qaLines = approvedQa.map((qa: { q: string; a: string }) => `Q: ${qa.q}\nA: ${qa.a}`).join("\n\n");
    websiteContent = [factLines, qaLines].filter(Boolean).join("\n\n");
  } else if (websiteUrl) {
    // Fallback: no preview data, scrape fresh
    rawScrapeResult = await scrapeWebsite(websiteUrl, data.niche || "other");
    if (rawScrapeResult.rawContent) {
      const factLines = rawScrapeResult.businessFacts.map((f: string) => `- ${f}`).join("\n");
      const qaLines = rawScrapeResult.extraQa.map((qa: { q: string; a: string }) => `Q: ${qa.q}\nA: ${qa.a}`).join("\n\n");
      websiteContent = [factLines, qaLines].filter(Boolean).join("\n\n");
    }
  }
  // GBP description intentionally NOT routed through websiteContent/buildPromptFromIntake.
  // It goes into business_facts only (call-time injection, editable/clearable from dashboard Facts card).

  // Fetch knowledge docs uploaded during onboarding
  let knowledgeDocs = "";
  const { data: kDocs } = await supa
    .from("client_knowledge_docs")
    .select("content_text")
    .eq("intake_id", intakeId);
  if (kDocs && kDocs.length > 0) {
    knowledgeDocs = kDocs.map((d: { content_text: string }) => d.content_text).join("\n\n---\n\n");
  }

  // 3-tier prompt size guard: full → no websiteContent → no knowledgeDocs → fail 422
  let prompt = '';
  let promptCharCount = 0;
  const promptAttempts: Array<{ websiteContent: string | null; knowledgeDocs: string | null }> = [
    { websiteContent, knowledgeDocs },
    { websiteContent: null, knowledgeDocs },
    { websiteContent: null, knowledgeDocs: null },
  ];
  let promptBuilt = false;
  for (const attempt of promptAttempts) {
    try {
      prompt = buildPromptFromIntake(intakeData, attempt.websiteContent ?? '', attempt.knowledgeDocs ?? '');
    } catch (err) {
      console.error("[provision/trial] buildPromptFromIntake failed:", err);
      await supa.from("intake_submissions").update({ client_id: null, progress_status: "abandoned" }).eq("id", intakeId);
      await supa.from("clients").delete().eq("id", clientId);
      return NextResponse.json({ error: "Prompt generation failed", detail: String(err) }, { status: 500 });
    }
    const v = validatePrompt(prompt);
    promptCharCount = v.charCount;
    if (v.valid) {
      if (!attempt.websiteContent && websiteContent) console.warn(`[provision/trial] Dropped websiteContent to fit prompt (niche=${data.niche})`);
      if (!attempt.knowledgeDocs && knowledgeDocs) console.warn(`[provision/trial] Dropped knowledgeDocs to fit prompt (niche=${data.niche})`);
      promptBuilt = true;
      break;
    }
  }
  if (!promptBuilt) {
    console.error(`[provision/trial] Prompt too large after all retries (niche=${data.niche})`);
    await supa.from("intake_submissions").update({ client_id: null, progress_status: "abandoned" }).eq("id", intakeId);
    await supa.from("clients").delete().eq("id", clientId);
    return NextResponse.json({ error: "prompt_too_large", chars: promptCharCount, hard_limit: 12000 }, { status: 422 });
  }

  // Voice ID: direct picker selection > gender fallback > niche default
  console.debug('[provision/trial] Voice resolution: direct=%s niche=%s', data.voiceId, data.niche)
  const voiceId = resolveVoiceId(
    data.voiceId ?? null,
    null,
    data.niche,
  );

  let agentId: string;
  try {
    agentId = await createAgent({
      systemPrompt: prompt,
      name: clientSlug.slice(0, 64),
      voice: voiceId,
      slug: clientSlug,
      maxDuration: '180s',
    });
  } catch (err) {
    console.error("[provision/trial] createAgent failed:", err);
    // S12-CODE1: Clear intake FK before deleting client to avoid orphaned reference
    await supa.from("intake_submissions").update({ client_id: null, progress_status: "abandoned" }).eq("id", intakeId);
    await supa.from("clients").delete().eq("id", clientId);
    return NextResponse.json({ error: "Agent creation failed", detail: String(err) }, { status: 502 });
  }

  // Update clients row with agent/prompt data
  const niche = data.niche || "other";
  const classificationRules = NICHE_CLASSIFICATION_RULES[niche] || NICHE_CLASSIFICATION_RULES.other;
  const timezone = data.timezone || "America/Edmonton";

  const { error: updateErr } = await supa
    .from("clients")
    .update({
      system_prompt: prompt,
      ultravox_agent_id: agentId,
      agent_voice_id: voiceId,
      classification_rules: classificationRules,
      timezone,
    })
    .eq("id", clientId);

  if (updateErr) {
    console.error("[provision/trial] clients update with agent data failed:", updateErr);
    try { await deleteAgent(agentId); } catch {}
    // S12-CODE1: Clear intake FK before deleting client to avoid orphaned reference
    await supa.from("intake_submissions").update({ client_id: null, progress_status: "abandoned" }).eq("id", intakeId);
    await supa.from("clients").delete().eq("id", clientId);
    return NextResponse.json({ error: "Failed to update client with agent data" }, { status: 500 });
  }

  // Seed prompt_versions with audit trail
  await insertPromptVersion(supa, {
    clientId,
    content: prompt,
    changeDescription: `Auto-generated at trial signup (niche: ${niche}, ${promptCharCount} chars)`,
    triggeredByUserId: null,
    triggeredByRole: "system",
    prevCharCount: null,
    version: 1,
  });

  console.log(`[provision/trial] Agent created: slug=${clientSlug} agentId=${agentId} voice=${voiceId} prompt=${promptCharCount} chars`);

  // Run activation chain in trial mode
  // S12-CODE4: activateClient() sets sms_enabled + calls syncClientTools() which rebuilds
  // clients.tools from DB flags. Runtime uses toolOverrides at call time, so stale Ultravox
  // agent tools don't affect calls. No separate updateAgent() needed here.
  const result = await activateClient({
    mode: 'trial',
    intakeId,
    clientId,
    clientSlug,
    trialDays: 7,
  });

  if (!result.success) {
    console.error(`[provision/trial] activateClient failed for slug=${clientSlug}: ${result.error}`);
    return NextResponse.json({ error: "Activation failed — please contact support" }, { status: 500 });
  }

  // Telegram alert handled by activateClient() — no duplicate needed

  // SCRAPE2/K2: Seed knowledge chunks from website scrape data
  let knowledgeCount = 0;
  try {
    const seedResult = await seedKnowledgeFromScrape(supa, {
      clientId,
      clientSlug,
      scrapeData: data.websiteScrapeResult ?? null,
      rawScrapeResult,
      runId: `trial-${intakeId}`,
      routeLabel: 'provision/trial',
      // D45: Only auto-approve when user explicitly reviewed during onboarding.
      // Fresh-scrape fallback (no websiteScrapeResult) goes to pending for dashboard review.
      ...(!data.websiteScrapeResult && rawScrapeResult ? { chunkStatus: 'pending' as const } : {}),
    });
    knowledgeCount = seedResult?.chunkCount ?? 0;
  } catch (seedErr) {
    // Chunk seeding failure should NOT block activation
    console.error(`[provision/trial] Knowledge seeding failed for ${clientSlug}:`, seedErr);
  }

  // Save approved scrape facts to business_facts/extra_qa so KnowledgeSummary works at call-time
  // Phase 0e: Also merge manual FAQ pairs from onboarding Step 4
  const scrapeSource = data.websiteScrapeResult ?? rawScrapeResult;
  const scrapedFacts: string[] = [];
  const scrapedQa: { q: string; a: string }[] = [];

  if (scrapeSource && (scrapeSource.businessFacts?.length > 0 || scrapeSource.extraQa?.length > 0)) {
    const preview = data.websiteScrapeResult as { approvedFacts?: boolean[]; approvedQa?: boolean[] } | undefined;
    const approvedFacts = preview?.approvedFacts
      ? scrapeSource.businessFacts.filter((_: string, i: number) => preview.approvedFacts![i] !== false)
      : scrapeSource.businessFacts;
    const approvedQa = preview?.approvedQa
      ? scrapeSource.extraQa.filter((_: { q: string; a: string }, i: number) => preview.approvedQa![i] !== false)
      : scrapeSource.extraQa;
    scrapedFacts.push(...approvedFacts.filter((f: string) => f?.trim()));
    scrapedQa.push(...approvedQa.filter((q: { q: string; a: string }) => q.q?.trim() && q.a?.trim()));
  }

  // Merge manual FAQ pairs (scraped first, manual appended)
  const manualQa = (data.faqPairs || [])
    .filter((p: { question: string; answer: string }) => p.question?.trim() && p.answer?.trim())
    .map((p: { question: string; answer: string }) => ({ q: p.question.trim(), a: p.answer.trim() }));
  const allQa = [...scrapedQa, ...manualQa];

  // If no scraped facts, fall back to GBP description formatted as a fact line
  const gbpFact = (data.gbpDescription && scrapedFacts.length === 0)
    ? `About this business: ${data.gbpDescription}` : '';
  const factsArr = scrapedFacts.length > 0 ? scrapedFacts : (gbpFact ? [gbpFact] : []);
  if (factsArr.length > 0 || allQa.length > 0) {
    await supa.from('clients').update({
      ...(factsArr.length > 0 ? { business_facts: factsArr } : {}),
      ...(allQa.length > 0 ? { extra_qa: allQa } : {}),
    }).eq('id', clientId);
    console.log(`[provision/trial] Saved knowledge to client columns: facts=${factsArr.length} qa=${allQa.length} (scraped=${scrapedQa.length} manual=${manualQa.length})`);
  }

  // Persist GBP provenance snapshot so the knowledge page can show "Imported from Google"
  if (data.placeId) {
    const { error: gbpErr } = await supa.from('clients').update({
      gbp_place_id:     data.placeId,
      gbp_summary:      data.gbpDescription ?? null,
      gbp_rating:       data.placesRating ?? null,
      gbp_review_count: data.placesReviewCount ?? null,
      gbp_photo_url:    data.placesPhotoUrl ?? null,
    }).eq('id', clientId)
    if (gbpErr) console.warn(`[provision/trial] GBP provenance save failed for ${clientSlug}:`, gbpErr.message)
  }

  // Gate-17: Set website_scrape_status to reflect actual scrape data.
  // Without this, hasWebsite (Gate-4) returns false for users who approved scrape during onboarding.
  // Also write website_knowledge_approved so dashboard stat cells show correct counts on first load.
  if (data.websiteScrapeResult) {
    const sr = data.websiteScrapeResult as { serviceTags?: string[] }
    await supa.from('clients').update({
      website_scrape_status: 'approved',
      website_knowledge_approved: {
        businessFacts: scrapedFacts,
        extraQa: scrapedQa,
        serviceTags: sr.serviceTags ?? [],
      },
    }).eq('id', clientId)
  } else if (rawScrapeResult?.rawContent) {
    // D45: Store preview so approve-website-knowledge route can bulk-approve from KnowledgeSheet
    await supa.from('clients').update({
      website_scrape_status: 'extracted',
      website_knowledge_preview: {
        businessFacts: rawScrapeResult.businessFacts,
        extraQa: rawScrapeResult.extraQa,
        serviceTags: rawScrapeResult.serviceTags ?? [],
      },
    }).eq('id', clientId)
  }

  // D110+D326: Insert selected services into client_services table
  // D326: Merge parsedServiceDrafts (description, price, duration) when available.
  const selectedServices: string[] = Array.isArray(data.selectedServices) ? data.selectedServices : [];
  if (selectedServices.length > 0) {
    const serviceRows = selectedServices
      .filter((name) => typeof name === 'string' && name.trim())
      .map((name, idx) => {
        const draft = parsedDraftMap.get(name.trim().toLowerCase());
        return {
          client_id: clientId,
          name: name.trim().slice(0, 200),
          description: draft?.description ?? '',
          category: '',
          duration_mins: draft?.duration_mins ?? null,
          price: draft?.price ?? '',
          booking_notes: '',
          active: true,
          sort_order: idx,
        };
      });
    if (serviceRows.length > 0) {
      const { error: servicesErr } = await supa
        .from('client_services')
        .insert(serviceRows);
      if (servicesErr) {
        // Non-fatal — services can be added from the dashboard
        console.warn(`[provision/trial] client_services insert failed for ${clientSlug}:`, servicesErr.message);
      } else {
        console.log(`[provision/trial] Inserted ${serviceRows.length} services for ${clientSlug}`);
      }
    }
  }

  // D127: Extract FAQ pairs from callerFaqText and merge into extra_qa
  const callerFaqText = (data.callerFaqText ?? '').trim();
  if (callerFaqText) {
    const faqApiKey = process.env.OPENROUTER_API_KEY;
    if (faqApiKey) {
      try {
        const faqRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${faqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'anthropic/claude-haiku-4-5',
            messages: [{
              role: 'user',
              content: `Extract question-and-answer pairs from the following caller FAQ text. Return ONLY valid JSON array with objects having "q" (question string) and "a" (answer string, inferred from context if not explicit). If only questions are listed with no answers, return [] — do not fabricate answers.

FAQ text: "${callerFaqText}"

Return ONLY valid JSON array, no markdown, no explanation. Example: [{"q":"Do you offer free estimates?","a":"Yes, free estimates are available."}]`,
            }],
            max_tokens: 1024,
            temperature: 0,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (faqRes.ok) {
          const faqData = await faqRes.json();
          const faqRaw = (faqData.choices?.[0]?.message?.content ?? '').trim();
          const arrayMatch = faqRaw.match(/\[[\s\S]*\]/);
          if (arrayMatch) {
            let parsedFaq: unknown[] = [];
            try { parsedFaq = JSON.parse(arrayMatch[0]); } catch { /* ignore */ }
            const extractedQa = parsedFaq
              .filter((item): item is { q: string; a: string } =>
                typeof item === 'object' && item !== null &&
                typeof (item as Record<string, unknown>).q === 'string' &&
                typeof (item as Record<string, unknown>).a === 'string' &&
                ((item as Record<string, unknown>).q as string).trim() !== '' &&
                ((item as Record<string, unknown>).a as string).trim() !== ''
              )
              .map((item) => ({ q: item.q.trim(), a: item.a.trim() }));

            if (extractedQa.length > 0) {
              // Fetch current extra_qa and merge (scraped/manual QA already written above)
              const { data: currentClient } = await supa
                .from('clients')
                .select('extra_qa')
                .eq('id', clientId)
                .maybeSingle();
              const existingQa: { q: string; a: string }[] = Array.isArray(currentClient?.extra_qa)
                ? (currentClient.extra_qa as { q: string; a: string }[])
                : [];
              // Dedup by question text
              const existingQuestions = new Set(existingQa.map((p) => p.q.toLowerCase()));
              const newQa = extractedQa.filter((p) => !existingQuestions.has(p.q.toLowerCase()));
              if (newQa.length > 0) {
                const merged = [...existingQa, ...newQa];
                await supa.from('clients').update({ extra_qa: merged }).eq('id', clientId);
                console.log(`[provision/trial] Added ${newQa.length} FAQ pairs from callerFaqText for ${clientSlug}`);
              }
            }
          }
        }
      } catch (faqErr) {
        // Non-fatal — FAQ extraction failure should not block activation
        console.warn(`[provision/trial] FAQ extraction failed for ${clientSlug}:`, faqErr);
      }
    }
  }

  const trialExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return NextResponse.json({
    success: true,
    clientId,
    trialExpiresAt,
    agentName: intakePayload.agent_name ?? null,  // Gate-14: use niche default when blank
    setupUrl: result.setupUrl ?? null,
    telegramLink: result.telegramLink ?? null,
    knowledgeCount: knowledgeCount ?? 0,
  }, { status: 201 });
}
