-- Add trial_reminder_sent column to track which reminder emails have fired
-- Prevents the daily cron from double-sending Day-3 and Day-1 reminder emails
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS trial_reminder_sent jsonb DEFAULT '{}';
