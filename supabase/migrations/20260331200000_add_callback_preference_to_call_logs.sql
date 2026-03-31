-- D193: callback_preference — stores caller's preferred callback time (e.g., 'morning', 'afternoon', 'evening', specific time)
-- Set by the voice agent when caller states a preference. Surfaced in Telegram alerts and calls list.
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS callback_preference TEXT;
