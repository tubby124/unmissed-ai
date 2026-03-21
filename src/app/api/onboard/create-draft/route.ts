/**
 * POST /api/onboard/create-draft
 *
 * Creates a lightweight intake_submissions row with progress_status='draft'
 * so that knowledge doc uploads (/api/client/knowledge/upload) can validate
 * the intake_id FK during onboarding — before the full submission happens.
 *
 * Idempotent: if the row already exists, returns 200 OK.
 * Public — no auth (called during onboarding wizard).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { intake_id, niche } = body as { intake_id?: string; niche?: string };

    if (!intake_id || typeof intake_id !== "string") {
      return NextResponse.json({ error: "intake_id is required" }, { status: 400 });
    }

    // Validate UUID format to prevent malformed IDs hitting the DB
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(intake_id)) {
      return NextResponse.json({ error: "intake_id must be a valid UUID" }, { status: 400 });
    }

    const supa = createServiceClient();

    // Check if row already exists (idempotent)
    const { data: existing } = await supa
      .from("intake_submissions")
      .select("id")
      .eq("id", intake_id)
      .single();

    if (existing) {
      return NextResponse.json({ ok: true });
    }

    // Create draft row — minimal fields, just enough for FK validation.
    // S12-V10: include all columns that may have NOT NULL constraints
    // to prevent 500 errors from schema validation failures.
    const { error: insertErr } = await supa
      .from("intake_submissions")
      .insert({
        id: intake_id,
        business_name: "Draft",
        niche: niche || "other",
        status: "draft",
        progress_status: "draft",
        contact_email: null,
        owner_name: null,
        client_slug: null,
        intake_json: {},
      });

    if (insertErr) {
      // Race condition: another request created it between our check and insert
      if (insertErr.code === "23505") {
        return NextResponse.json({ ok: true });
      }
      console.error("[create-draft] Insert failed:", insertErr.code, insertErr.message, insertErr.details);
      return NextResponse.json(
        { error: "Failed to create draft", code: insertErr.code, detail: insertErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[create-draft] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
