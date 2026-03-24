-- Phase 6: Billing management columns
-- cancel_at: when the subscription is scheduled to cancel (null = not cancelling)
-- Used by customer.subscription.updated webhook to track cancel_at_period_end state.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cancel_at timestamptz DEFAULT NULL;
