-- D292 — forwarding verification tests
-- User clicks "Test forwarding" in WelcomeWizard → server dials their callback_phone
-- from TWILIO_FROM_NUMBER. If their carrier forwards the unanswered call to the
-- agent's Twilio number, the inbound webhook detects From === TWILIO_FROM_NUMBER
-- and marks the test row 'forwarded'. Otherwise the row times out to 'timeout'.

CREATE TABLE IF NOT EXISTS forwarding_verify_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  callback_phone TEXT NOT NULL,
  from_number TEXT NOT NULL,
  outbound_twilio_sid TEXT,
  inbound_twilio_sid TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'forwarded', 'timeout', 'failed')),
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Fast lookup for inbound correlation: most recent pending test per client
CREATE INDEX idx_forwarding_verify_tests_pending
  ON forwarding_verify_tests(client_id, started_at DESC)
  WHERE status = 'pending';

-- Per-client history lookup for audit / polling
CREATE INDEX idx_forwarding_verify_tests_client
  ON forwarding_verify_tests(client_id, started_at DESC);
