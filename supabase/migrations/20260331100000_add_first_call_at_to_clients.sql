-- D168: first_call_at — timestamp of the first real inbound call received by this client.
-- Set once by the completed webhook when the first non-test, non-JUNK call completes.
-- Used to display the 🎉 "first call" milestone banner on the dashboard.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_call_at TIMESTAMPTZ;
