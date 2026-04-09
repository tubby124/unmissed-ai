-- Phase H — force_overrode_hand_tuned audit column on prompt_versions
--
-- Context: Phase E Wave 7 added a 409-gate in /api/dashboard/regenerate-prompt
-- that blocks overwrites of hand_tuned clients unless the caller passes
-- { force: true }. When an admin does force-override, we need a durable audit
-- trail so Hasan can spot it later ("who force-clobbered the founding-4?").
--
-- Additive column, defaults to false, nullable-safe for existing rows.
-- No index — low cardinality, only queried when auditing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'prompt_versions'
      AND column_name = 'force_overrode_hand_tuned'
  ) THEN
    ALTER TABLE public.prompt_versions
      ADD COLUMN force_overrode_hand_tuned boolean NOT NULL DEFAULT false;

    COMMENT ON COLUMN public.prompt_versions.force_overrode_hand_tuned IS
      'True when this version was written via /api/dashboard/regenerate-prompt { force: true } against a client with hand_tuned = true. Used for audit review of admin overrides of protected prompts.';
  END IF;
END $$;
