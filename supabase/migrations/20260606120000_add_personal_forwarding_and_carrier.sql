-- Wave 3 Layer C: dual-mode awareness (personal forwarding + carrier capture)
--
-- is_forwarding_personal_cell drives the prompt-slots universal PERSONAL flow.
--   true (default)  → caller could be family/friend/delivery; agent takes warm
--                     messages, never accuses of wrong-number unless explicit.
--                     This is the safer default (misclassifying business-only
--                     as dual is harmless; the reverse drops real family calls).
--   false           → business line only; off-topic callers get the gentle
--                     wrong-number exit and ANYTHING ELSE funnels into niche
--                     intake collection.
--
-- carrier_id is captured during onboarding so the dashboard MobileSetup card
-- can pre-select the right CARRIER_PROFILES entry and show the correct
-- conditional-CF codes (*61 / *67 / *62) + carrier-specific support number.
-- Free-form text instead of an enum so adding a new carrier in carrier-compat.ts
-- doesn't require a fresh migration.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_forwarding_personal_cell boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS carrier_id text NULL;

COMMENT ON COLUMN clients.is_forwarding_personal_cell IS
  'When true, prompt includes universal PERSONAL/OFF-TOPIC MESSAGE FLOW trunk (Wave 3 Layer A). When false, off-topic callers route to niche intake. Default true.';

COMMENT ON COLUMN clients.carrier_id IS
  'Owner''s mobile carrier id, matches CarrierId union in src/types/carrier-compat.ts. NULL until owner answers the onboarding carrier question.';
