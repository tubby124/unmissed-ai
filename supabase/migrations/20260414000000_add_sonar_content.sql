-- Migration: store Perplexity Sonar enrichment result on clients row
-- Previously fire-and-forget — now persisted so prompt rebuild can use it.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sonar_content text;
