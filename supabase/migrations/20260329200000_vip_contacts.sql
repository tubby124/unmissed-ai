-- VIP contacts + sms_logs direction extension
-- Applied 2026-03-29

-- 1. Extend sms_logs.direction CHECK to cover booking_confirmation (D60/D63) and owner_page (VIP)
ALTER TABLE sms_logs DROP CONSTRAINT IF EXISTS sms_logs_direction_check;
ALTER TABLE sms_logs ADD CONSTRAINT sms_logs_direction_check
  CHECK (direction IN ('inbound', 'outbound', 'booking_confirmation', 'owner_page'));

-- 2. VIP contacts — priority callers get name greeting + transfer offer + missed-call SMS to owner
CREATE TABLE IF NOT EXISTS client_vip_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text NOT NULL,
  relationship text,
  notes text,
  document_url text,
  transfer_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vip_contacts_client ON client_vip_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_vip_contacts_phone ON client_vip_contacts(phone);

ALTER TABLE client_vip_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_vip_contacts' AND policyname = 'client_users_all'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "client_users_all" ON client_vip_contacts
        FOR ALL TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM client_users cu
            WHERE cu.client_id = client_vip_contacts.client_id
              AND cu.user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM client_users cu
            WHERE cu.client_id = client_vip_contacts.client_id
              AND cu.user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;
