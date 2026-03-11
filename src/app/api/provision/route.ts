import { NextRequest, NextResponse } from "next/server";
import { OnboardingData, Niche, defaultAgentNames } from "@/types/onboarding";
import { createClient } from "@supabase/supabase-js";
import { sendAlert } from "@/lib/telegram";

// Supabase service client — bypasses RLS for intake management
const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Map province/state abbreviations to timezone
const TIMEZONE_MAP: Record<string, string> = {
  // Canada
  AB: "America/Edmonton", BC: "America/Vancouver", SK: "America/Regina",
  MB: "America/Winnipeg", ON: "America/Toronto", QC: "America/Toronto",
  NB: "America/Halifax", NS: "America/Halifax", PE: "America/Halifax",
  NL: "America/St_Johns", NT: "America/Yellowknife", YT: "America/Whitehorse",
  NU: "America/Iqaluit",
  // US — Eastern
  CT: "America/New_York", DE: "America/New_York", GA: "America/New_York",
  IN: "America/New_York", KY: "America/New_York", ME: "America/New_York",
  MD: "America/New_York", MA: "America/New_York", NH: "America/New_York",
  NJ: "America/New_York", NY: "America/New_York", NC: "America/New_York",
  OH: "America/New_York", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", VT: "America/New_York", VA: "America/New_York",
  WV: "America/New_York", DC: "America/New_York", FL: "America/New_York",
  // US — Central
  AL: "America/Chicago", AR: "America/Chicago", IL: "America/Chicago",
  IA: "America/Chicago", KS: "America/Chicago", LA: "America/Chicago",
  MN: "America/Chicago", MS: "America/Chicago", MO: "America/Chicago",
  NE: "America/Chicago", ND: "America/Chicago", OK: "America/Chicago",
  SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago",
  WI: "America/Chicago",
  // US — Mountain
  CO: "America/Denver", ID: "America/Denver", MT: "America/Denver",
  NM: "America/Denver", UT: "America/Denver", WY: "America/Denver",
  // US — Pacific
  CA: "America/Los_Angeles", NV: "America/Los_Angeles",
  OR: "America/Los_Angeles", WA: "America/Los_Angeles",
  // US — Other
  AZ: "America/Phoenix", HI: "America/Honolulu", AK: "America/Anchorage",
  MI: "America/Detroit",
};

function detectCountry(stateOrProvince: string): string {
  const canadianProvinces = ["AB","BC","SK","MB","ON","QC","NB","NS","PE","NL","NT","YT","NU"];
  return canadianProvinces.includes(stateOrProvince.toUpperCase()) ? "CA" : "US";
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function mapInsuranceToPreset(nicheInsurance: string): string {
  const mapping: Record<string, string> = {
    all_major: "all_insurance",
    private_pay: "private_only",
    pending: "waiting_approval",
    other: "private_only",
  };
  return mapping[nicheInsurance] || "private_only";
}

/**
 * Transform OnboardingData (camelCase, from wizard) into
 * intake payload (snake_case) stored in intake_json.
 */
function toIntakePayload(data: OnboardingData) {
  const to12h = (t: string) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
  };
  const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  const openDays = dayNames
    .filter(d => !data.hours[d].closed)
    .map(d => `${d.charAt(0).toUpperCase() + d.slice(1)} ${to12h(data.hours[d].open)}–${to12h(data.hours[d].close)}`);
  const hoursStr = openDays.length > 0 ? openDays.join(", ") : "By appointment";

  const digits = data.callbackPhone.replace(/\D/g, "");
  const areaCode = digits.length >= 10
    ? digits.slice(digits.length === 11 ? 1 : 0, digits.length === 11 ? 4 : 3)
    : "587";

  const niche = data.niche || "other";
  const defaultName = niche ? defaultAgentNames[niche as Niche] : "Sam";
  const stateCode = (data.state || "AB").toUpperCase();
  const country = detectCountry(stateCode);
  const timezone = TIMEZONE_MAP[stateCode] || "America/Edmonton";

  const rawInsurance = (data.nicheAnswers.insurance as string) || "";
  const insurancePreset = rawInsurance ? mapInsuranceToPreset(rawInsurance) : "private_only";

  const weekendPolicy = data.hours.saturday.closed && data.hours.sunday.closed
    ? "closed weekends"
    : !data.hours.saturday.closed && !data.hours.sunday.closed
    ? "open weekends"
    : !data.hours.saturday.closed
    ? "open Saturdays only"
    : "open Sundays only";

  return {
    business_name: data.businessName,
    niche,
    area_code: areaCode,
    country,
    city: data.city || "N/A",
    province: stateCode,
    timezone,
    owner_name: data.ownerName || "",
    contact_email: data.contactEmail || "",
    website_url: data.websiteUrl || "",
    primary_goal: data.primaryGoal || "",
    completion_fields: data.completionFields || "",
    notification_method: data.notificationMethod || "telegram",
    notification_phone: data.notificationPhone || "",
    notification_email: data.notificationEmail || "",
    agent_name: data.agentName || defaultName,
    hours_weekday: hoursStr,
    insurance_preset: insurancePreset,
    weekend_policy: weekendPolicy,
    callback_phone: data.callbackPhone,
    after_hours_behavior: data.afterHoursBehavior || "take_message",
    agent_tone: data.agentTone || "casual",
    caller_faq: data.callerFAQ || "",
    agent_restrictions: data.agentRestrictions || "",
    ...Object.fromEntries(
      Object.entries(data.nicheAnswers).map(([k, v]) =>
        [`niche_${k}`, Array.isArray(v) ? (v as string[]).join(", ") : String(v)]
      )
    ),
  };
}

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

  const intakePayload = toIntakePayload(data);

  // Insert into intake_submissions
  const { data: row, error: insertErr } = await supa
    .from("intake_submissions")
    .insert({
      business_name: data.businessName,
      niche: data.niche || "other",
      intake_json: { ...data, ...intakePayload },
      status: "pending",
      progress_status: "pending",
      owner_name: data.ownerName || null,
      contact_email: data.contactEmail || null,
      client_slug: slugify(data.businessName),
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

<b>${data.businessName}</b> — ${(data.niche || "other").replace(/_/g, " ")}
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
