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
import { scrapeWebsite } from "@/lib/website-scraper";
import { insertPromptVersion } from "@/lib/prompt-version-utils";
import { seedKnowledgeFromScrape } from "@/lib/seed-knowledge";

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 3
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS)
  rateLimitMap.set(ip, timestamps)
  return timestamps.length >= RATE_LIMIT
}

function recordUsage(ip: string) {
  const timestamps = rateLimitMap.get(ip) || []
  timestamps.push(Date.now())
  rateLimitMap.set(ip, timestamps)
}

export async function POST(req: NextRequest) {
  const supa = createServiceClient()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'
  if (isRateLimited(ip)) {
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

  recordUsage(ip)

  const intakePayload = toIntakePayload(data);

  // For real_estate the display name is the agent's personal name (ownerName),
  // not the brokerage (businessName). The brokerage is preserved inside intake_json.
  const displayName = (data.niche === "real_estate" && data.ownerName?.trim())
    ? data.ownerName.trim()
    : data.businessName;

  const clientSlug = slugify(displayName);

  // Insert into intake_submissions
  const { data: row, error: insertErr } = await supa
    .from("intake_submissions")
    .insert({
      business_name: displayName,
      niche: data.niche || "other",
      intake_json: { ...data, ...intakePayload },
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
      agent_name: data.agentName || null,
      // Phase 0b: Write onboarding fields so settings dashboard shows them
      business_hours_weekday: intakePayload.hours_weekday || null,
      business_hours_weekend: null,
      after_hours_behavior: data.afterHoursBehavior || 'take_message',
      after_hours_emergency_phone: data.emergencyPhone || null,
      website_url: data.websiteUrl || null,
      owner_name: data.ownerName || null,
      city: data.city || null,
      state: data.state || null,
      services_offered: intakePayload.services_offered || null,
      callback_phone: intakePayload.callback_phone || null,
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
  const intakeData: Record<string, unknown> = { ...data, ...intakePayload };
  if (!intakeData.niche && data.niche) intakeData.niche = data.niche;

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

  // Fetch knowledge docs uploaded during onboarding
  let knowledgeDocs = "";
  const { data: kDocs } = await supa
    .from("client_knowledge_docs")
    .select("content_text")
    .eq("intake_id", intakeId);
  if (kDocs && kDocs.length > 0) {
    knowledgeDocs = kDocs.map((d: { content_text: string }) => d.content_text).join("\n\n---\n\n");
  }

  let prompt: string;
  try {
    prompt = buildPromptFromIntake(intakeData, websiteContent, knowledgeDocs);
  } catch (err) {
    console.error("[provision/trial] buildPromptFromIntake failed:", err);
    return NextResponse.json({ error: "Prompt generation failed", detail: String(err) }, { status: 500 });
  }

  const validation = validatePrompt(prompt);
  if (!validation.valid) {
    // Rollback orphaned rows (S12-V18: was missing — left dangling intake + client rows)
    await supa.from("intake_submissions").update({ client_id: null, progress_status: "abandoned" }).eq("id", intakeId);
    await supa.from("clients").delete().eq("id", clientId);
    return NextResponse.json({ error: "Prompt failed validation", errors: validation.errors }, { status: 422 });
  }

  // Voice ID: direct picker selection > gender fallback > niche default
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
    changeDescription: `Auto-generated at trial signup (niche: ${niche}, ${validation.charCount} chars)`,
    triggeredByUserId: null,
    triggeredByRole: "system",
    prevCharCount: null,
    version: 1,
  });

  console.log(`[provision/trial] Agent created: slug=${clientSlug} agentId=${agentId} voice=${voiceId} prompt=${validation.charCount} chars`);

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
  try {
    await seedKnowledgeFromScrape(supa, {
      clientId,
      clientSlug,
      scrapeData: data.websiteScrapeResult ?? null,
      rawScrapeResult,
      runId: `trial-${intakeId}`,
      routeLabel: 'provision/trial',
    });
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

  const factsText = scrapedFacts.join('\n');
  if (factsText || allQa.length > 0) {
    await supa.from('clients').update({
      ...(factsText ? { business_facts: factsText } : {}),
      ...(allQa.length > 0 ? { extra_qa: allQa } : {}),
    }).eq('id', clientId);
    console.log(`[provision/trial] Saved knowledge to client columns: facts=${factsText ? factsText.split('\n').length : 0} qa=${allQa.length} (scraped=${scrapedQa.length} manual=${manualQa.length})`);
  }

  const trialExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return NextResponse.json({
    success: true,
    clientId,
    trialExpiresAt,
    setupUrl: result.setupUrl ?? null,
    telegramLink: result.telegramLink ?? null,
  }, { status: 201 });
}
