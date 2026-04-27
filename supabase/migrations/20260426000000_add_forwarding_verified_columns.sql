-- Go Live Tab — Section 4 Call Forwarding verification.
-- Adds two status columns to clients used by:
--   POST /api/dashboard/forwarding-verify (Twilio outbound dials Twilio number to test carrier forward chain)
--   POST /api/dashboard/forwarding-verify/self-attest ("I already did this" link)
--   GoLiveProgress 4-condition check
--
-- Classification per docs/architecture/control-plane-mutation-contract.md: DB_ONLY.
-- Pure status fields. No prompt impact, no tool impact, no agent sync.
--
-- Rollback:
--   ALTER TABLE clients DROP COLUMN IF EXISTS forwarding_verified_at;
--   ALTER TABLE clients DROP COLUMN IF EXISTS forwarding_self_attested;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS forwarding_verified_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS forwarding_self_attested BOOLEAN NOT NULL DEFAULT FALSE;
