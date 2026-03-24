/**
 * POST /api/billing/downgrade
 *
 * Schedules a plan downgrade at the end of the current billing period.
 * Uses Stripe subscription schedules to avoid immediate proration.
 *
 * Body: { clientId: string, targetPlanId: "lite" | "core" }
 * Returns: { success: true, effectiveDate: string }
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/pricing";
import { verifyBillingAuth } from "@/lib/billing-auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

export async function POST(req: NextRequest) {
  const { clientId, targetPlanId } = await req.json();

  const auth = await verifyBillingAuth(clientId);
  if (!auth.ok) return auth.response;

  const targetPlan = PLANS.find((p) => p.id === targetPlanId);
  if (!targetPlan) {
    return NextResponse.json({ error: "Invalid target plan" }, { status: 400 });
  }

  const supa = createServiceClient();
  const { data: client } = await supa
    .from("clients")
    .select("stripe_subscription_id, selected_plan, slug")
    .eq("id", clientId)
    .maybeSingle();

  if (!client?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
  }

  // Verify downgrade direction (target plan must be lower tier)
  const TIER_ORDER: Record<string, number> = { lite: 0, core: 1, pro: 2 };
  const currentTier = TIER_ORDER[client.selected_plan ?? "lite"] ?? 0;
  const targetTier = TIER_ORDER[targetPlanId] ?? 0;

  if (targetTier >= currentTier) {
    return NextResponse.json({ error: "Target plan must be a lower tier" }, { status: 400 });
  }

  // Idempotency: check if a schedule already exists for this subscription
  const sub = await stripe.subscriptions.retrieve(client.stripe_subscription_id);
  if (sub.schedule) {
    return NextResponse.json({ error: "A plan change is already scheduled" }, { status: 409 });
  }

  const subItem = sub.items.data[0];
  if (!subItem) {
    return NextResponse.json({ error: "No subscription item found" }, { status: 500 });
  }

  const newPriceId = targetPlan.stripeMonthlyPriceId;

  // Create subscription schedule from existing subscription, then add second phase
  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: client.stripe_subscription_id,
  });

  await stripe.subscriptionSchedules.update(schedule.id, {
    phases: [
      {
        items: [{ price: subItem.price.id, quantity: 1 }],
        start_date: schedule.phases[0]?.start_date,
        end_date: schedule.phases[0]?.end_date,
      },
      {
        items: [{ price: newPriceId, quantity: 1 }],
        start_date: schedule.phases[0]?.end_date,
      },
    ],
  });

  const effectiveDate = schedule.phases[0]?.end_date
    ? new Date(schedule.phases[0].end_date * 1000).toISOString()
    : null;

  console.log(`[billing/downgrade] Scheduled downgrade for ${client.slug}: ${client.selected_plan} → ${targetPlanId} on ${effectiveDate}`);

  return NextResponse.json({ success: true, effectiveDate });
}
