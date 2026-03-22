-- Add weekly_digest_enabled column to clients table
-- Defaults to true so existing clients receive digests unless they opt out
ALTER TABLE clients ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN DEFAULT true;
