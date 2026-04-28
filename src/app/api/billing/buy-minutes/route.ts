/**
 * POST /api/billing/buy-minutes
 *
 * Creates a Stripe Checkout session for one-time minute pack purchase.
 * Webhook handler for checkout.session.completed with metadata.type=minute_reload
 * already exists in /api/webhook/stripe.
 *
 * Body: { clientId: string, packIndex: 0 | 1 | 2 }
 *   packIndex 0 = 50 min / $10
 *   packIndex 1 = 100 min / $15
 *   packIndex 2 = 200 min / $30
 *
 * Each pack maps to its own Stripe price ID (pack.stripePriceIdKey → STRIPE_IDS lookup).
 * Gated upstream by BillingCard — only callable when client has a provisioned twilio_number.
 *
 * Returns: { url: string } — redirect to Stripe Checkout
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { MINUTE_RELOAD_PACKS, STRIPE_IDS } from "@/lib/pricing";
import { APP_URL } from "@/lib/app-url";
import { verifyBillingAuth } from "@/lib/billing-auth";

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
  const { clientId, packIndex } = await req.json();

  const auth = await verifyBillingAuth(clientId);
  if (!auth.ok) return auth.response;

  if (packIndex === undefined || packIndex === null) {
    return NextResponse.json({ error: "Missing packIndex" }, { status: 400 });
  }

  const pack = MINUTE_RELOAD_PACKS[packIndex];
  if (!pack) {
    return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
  }

  const stripePriceId = STRIPE_IDS[pack.stripePriceIdKey];
  if (!stripePriceId || stripePriceId.startsWith("TODO_")) {
    return NextResponse.json(
      { error: `Stripe price for ${pack.minutes}-min pack not yet configured` },
      { status: 503 }
    );
  }

  const supa = createServiceClient();
  const { data: client } = await supa
    .from("clients")
    .select("stripe_customer_id, slug, contact_email, twilio_number")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Server-side enforcement: require a provisioned phone number before allowing reload purchase.
  // UI also gates this (BillingCard), but defense-in-depth — never trust the client.
  if (!client.twilio_number) {
    return NextResponse.json(
      { error: "Phone number required. Provision a number before purchasing minutes." },
      { status: 403 }
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    customer: client.stripe_customer_id ?? undefined,
    customer_email: !client.stripe_customer_id ? (client.contact_email ?? undefined) : undefined,
    metadata: {
      type: "minute_reload",
      client_id: clientId,
      client_slug: client.slug,
      minutes: String(pack.minutes),
    },
    success_url: `${APP_URL}/dashboard/settings?minutes_purchased=${pack.minutes}`,
    cancel_url: `${APP_URL}/dashboard/settings?minutes_cancelled=true`,
  });

  return NextResponse.json({ url: session.url });
}
