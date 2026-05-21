-- Bug #3 fix (2026-05-21): add display_name column to clients table.
--
-- Why: the agent greeting historically used `business_name` (often "X | Y | Z" from
-- Google Places) or `owner_name`'s first word (e.g., "Mohammad" instead of the
-- caller-friendly "Emon"). Operators need a single editable field that controls how
-- the agent refers to them at the front of the call without rearranging their
-- legal-name field. Surfaced during Mohammad Emon's manual-provision trace.
--
-- Default behavior:
--   * NULL → existing fallback chain (CLOSE_PERSON = first word of owner_name → business_name)
--   * non-null → used wherever {{DISPLAY_NAME}} appears in slot templates
--
-- Editable from the dashboard via PATCH /api/dashboard/settings — classified as
-- DB_PLUS_PROMPT in FIELD_REGISTRY so edits trigger prompt rebuild + Ultravox sync.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS display_name TEXT NULL;

COMMENT ON COLUMN public.clients.display_name IS
  'Caller-friendly display name (e.g., "Emon" or "Emon''s office"). Used in agent greeting. NULL → falls back to CLOSE_PERSON. Edited from dashboard Agent Identity card.';
