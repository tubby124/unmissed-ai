-- Phase 0a: Add missing columns so onboarding data flows to settings dashboard
-- These fields are collected during onboarding but were only stored in intake_json blob
ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS services_offered text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS callback_phone text;
