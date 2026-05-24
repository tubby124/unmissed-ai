-- Harden outbound_templates for already-applied environments.
-- The original 20260523000000 migration may already exist in production, so keep
-- this idempotent follow-up to make tenant boundaries explicit everywhere.

ALTER TABLE IF EXISTS outbound_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbound_templates_select_own_or_builtin ON outbound_templates;
CREATE POLICY outbound_templates_select_own_or_builtin
  ON outbound_templates
  FOR SELECT
  TO authenticated
  USING (
    is_builtin
    OR EXISTS (
      SELECT 1
      FROM client_users
      WHERE client_users.user_id = auth.uid()
        AND (
          client_users.role = 'admin'
          OR client_users.client_id = outbound_templates.client_id
        )
    )
  );

DROP POLICY IF EXISTS outbound_templates_insert_own_or_admin ON outbound_templates;
CREATE POLICY outbound_templates_insert_own_or_admin
  ON outbound_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_builtin = false
    AND EXISTS (
      SELECT 1
      FROM client_users
      WHERE client_users.user_id = auth.uid()
        AND (
          client_users.role = 'admin'
          OR client_users.client_id = outbound_templates.client_id
        )
    )
  );

DROP POLICY IF EXISTS outbound_templates_update_own_or_admin ON outbound_templates;
CREATE POLICY outbound_templates_update_own_or_admin
  ON outbound_templates
  FOR UPDATE
  TO authenticated
  USING (
    is_builtin = false
    AND EXISTS (
      SELECT 1
      FROM client_users
      WHERE client_users.user_id = auth.uid()
        AND (
          client_users.role = 'admin'
          OR client_users.client_id = outbound_templates.client_id
        )
    )
  )
  WITH CHECK (
    is_builtin = false
    AND EXISTS (
      SELECT 1
      FROM client_users
      WHERE client_users.user_id = auth.uid()
        AND (
          client_users.role = 'admin'
          OR client_users.client_id = outbound_templates.client_id
        )
    )
  );

DROP POLICY IF EXISTS outbound_templates_delete_own_or_admin ON outbound_templates;
CREATE POLICY outbound_templates_delete_own_or_admin
  ON outbound_templates
  FOR DELETE
  TO authenticated
  USING (
    is_builtin = false
    AND EXISTS (
      SELECT 1
      FROM client_users
      WHERE client_users.user_id = auth.uid()
        AND (
          client_users.role = 'admin'
          OR client_users.client_id = outbound_templates.client_id
        )
    )
  );
