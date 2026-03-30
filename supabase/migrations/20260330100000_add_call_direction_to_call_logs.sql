-- Add call_direction to call_logs for inbound vs outbound filtering (D101)
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS call_direction text
  CHECK (call_direction IN ('inbound', 'outbound'))
  DEFAULT 'inbound';

CREATE INDEX IF NOT EXISTS idx_call_logs_call_direction
  ON call_logs(call_direction);

COMMENT ON COLUMN call_logs.call_direction IS
  'inbound = PSTN/demo inbound, outbound = dial-out or scheduled callback';
