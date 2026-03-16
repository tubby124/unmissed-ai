import { NextRequest, NextResponse } from "next/server";
import { OnboardingData } from "@/types/onboarding";
import { createClient } from "@supabase/supabase-js";
import { sendAlert } from "@/lib/telegram";
import { toIntakePayload, slugify } from "@/lib/intake-transform";

// Supabase service client — bypasses RLS for intake management
const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const data: OnboardingData = await req.json();

  // Basic validation
  if (!data.businessName || !data.niche) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const phoneDigits = (data.callbackPhone || "").replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    return NextResponse.json({ error: "Please enter a valid phone number with area code" }, { status: 400 });
  }

  if (!data.contactEmail?.trim()) {
    return NextResponse.json({ error: "Email address is required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail.trim())) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  if (!data.businessHoursText?.trim() && data.niche !== 'voicemail') {
    return NextResponse.json({ error: "Business hours are required" }, { status: 400 });
  }

  const intakePayload = toIntakePayload(data);

  // For real_estate the display name is the agent's personal name (ownerName),
  // not the brokerage (businessName). The brokerage is preserved inside intake_json.
  const displayName = (data.niche === "real_estate" && data.ownerName?.trim())
    ? data.ownerName.trim()
    : data.businessName;

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
      client_slug: slugify(displayName),
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    console.error("[provision] Insert failed:", insertErr);
    return NextResponse.json({ error: "Failed to save request" }, { status: 500 });
  }

  const jobId = row.id as string;

  // Fire-and-forget admin Telegram alert
  ;(async () => {
    try {
      const { data: adminClient } = await supa
        .from("clients")
        .select("telegram_bot_token, telegram_chat_id")
        .eq("slug", "hasan-sharif")
        .single();

      if (adminClient?.telegram_bot_token && adminClient?.telegram_chat_id) {
        const goalLabels: Record<string, string> = {
          capture_info: "Capture info for callback",
          book_appointment: "Direct booking",
          faq_only: "FAQ only",
        };
        const msg = `🆕 <b>New Agent Request</b>

<b>${displayName}</b>${data.niche === "real_estate" && data.businessName ? ` (${data.businessName})` : ""} — ${(data.niche || "other").replace(/_/g, " ")}
📍 ${data.city}, ${data.state}
📞 ${data.callbackPhone}
👤 ${data.ownerName || "not provided"} — ${data.contactEmail || "no email"}
🌐 ${data.websiteUrl || "no website"}
🎯 Goal: ${goalLabels[data.primaryGoal || ""] || "not specified"}

→ <a href="https://unmissed-ai-production.up.railway.app/dashboard/clients">Review in admin panel</a>`;

        await sendAlert(adminClient.telegram_bot_token, adminClient.telegram_chat_id, msg);
      }
    } catch (e) {
      console.error("[provision] Admin Telegram alert failed:", e);
    }
  })();

  return NextResponse.json({ jobId }, { status: 202 });
}
