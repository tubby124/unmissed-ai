-- G0.5: Sync truth instrumentation
-- Makes DB truth vs deployed runtime truth observable.
-- These columns are written by updateAgent() after every Ultravox PATCH.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS last_agent_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_agent_sync_status text CHECK (last_agent_sync_status IN ('success', 'error')),
  ADD COLUMN IF NOT EXISTS last_agent_sync_error text;

COMMENT ON COLUMN clients.last_agent_sync_at IS 'Timestamp of last updateAgent() call to Ultravox API';
COMMENT ON COLUMN clients.last_agent_sync_status IS 'Result of last agent sync: success or error';
COMMENT ON COLUMN clients.last_agent_sync_error IS 'Error message if last sync failed (null on success)';
