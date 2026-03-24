/**
 * GET /api/billing/invoices?clientId=xxx
 *
 * Returns recent Stripe invoices for a client.
 * Requires the client to have a stripe_customer_id.
 *
 * Returns: { invoices: Array<{ id, date, amount, currency, status, pdfUrl, description }> }
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyBillingAuth } from "@/lib/billing-auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");

  const auth = await verifyBillingAuth(clientId ?? "");
  if (!auth.ok) return auth.response;

  const supa = createServiceClient();
  const { data: client } = await supa
    .from("clients")
    .select("stripe_customer_id")
    .eq("id", clientId!)
    .maybeSingle();

  if (!client?.stripe_customer_id) {
    return NextResponse.json({ invoices: [] });
  }

  const invoices = await stripe.invoices.list({
    customer: client.stripe_customer_id,
    limit: 12,
  });

  const mapped = invoices.data.map((inv) => ({
    id: inv.id,
    date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
    amount: inv.amount_due != null ? inv.amount_due / 100 : 0,
    currency: inv.currency?.toUpperCase() ?? "CAD",
    status: inv.status,
    pdfUrl: inv.invoice_pdf ?? null,
    description:
      inv.lines?.data?.[0]?.description ?? inv.description ?? "Subscription",
  }));

  return NextResponse.json({ invoices: mapped });
}
