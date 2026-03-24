/**
 * billing-auth.ts — Shared auth check for billing API routes.
 *
 * Verifies the caller is authenticated and owns the requested client
 * (or is an admin). Returns the verified clientId or an error response.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface AuthResult {
  ok: true;
  clientId: string;
}

interface AuthError {
  ok: false;
  response: NextResponse;
}

export async function verifyBillingAuth(clientId: string): Promise<AuthResult | AuthError> {
  if (!clientId) {
    return { ok: false, response: NextResponse.json({ error: "Missing clientId" }, { status: 400 }) };
  }

  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, response: new NextResponse("Unauthorized", { status: 401 }) };
  }

  const { data: cu } = await supabase
    .from("client_users")
    .select("client_id, role")
    .eq("user_id", user.id)
    .order("role")
    .limit(1)
    .maybeSingle();

  if (!cu) {
    return { ok: false, response: new NextResponse("Unauthorized", { status: 401 }) };
  }

  // Admin can access any client; owner can only access their own
  if (cu.role !== "admin" && cu.client_id !== clientId) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, clientId };
}
