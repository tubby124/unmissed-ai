-- SMS logging and opt-out tracking for TCPA/CRTC compliance

CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) NOT NULL,
  message_sid TEXT UNIQUE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT,
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'sent', 'delivered', 'failed', 'undelivered', 'opted_out')),
  opt_out BOOLEAN DEFAULT FALSE,
  delivery_status TEXT,
  delivery_error_code TEXT,
  related_call_id UUID REFERENCES call_logs(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_logs_message_sid ON sms_logs(message_sid);
CREATE INDEX idx_sms_logs_client_id ON sms_logs(client_id, created_at DESC);
CREATE INDEX idx_sms_logs_opt_out ON sms_logs(from_number, opt_out) WHERE opt_out = TRUE;

CREATE TABLE IF NOT EXISTS sms_opt_outs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) NOT NULL,
  opted_out_at TIMESTAMPTZ DEFAULT NOW(),
  opted_back_in_at TIMESTAMPTZ,
  reason TEXT DEFAULT 'STOP',
  UNIQUE(phone_number, client_id)
);
