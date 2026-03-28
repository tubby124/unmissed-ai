-- Add client_services table for structured per-row service catalog.
-- Replaces the flat service_catalog JSONB blob on the clients table with
-- a proper relational model that supports per-row active/inactive,
-- ordering, and richer fields (description, category, booking_notes).
--
-- clients.service_catalog JSONB is kept as a legacy fallback.
-- agent-mode-rebuild.ts queries this table first; if empty, falls back to JSONB.

CREATE TABLE IF NOT EXISTS client_services (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name            text        NOT NULL CHECK (char_length(trim(name)) > 0),
  description     text        NOT NULL DEFAULT '',
  category        text        NOT NULL DEFAULT '',
  duration_mins   integer     CHECK (duration_mins IS NULL OR (duration_mins > 0 AND duration_mins <= 480)),
  price           text        NOT NULL DEFAULT '',
  booking_notes   text        NOT NULL DEFAULT '',
  active          boolean     NOT NULL DEFAULT true,
  sort_order      integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup: all active services for a client ordered by sort_order
CREATE INDEX IF NOT EXISTS idx_client_services_client_active
  ON client_services(client_id, active, sort_order);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE client_services ENABLE ROW LEVEL SECURITY;

-- Any authenticated user who belongs to the client can read services
CREATE POLICY "client_services_select"
  ON client_services FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
  );

-- Owners and admins can insert/update/delete their own client's services
CREATE POLICY "client_services_insert"
  ON client_services FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM client_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "client_services_update"
  ON client_services FOR UPDATE
  USING (
    client_id IN (
      SELECT client_id FROM client_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "client_services_delete"
  ON client_services FOR DELETE
  USING (
    client_id IN (
      SELECT client_id FROM client_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Service role bypasses all RLS (server-side agent-mode-rebuild, API routes)
CREATE POLICY "client_services_service_role"
  ON client_services FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
