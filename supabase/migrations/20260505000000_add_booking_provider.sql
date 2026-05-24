-- D-NEW-gettimely-booking-integration — Phase 1A
-- Adds the booking_provider column + Gettimely auth columns.
-- Mutation class: DB_ONLY (no prompt impact, no agent sync — tool URLs are unchanged).
-- Backfills booking_provider='google' for clients that have an existing Google Calendar
-- connection so behavior is byte-identical for the 4 deployed clients (no redeploy needed).

-- ── 1. Provider enum ──────────────────────────────────────────────────────────
-- text + check constraint (not a Postgres enum) so adding Vagaro/Acuity later is a
-- one-line migration instead of an ALTER TYPE dance.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS booking_provider text NOT NULL DEFAULT 'google'
    CHECK (booking_provider IN ('google', 'gettimely'));

COMMENT ON COLUMN public.clients.booking_provider IS
  'Which booking system the agent uses. Drives /api/calendar/[slug]/{slots,book} dispatch. Default google preserves pre-D-NEW behavior.';

-- ── 2. Gettimely OAuth + mapping fields ───────────────────────────────────────

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS gettimely_account_id text,
  ADD COLUMN IF NOT EXISTS gettimely_refresh_token text,
  ADD COLUMN IF NOT EXISTS gettimely_staff_id text,
  ADD COLUMN IF NOT EXISTS gettimely_service_map jsonb;

COMMENT ON COLUMN public.clients.gettimely_account_id IS
  'Gettimely account/business ID returned from OAuth. Used as the tenant scope for API calls.';
COMMENT ON COLUMN public.clients.gettimely_refresh_token IS
  'Long-lived Gettimely OAuth refresh token. Access token is fetched per-call and not persisted.';
COMMENT ON COLUMN public.clients.gettimely_staff_id IS
  'The staff member whose calendar the agent books against. Selected during OAuth callback.';
COMMENT ON COLUMN public.clients.gettimely_service_map IS
  'Map of unmissed service_catalog item names → Gettimely service IDs. Format: { "haircut": 12345, "beard trim": 12346 }.';

-- ── 3. Backfill existing connected clients ────────────────────────────────────
-- Existing 4 deployed clients (hasan-sharif, exp-realty, windshield-hub, urban-vibe) all
-- have google_refresh_token set + calendar_auth_status='connected'. The DEFAULT 'google'
-- already covers them, but we make it explicit + idempotent.

UPDATE public.clients
SET booking_provider = 'google'
WHERE booking_provider IS DISTINCT FROM 'google'
  AND google_refresh_token IS NOT NULL;

-- ── 4. Index on provider for admin Integrations page filtering ────────────────
CREATE INDEX IF NOT EXISTS idx_clients_booking_provider ON public.clients(booking_provider);
