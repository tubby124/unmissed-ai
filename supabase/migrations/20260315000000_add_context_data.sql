-- Add context_data and context_data_label columns for per-call data injection
-- context_data: raw text/CSV that gets injected into every call via {{contextData}} templateContext
-- context_data_label: human-readable label shown in dashboard ("Tenant List", "Menu", etc.)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS context_data TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS context_data_label TEXT;
