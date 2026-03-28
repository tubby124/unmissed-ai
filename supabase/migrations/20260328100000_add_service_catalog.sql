-- Add service_catalog to clients for structured appointment_booking service lists.
-- Stores an ordered array of bookable services: [{name, duration_mins?, price?}]
-- Used by prompt-builder.ts when agent_mode = 'appointment_booking' to generate
-- a richer SERVICES_OFFERED block and a catalog-aware TRIAGE_DEEP instruction.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS service_catalog jsonb NOT NULL DEFAULT '[]'::jsonb;
