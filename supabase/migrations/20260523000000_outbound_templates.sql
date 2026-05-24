-- Migration: outbound_templates
-- Description: Create outbound_templates table, add outbound/inbound columns to clients, seed built-in templates for hasan-sharif

-- 1. Create outbound_templates table
CREATE TABLE IF NOT EXISTS outbound_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  tone            text NOT NULL DEFAULT 'warm' CHECK (tone IN ('warm','professional','direct','flirty','busty','custom')),
  goal            text NOT NULL,
  opening         text,
  vm_script       text,
  call_notes      text,
  special_instructions text,
  is_builtin      boolean NOT NULL DEFAULT false,
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_templates_client ON outbound_templates(client_id);

ALTER TABLE outbound_templates ENABLE ROW LEVEL SECURITY;

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

-- 2. Add columns to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS outbound_allowed_start            time,
  ADD COLUMN IF NOT EXISTS outbound_allowed_end              time,
  ADD COLUMN IF NOT EXISTS outbound_allowed_days             int[] DEFAULT '{1,2,3,4,5,6,7}',
  ADD COLUMN IF NOT EXISTS outbound_consent_acknowledged_at  timestamptz,
  ADD COLUMN IF NOT EXISTS inbound_personality               text,
  ADD COLUMN IF NOT EXISTS inbound_personality_enabled       boolean NOT NULL DEFAULT false;

-- 3. Seed built-in templates for hasan-sharif client
INSERT INTO outbound_templates (client_id, name, description, tone, goal, opening, vm_script, call_notes, special_instructions, is_builtin, is_default)
VALUES
  (
    '34eb9b6c-852c-4e9e-9239-2e6488736769',
    'Professional',
    'A polished, professional outreach template suitable for formal business communication.',
    'professional',
    'Follow up and schedule a conversation',
    'Hi, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. I''m trying to reach {{LEAD_NAME}} — do you have a quick minute?',
    'Hi {{LEAD_NAME}}, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. Just reaching out to connect — give us a call back when you get a chance. Thanks!',
    NULL,
    NULL,
    true,
    true
  ),
  (
    '34eb9b6c-852c-4e9e-9239-2e6488736769',
    'Busty Bodacious',
    'A bold, playful template designed to grab attention and build instant rapport.',
    'flirty',
    'Build rapport and have a fun conversation',
    'Yoo — guess who. It''s me, your favourite {{AGENT_NAME}}. Don''t act surprised. What are you wearing right now? Actually don''t answer that, I''m kidding. Kinda.',
    'Hey! It''s {{AGENT_NAME}} — you know, your favourite assistant. I was gonna tell you something good but you missed me. Call me back when you''re not being busy being mysterious. Byeeeee ~',
    NULL,
    NULL,
    true,
    false
  ),
  (
    '34eb9b6c-852c-4e9e-9239-2e6488736769',
    'Flirty',
    'A chemistry-building template that adds a playful, flirty tone to outreach.',
    'flirty',
    'Connect and build chemistry',
    'Hey {{LEAD_NAME}}! It''s {{AGENT_NAME}} — {{BUSINESS_NAME}}''s... well, let''s just say I''m the favourite assistant. He told me to call you and say hi. So... hi. You''re cute. Is that weird to say? Too bad. 😏',
    'Hey {{LEAD_NAME}}, it''s {{AGENT_NAME}} — {{BUSINESS_NAME}}''s assistant. I was gonna say something nice but you sent me to voicemail like a coward. Call me back when you grow a pair. Byee. 😘',
    NULL,
    NULL,
    true,
    false
  ),
  (
    '34eb9b6c-852c-4e9e-9239-2e6488736769',
    'Direct',
    'A no-nonsense template focused on quick qualification and appointment booking.',
    'direct',
    'Qualify lead and book appointment',
    'Hi {{LEAD_NAME}}, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. I''m calling about your recent inquiry — do you have 2 minutes?',
    'Hi {{LEAD_NAME}}, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. Please call us back at your earliest convenience. Thank you.',
    NULL,
    NULL,
    true,
    false
  )
ON CONFLICT (id) DO NOTHING;
