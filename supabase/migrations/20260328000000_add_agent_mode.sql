-- Phase 1: Add agent_mode to clients table
-- Internal conversational behavior profile — separate from call_handling_mode (customer-facing product mode).
-- All existing rows default to 'lead_capture', which maps to the current 'triage' call_handling_mode behavior.
-- No prompt or runtime behavior change in this phase.
ALTER TABLE clients
  ADD COLUMN agent_mode text NOT NULL DEFAULT 'lead_capture'
  CONSTRAINT clients_agent_mode_check
    CHECK (agent_mode IN ('voicemail_replacement', 'lead_capture', 'info_hub', 'appointment_booking'));
