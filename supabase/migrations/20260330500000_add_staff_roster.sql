ALTER TABLE clients ADD COLUMN IF NOT EXISTS staff_roster JSONB DEFAULT '[]'::jsonb;
