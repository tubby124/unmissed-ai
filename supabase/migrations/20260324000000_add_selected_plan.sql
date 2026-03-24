-- Add selected_plan column to clients table
-- Stores which pricing tier the client selected (lite | core | pro)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS selected_plan text;
