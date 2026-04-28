-- Add login_emails to clients for manual provisioning where the client's
-- actual Google login email differs from contact_email (the provisioning email).
-- Middleware auto-link reads this array in addition to contact_email.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS login_emails text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS clients_login_emails_gin_idx
  ON clients USING GIN (login_emails);
