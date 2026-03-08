import { NextRequest, NextResponse } from "next/server";
import { OnboardingData, Niche, defaultAgentNames } from "@/types/onboarding";
import { createClient } from "@supabase/supabase-js";

// Provisioning backend URL — FastAPI service (local or Railway)
const PROVISION_API_URL = process.env.PROVISION_API_URL || "";
const PROVISION_API_KEY = process.env.PROVISION_API_KEY || "";

// Supabase service client — bypasses RLS for job management
const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function setProgress(jobId: string, progressStatus: string, extra: Record<string, unknown> = {}) {
  await supa
    .from("intake_submissions")
    .update({ progress_status: progressStatus, ...extra })
    .eq("id", jobId);
}

// Map province/state abbreviations to timezone
const TIMEZONE_MAP: Record<string, string> = {
  // Canada
  AB: "America/Edmonton", BC: "America/Vancouver", SK: "America/Regina",
  MB: "America/Winnipeg", ON: "America/Toronto", QC: "America/Toronto",
  NB: "America/Halifax", NS: "America/Halifax", PE: "America/Halifax",
  NL: "America/St_Johns", NT: "America/Yellowknife", YT: "America/Whitehorse",
  NU: "America/Iqaluit",
  // US — Eastern (America/New_York)
  CT: "America/New_York", DE: "America/New_York", GA: "America/New_York",
  IN: "America/New_York", KY: "America/New_York", ME: "America/New_York",
  MD: "America/New_York", MA: "America/New_York", NH: "America/New_York",
  NJ: "America/New_York", NY: "America/New_York", NC: "America/New_York",
  OH: "America/New_York", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", VT: "America/New_York", VA: "America/New_York",
  WV: "America/New_York", DC: "America/New_York", FL: "America/New_York",
  // US — Central (America/Chicago)
  AL: "America/Chicago", AR: "America/Chicago", IL: "America/Chicago",
  IA: "America/Chicago", KS: "America/Chicago", LA: "America/Chicago",
  MN: "America/Chicago", MS: "America/Chicago", MO: "America/Chicago",
  NE: "America/Chicago", ND: "America/Chicago", OK: "America/Chicago",
  SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago",
  WI: "America/Chicago",
  // US — Mountain (America/Denver)
  CO: "America/Denver", ID: "America/Denver", MT: "America/Denver",
  NM: "America/Denver", UT: "America/Denver", WY: "America/Denver",
  // US — Pacific (America/Los_Angeles)
  CA: "America/Los_Angeles", NV: "America/Los_Angeles",
  OR: "America/Los_Angeles", WA: "America/Los_Angeles",
  // US — Other
  AZ: "America/Phoenix", HI: "America/Honolulu", AK: "America/Anchorage",
  MI: "America/Detroit",
};

// Detect country from state/province code
function detectCountry(stateOrProvince: string): string {
  const canadianProvinces = ["AB","BC","SK","MB","ON","QC","NB","NS","PE","NL","NT","YT","NU"];
  return canadianProvinces.includes(stateOrProvince.toUpperCase()) ? "CA" : "US";
}

/**
 * Map the auto-glass niche's insurance value to the prompt_builder's insurance_preset.
 */
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
 * ProvisionRequest (snake_case, for FastAPI backend).
 */
