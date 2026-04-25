-- Fix maintenance_requests RLS — replace broken `client_id = auth.uid()` policy
-- with proper client_users join so dashboard inbox can read rows for the right client.
-- Voice-agent webhook continues to use service_role and bypasses RLS.

DROP POLICY IF EXISTS "clients own their requests" ON maintenance_requests;

CREATE POLICY "users see their client's maintenance requests"
  ON maintenance_requests FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users insert their client's maintenance requests"
  ON maintenance_requests FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users update their client's maintenance requests"
  ON maintenance_requests FOR UPDATE
  USING (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "service_role bypass maintenance_requests"
  ON maintenance_requests FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
