-- Migration: add conflicts JSONB column to compiler_runs
-- Stores conflict_flag items from AI Compiler sessions so they can be reviewed later.
-- Each item: { content: string, review_reason: string }

ALTER TABLE compiler_runs
  ADD COLUMN IF NOT EXISTS conflicts        JSONB        NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS conflicts_dismissed BOOLEAN  NOT NULL DEFAULT false;
