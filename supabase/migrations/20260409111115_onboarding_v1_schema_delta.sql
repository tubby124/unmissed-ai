-- Phase E Wave 1 — Onboarding v1 schema delta (2026-04-09)
--
-- Adds the 6 Layer-1 / D408 / free-form fields from the field-schema doc
-- (`knowledge/concepts/unmissed-onboarding-field-schema.md`) plus a `hand_tuned`
-- safety flag (D.5 debt item H) that prevents `regenerate-prompt` from clobbering
-- the founding-4 hand-tuned prompts.
--
-- All columns are nullable text/bool, so this migration is non-destructive and
-- backwards compatible with every existing clients row. CHECK constraints restrict
-- allowed values for the enum-like columns; length constraints protect the
-- free-form columns from prompt-injection bloat.
--
-- After apply:
--   npm run db:types   -- regenerate src/lib/database.types.ts
--   npm run test:all   -- must still be 1594/1594 green

ALTER TABLE clients ADD COLUMN IF NOT EXISTS today_update text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_notes text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS unknown_answer_behavior text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pricing_policy text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS calendar_mode text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS fields_to_collect text[] DEFAULT ARRAY[]::text[];
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hand_tuned boolean DEFAULT false;

-- Enum-like value checks. NULL is always allowed (pre-existing rows default to NULL).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_unknown_answer_behavior_valid') THEN
    ALTER TABLE clients ADD CONSTRAINT clients_unknown_answer_behavior_valid
      CHECK (unknown_answer_behavior IS NULL OR unknown_answer_behavior IN
        ('take_message','transfer','find_out_callback'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_pricing_policy_valid') THEN
    ALTER TABLE clients ADD CONSTRAINT clients_pricing_policy_valid
      CHECK (pricing_policy IS NULL OR pricing_policy IN
        ('quote_range','no_quote_callback','website_pricing','collect_first'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_calendar_mode_valid') THEN
    ALTER TABLE clients ADD CONSTRAINT clients_calendar_mode_valid
      CHECK (calendar_mode IS NULL OR calendar_mode IN
        ('none','request_callback','book_direct'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_today_update_length') THEN
    ALTER TABLE clients ADD CONSTRAINT clients_today_update_length
      CHECK (today_update IS NULL OR char_length(today_update) <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_business_notes_length') THEN
    ALTER TABLE clients ADD CONSTRAINT clients_business_notes_length
      CHECK (business_notes IS NULL OR char_length(business_notes) <= 3000);
  END IF;
END $$;

COMMENT ON COLUMN clients.today_update IS
  'Owner-set daily context, 200 chars max. Injected as position-0 primacy slot.';
COMMENT ON COLUMN clients.business_notes IS
  'Free-form business description, 3000 chars max. Injected after IDENTITY slot.';
COMMENT ON COLUMN clients.unknown_answer_behavior IS
  'D408 chip: how agent responds to questions it cannot answer. take_message | transfer | find_out_callback';
COMMENT ON COLUMN clients.pricing_policy IS
  'D408 chip: how agent responds to price questions. quote_range | no_quote_callback | website_pricing | collect_first';
COMMENT ON COLUMN clients.calendar_mode IS
  'D408 chip: booking capability. none | request_callback | book_direct';
COMMENT ON COLUMN clients.fields_to_collect IS
  'Day-1 editable list of info fields the agent must collect per call.';
COMMENT ON COLUMN clients.hand_tuned IS
  'D.5 debt item H safety flag. When true, regenerate-prompt must NOT overwrite system_prompt — prevents accidental clobber of founding-4 hand-tuned prompts.';
