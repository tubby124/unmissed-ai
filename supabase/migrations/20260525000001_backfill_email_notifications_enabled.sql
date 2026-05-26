-- Backfill email_notifications_enabled to false for clients with NULL flag
-- Mirrors the production hotfix applied via MCP on 2026-05-25 so staging /
-- DR-restore environments don't start sending surprise per-call emails after
-- the Task 4 gate flip (=== true -> !== false in shouldSendPerCallEmail).
--
-- Idempotent: WHERE email_notifications_enabled IS NULL means re-running
-- this on an already-backfilled DB updates zero rows.
--
-- Excludes voicemail and message_only modes (they don't use per-call email).

UPDATE clients
SET email_notifications_enabled = false
WHERE email_notifications_enabled IS NULL
  AND niche != 'voicemail'
  AND call_handling_mode != 'message_only';
