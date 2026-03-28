-- Add Google Business Profile snapshot columns to clients
-- These store the GBP data captured during onboarding for provenance display

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS gbp_place_id        text,
  ADD COLUMN IF NOT EXISTS gbp_summary         text,
  ADD COLUMN IF NOT EXISTS gbp_rating          numeric(3,1),
  ADD COLUMN IF NOT EXISTS gbp_review_count    integer,
  ADD COLUMN IF NOT EXISTS gbp_photo_url       text;
