-- Churn flow: 'release_twilio_number' pending action.
--
-- When a subscription cancels (customer.subscription.deleted), the operator
-- gets a Telegram prompt asking whether to release the client's Twilio
-- number back to inventory. The confirm token lives in
-- telegram_pending_actions like the Tier 3 lead actions, but with a long
-- TTL (72h — churn decisions aren't made in 60 seconds).
--
-- This migration only widens the action_kind CHECK constraint.

ALTER TABLE public.telegram_pending_actions
  DROP CONSTRAINT IF EXISTS telegram_pending_actions_action_kind_check;

ALTER TABLE public.telegram_pending_actions
  ADD CONSTRAINT telegram_pending_actions_action_kind_check
  CHECK (action_kind IN ('mark_called_back', 'call_back_lead', 'release_twilio_number'));
