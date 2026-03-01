import { NextRequest, NextResponse } from "next/server";
import { OnboardingData } from "@/types/onboarding";

// n8n provisioning webhook — set this in your .env.local
const N8N_PROVISION_WEBHOOK = process.env.N8N_PROVISION_WEBHOOK_URL || "";

// Simple in-memory job store for dev — replace with Supabase in production
// In production: INSERT INTO provisioning_jobs and return the UUID
const jobStore = new Map<string, {
  status: string;
  twilio_number?: string;
  error?: string;
  data: OnboardingData;
}>();

export async function POST(req: NextRequest) {
  const data: OnboardingData = await req.json();

  // Basic validation
  if (!data.businessName || !data.niche || !data.city || !data.state) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Generate a job ID
  const jobId = crypto.randomUUID();

  // Store job as pending
  jobStore.set(jobId, { status: "pending", data });

  // Fire-and-forget: trigger n8n provisioning webhook
  if (N8N_PROVISION_WEBHOOK) {
    // Don't await — provisioning runs in background
    triggerProvisioning(jobId, data).catch((err) => {
      const job = jobStore.get(jobId);
      if (job) jobStore.set(jobId, { ...job, status: "failed", error: String(err) });
    });
  } else {
    // Dev mode: simulate provisioning after 3 seconds
    simulateProvisioning(jobId);
  }

  return NextResponse.json({ jobId }, { status: 202 });
}

async function triggerProvisioning(jobId: string, data: OnboardingData) {
  const job = jobStore.get(jobId)!;
  jobStore.set(jobId, { ...job, status: "buying_number" });

  const res = await fetch(N8N_PROVISION_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, ...data }),
  });

  if (!res.ok) {
    throw new Error(`n8n webhook returned ${res.status}`);
  }

  const result = await res.json();
  jobStore.set(jobId, {
    ...job,
    status: "active",
    twilio_number: result.twilio_number,
  });
}

async function simulateProvisioning(jobId: string) {
  const job = jobStore.get(jobId)!;
  const steps = ["buying_number", "cloning_workflow", "wiring_creds", "active"];
  for (const status of steps) {
    await new Promise((r) => setTimeout(r, 2000));
    jobStore.set(jobId, {
      ...job,
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
