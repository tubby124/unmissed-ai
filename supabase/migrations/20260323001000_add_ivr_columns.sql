-- IVR (Interactive Voice Response) pre-filter columns
-- Allows per-client voicemail menu before connecting to AI agent.
-- Use case: clients whose callers are voicemail-trained (hang up waiting for a beep).
-- When ivr_enabled = true: caller hears "Press 1 for voicemail, stay on for assistant"
-- ivr_prompt: custom message text (falls back to auto-generated from business_name)

ALTER TABLE clients ADD COLUMN IF NOT EXISTS ivr_enabled boolean DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ivr_prompt text;
