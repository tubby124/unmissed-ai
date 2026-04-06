-- Track expiry for injected_note (Today's Update) so stale notes don't persist indefinitely.
-- Default NULL = no expiry (preserves existing behavior for notes saved before this migration).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS injected_note_expires_at TIMESTAMPTZ DEFAULT NULL;
