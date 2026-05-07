-- Add service_areas to clients table.
--
-- Purpose: per-client list of cities the business serves. Consumed at call time
-- by buildAgentContext() to inject a KNOWN VOCABULARY block (neighborhood names
-- from src/data/anchor-terms-canada.json) into the businessFacts templateContext.
-- Soft-biases Ultravox/Llama ASR toward correct decoding of local proper nouns.
--
-- Mutation class: PER_CALL_CONTEXT_ONLY
-- - No agent redeploy required when this changes (businessFacts is per-call inject)
-- - Effective on the very next inbound call after the value is set
--
-- Trigger event: 2026-05-07 — Eric (Brian's agent) misheard "Nolan Hill" as
-- "Lorn Hill" three turns running on Fred DeSilva's call. Vocabulary anchor
-- pack added at src/data/anchor-terms-canada.json (Calgary, Edmonton, Saskatoon,
-- Airdrie, Cochrane, Chestermere, Okotoks).

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS service_areas text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN clients.service_areas IS
  'Cities the client services, used to scope KNOWN VOCABULARY anchor injection at call time. Match against keys in src/data/anchor-terms-canada.json. Example: ARRAY[''Calgary'',''Edmonton''].';
