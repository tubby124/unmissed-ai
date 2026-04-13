-- AI-generated niche config for businesses that fell to niche='other'
-- Stores the output of generateNicheConfig() at provision time
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS custom_niche_config jsonb;
