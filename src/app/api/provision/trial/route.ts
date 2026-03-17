/**
 * POST /api/provision/trial
 *
 * Creates a client in trial mode — no Twilio number, dashboard access + WebRTC demo calls.
 * Rate limited: 3 trials/hr/IP, 1 trial/email.
 */

import { NextRequest, NextResponse } from "next/server";
import { OnboardingData } from "@/types/onboarding";
import { createClient } from "@supabase/supabase-js";
import { sendAlert } from "@/lib/telegram";
import { toIntakePayload, slugify } from "@/lib/intake-transform";
import { activateClient } from "@/lib/activate-client";

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

// Supabase service client — bypasses RLS for intake management
const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
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

  // Run activation chain in trial mode
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

  // Fire-and-forget admin Telegram alert
  ;(async () => {
    try {
      const { data: adminClient } = await supa
        .from("clients")
        .select("telegram_bot_token, telegram_chat_id")
        .eq("slug", "hasan-sharif")
        .single();

      if (adminClient?.telegram_bot_token && adminClient?.telegram_chat_id) {
        const msg = `🧪 <b>New Trial</b>\n\n<b>${displayName}</b> — ${(data.niche || "other").replace(/_/g, " ")}\n📧 ${data.contactEmail}\n📍 ${data.city || 'N/A'}, ${data.state || 'N/A'}\n\n7-day trial started. No Twilio number assigned.`;
        await sendAlert(adminClient.telegram_bot_token, adminClient.telegram_chat_id, msg);
      }
    } catch (e) {
      console.error("[provision/trial] Admin Telegram alert failed:", e);
    }
  })();

  const trialExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return NextResponse.json({
    success: true,
    clientId,
    trialExpiresAt,
    setupUrl: result.setupUrl ?? null,
    telegramLink: result.telegramLink ?? null,
  }, { status: 201 });
}
