/**
 * POST /api/billing/upgrade
 *
 * Creates a Stripe Checkout session for upgrading to a paid plan.
 * Called from dashboard when trial expires or user wants to upgrade.
 *
 * Body: { planId: "lite" | "core" | "pro", billing: "monthly" | "annual", clientId: string }
 * Returns: { url: string } — redirect to Stripe Checkout
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/pricing";
import { APP_URL } from "@/lib/app-url";
import { verifyBillingAuth } from "@/lib/billing-auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

export async function POST(req: NextRequest) {
  const { planId, billing, clientId } = await req.json();

  if (!planId || !billing || !clientId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const auth = await verifyBillingAuth(clientId);
  if (!auth.ok) return auth.response;

  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId =
    billing === "annual" ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId;

  if (!priceId) {
    return NextResponse.json({ error: "Plan price not configured" }, { status: 500 });
  }

  // Look up the client's email and phone provisioning status
  const supa = createServiceClient();
  const { data: client } = await supa
    .from("clients")
    .select("contact_email, slug, business_name, twilio_number")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Post-onboarding destination helper:
  // twilio_number is the real signal — trial users have none, so they need
  // the Go Live activation page; users with an existing number go to overview.
  const successDest = (client as Record<string, unknown>).twilio_number
    ? `${APP_URL}/dashboard?upgraded=true&plan=${planId}`
    : `${APP_URL}/dashboard/setup?upgraded=true&plan=${planId}`

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    customer_email: client.contact_email ?? undefined,
    metadata: { clientId, planId, billing },
    success_url: successDest,
    cancel_url: `${APP_URL}/dashboard?upgrade_cancelled=true`,
  });

  return NextResponse.json({ url: session.url });
}