function toProvisionRequest(data: OnboardingData) {
  // Build hours string from the hours object (12h format for natural speech)
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

  // Extract area code from callback phone (first 3 digits after country code)
  const digits = data.callbackPhone.replace(/\D/g, "");
  const areaCode = digits.length >= 10
    ? digits.slice(digits.length === 11 ? 1 : 0, digits.length === 11 ? 4 : 3)
    : "587"; // fallback

  const niche = data.niche || "other";
  const defaultName = niche ? defaultAgentNames[niche as Niche] : "Sam";
  const country = detectCountry(data.state);
  const timezone = TIMEZONE_MAP[data.state.toUpperCase()] || "America/Chicago";

  // Map niche-specific insurance to prompt_builder preset
  const rawInsurance = (data.nicheAnswers.insurance as string) || "";
  const insurancePreset = rawInsurance ? mapInsuranceToPreset(rawInsurance) : "private_only";

  // Weekend policy from hours
  const weekendPolicy = data.hours.saturday.closed && data.hours.sunday.closed
    ? "closed weekends"
    : !data.hours.saturday.closed && !data.hours.sunday.closed
    ? "open weekends"
    : !data.hours.saturday.closed
    ? "open Saturdays only"
    : "open Sundays only";

  // Validate callback phone — must have at least 10 digits
  if (digits.length < 10) {
    console.warn(`[provision] Callback phone looks invalid: "${data.callbackPhone}" (${digits.length} digits)`);
  }

  return {
    business_name: data.businessName,
    niche: niche,
    area_code: areaCode,
    country,
    city: data.city,
    province: data.state,
    timezone,
    telegram_chat_id: "7278536150", // operator chat — will be per-client later
    // Notification preferences (for future per-client routing)
    notification_method: data.notificationMethod || "telegram",
    notification_phone: data.notificationPhone || "",
    notification_email: data.notificationEmail || "",
    intake: {
      business_name: data.businessName,
      city: data.city,
      niche: niche,
      agent_name: data.agentName || defaultName,
      hours_weekday: hoursStr,
      insurance_preset: insurancePreset,
      weekend_policy: weekendPolicy,
      callback_phone: data.callbackPhone,
      services_not_offered: "",
      after_hours_behavior: data.afterHoursBehavior || "take_message",
      agent_tone: data.agentTone || "casual",
      // Step 6 data — injected into the prompt by prompt_builder
      caller_faq: data.callerFAQ || "",
      agent_restrictions: data.agentRestrictions || "",
      // Pass through all niche answers for prompt builder
      ...Object.fromEntries(
        Object.entries(data.nicheAnswers).map(([k, v]) =>
          [`niche_${k}`, Array.isArray(v) ? (v as string[]).join(", ") : String(v)]
        )
      ),
    },
  };
}

export async function POST(req: NextRequest) {
  const data: OnboardingData = await req.json();

  // Basic validation
  if (!data.businessName || !data.niche || !data.city || !data.state) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Phone validation — must have at least 10 digits
  const phoneDigits = (data.callbackPhone || "").replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    return NextResponse.json({ error: "Please enter a valid phone number with area code" }, { status: 400 });
  }

  // Insert job row in Supabase — returns the UUID as jobId
  const { data: row, error: insertErr } = await supa
    .from("intake_submissions")
    .insert({
      business_name: data.businessName,
      niche: data.niche || "other",
      intake_json: data,
      status: "pending",
      progress_status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    console.error("[provision] Insert failed:", insertErr);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  const jobId = row.id as string;

  if (PROVISION_API_URL) {
    // Real provisioning via FastAPI backend
    triggerProvisioning(jobId, data).catch(async (err) => {
      await setProgress(jobId, "failed", { status: "failed" });
      console.error("[provision] triggerProvisioning failed:", err);
    });
  } else {
    // Dev mode: simulate provisioning
    simulateProvisioning(jobId);
  }

  return NextResponse.json({ jobId }, { status: 202 });
}

async function triggerProvisioning(jobId: string, data: OnboardingData) {
  await setProgress(jobId, "buying_number");

  const provisionPayload = toProvisionRequest(data);

  const progressTimer = setTimeout(() => setProgress(jobId, "cloning_workflow"), 8000);
  const progressTimer2 = setTimeout(() => setProgress(jobId, "wiring_creds"), 20000);

  try {
    const res = await fetch(`${PROVISION_API_URL}/provision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": PROVISION_API_KEY,
      },
      body: JSON.stringify(provisionPayload),
    });

    clearTimeout(progressTimer);
    clearTimeout(progressTimer2);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail?.error || `Provisioning failed: ${res.status}`);
    }

    const result = await res.json();
    await setProgress(jobId, "active", {
      status: "provisioned",
      intake_json: { ...(data as unknown as Record<string, unknown>), _twilio_number: result.phone },
    });
  } catch (err) {
    clearTimeout(progressTimer);
    clearTimeout(progressTimer2);
    throw err;
  }
}

async function simulateProvisioning(jobId: string) {
  const steps = ["buying_number", "cloning_workflow", "wiring_creds", "active"] as const;
  for (const step of steps) {
    await new Promise((r) => setTimeout(r, 2000));
    if (step === "active") {
      await setProgress(jobId, "active", {
        status: "provisioned",
        intake_json: { _twilio_number: "+15551234567" },
      });
    } else {
      await setProgress(jobId, step);
    }
  }
}

// GET /api/provision?jobId=xxx — status polling endpoint
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const { data: row, error } = await supa
    .from("intake_submissions")
    .select("id, progress_status, status, intake_json")
    .eq("id", jobId)
    .single();

  if (error || !row) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const intake = (row.intake_json as Record<string, unknown>) || {};
  const twilioNumber = (intake._twilio_number as string) || null;
  const isFailed = row.status === "failed";

  return NextResponse.json({
    jobId,
    status: row.progress_status || row.status,
    twilio_number: twilioNumber,
    error: isFailed ? "Provisioning failed" : null,
  });
}
