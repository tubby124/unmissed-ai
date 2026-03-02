import { NextRequest, NextResponse } from "next/server";
import { OnboardingData, Niche, defaultAgentNames } from "@/types/onboarding";

// Provisioning backend URL — FastAPI service (local or Railway)
const PROVISION_API_URL = process.env.PROVISION_API_URL || "";
const PROVISION_API_KEY = process.env.PROVISION_API_KEY || "";

// In-memory job store — works for single-instance Railway deployments.
// For multi-instance, replace with Redis or Supabase.
const jobStore = new Map<string, {
  status: string;
  twilio_number?: string;
  error?: string;
}>();

// Map province/state abbreviations to timezone
const TIMEZONE_MAP: Record<string, string> = {
  // Canada
  AB: "America/Edmonton", BC: "America/Vancouver", SK: "America/Regina",
  MB: "America/Winnipeg", ON: "America/Toronto", QC: "America/Toronto",
  NB: "America/Halifax", NS: "America/Halifax", PE: "America/Halifax",
  NL: "America/St_Johns", NT: "America/Yellowknife", YT: "America/Whitehorse",
  NU: "America/Iqaluit",
  // US common
  NY: "America/New_York", CA: "America/Los_Angeles", TX: "America/Chicago",
  FL: "America/New_York", IL: "America/Chicago", WA: "America/Los_Angeles",
  AZ: "America/Phoenix", CO: "America/Denver", GA: "America/New_York",
  OH: "America/New_York", PA: "America/New_York", MI: "America/Detroit",
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
  const timezone = TIMEZONE_MAP[data.state.toUpperCase()] || "America/Edmonton";

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

  // Generate a job ID
  const jobId = crypto.randomUUID();

  // Store job as pending
  jobStore.set(jobId, { status: "pending" });

  if (PROVISION_API_URL) {
    // Real provisioning via FastAPI backend
    triggerProvisioning(jobId, data).catch((err) => {
      jobStore.set(jobId, { status: "failed", error: String(err) });
    });
  } else {
    // Dev mode: simulate provisioning
    simulateProvisioning(jobId);
  }

  return NextResponse.json({ jobId }, { status: 202 });
}

async function triggerProvisioning(jobId: string, data: OnboardingData) {
  // Step 1: buying number
  jobStore.set(jobId, { status: "buying_number" });

  const provisionPayload = toProvisionRequest(data);

  // Simulate intermediate steps for the status page
  // The backend does everything synchronously, so we show progress here
  const progressTimer = setTimeout(() => {
    const current = jobStore.get(jobId);
    if (current && current.status === "buying_number") {
      jobStore.set(jobId, { status: "cloning_workflow" });
    }
  }, 8000);

  const progressTimer2 = setTimeout(() => {
    const current = jobStore.get(jobId);
    if (current && current.status === "cloning_workflow") {
      jobStore.set(jobId, { status: "wiring_creds" });
    }
  }, 20000);

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
    jobStore.set(jobId, {
      status: "active",
      twilio_number: result.phone,
    });
  } catch (err) {
    clearTimeout(progressTimer);
    clearTimeout(progressTimer2);
    throw err;
  }
}

async function simulateProvisioning(jobId: string) {
  const steps: Array<"buying_number" | "cloning_workflow" | "wiring_creds" | "active"> = [
    "buying_number", "cloning_workflow", "wiring_creds", "active",
  ];
  for (const status of steps) {
    await new Promise((r) => setTimeout(r, 2000));
    jobStore.set(jobId, {
      status,
      twilio_number: status === "active" ? "+15551234567" : undefined,
    });
  }
}

// GET /api/provision?jobId=xxx — status polling endpoint
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const job = jobStore.get(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({
    jobId,
    status: job.status,
    twilio_number: job.twilio_number || null,
    error: job.error || null,
  });
}
