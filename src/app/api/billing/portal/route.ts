/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for self-service billing management.
 * Allows: payment method updates, invoice history, subscription cancellation.
 *
 * Body: { clientId: string }
 * Returns: { url: string } — redirect to Stripe Customer Portal
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/app-url";
import { verifyBillingAuth } from "@/lib/billing-auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

export async function POST(req: NextRequest) {
  const { clientId } = await req.json();

  const auth = await verifyBillingAuth(clientId);
  if (!auth.ok) return auth.response;

  const supa = createServiceClient();
  const { data: client } = await supa
    .from("clients")
    .select("stripe_customer_id")
    .eq("id", clientId)
    .maybeSingle();

  if (!client?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer found — complete a purchase first" },
      { status: 404 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: client.stripe_customer_id,
    return_url: `${APP_URL}/dashboard/settings`,
  });

  return NextResponse.json({ url: session.url });
}
