-- Advisor Feature — 4 tables + indexes + RLS + 2 RPCs + auto-credit trigger
-- Applied via: mcp__supabase__apply_migration

-- ── 1. Credits balance per user ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_chat_credits (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents INTEGER NOT NULL DEFAULT 100,   -- $1.00 free on signup
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_chat_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own credits"
  ON ai_chat_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages credits"
  ON ai_chat_credits FOR ALL
  USING (auth.role() = 'service_role');

-- ── 2. Conversations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'New conversation',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  model       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id, created_at DESC);
CREATE INDEX idx_ai_conversations_archived ON ai_conversations(user_id, is_archived);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own conversations"
  ON ai_conversations FOR ALL
  USING (auth.uid() = user_id);

-- ── 3. Messages ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  model           TEXT,
  tokens_used     INTEGER DEFAULT 0,
  cost_cents      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_messages_conv ON ai_messages(conversation_id, created_at);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own messages"
  ON ai_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages messages"
  ON ai_messages FOR ALL
  USING (auth.role() = 'service_role');

-- ── 4. Transaction log (topups, deductions) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('topup', 'deduction', 'free_grant')),
  amount_cents      INTEGER NOT NULL,
  stripe_session_id TEXT,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_transactions_user ON ai_transactions(user_id, created_at DESC);

ALTER TABLE ai_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own transactions"
  ON ai_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages transactions"
  ON ai_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- ── RPCs ──────────────────────────────────────────────────────────────────────

-- Add credits (topup). Preserves unlimited (-1) accounts.
CREATE OR REPLACE FUNCTION add_advisor_credits(p_user_id UUID, p_amount_cents INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO ai_chat_credits (user_id, balance_cents)
  VALUES (p_user_id, p_amount_cents)
  ON CONFLICT (user_id) DO UPDATE
  SET balance_cents = CASE
    WHEN ai_chat_credits.balance_cents = -1 THEN -1
    ELSE ai_chat_credits.balance_cents + p_amount_cents
  END,
  updated_at = now();
END;
$$;

-- Deduct credits. Returns TRUE if deduction succeeded.
-- Unlimited (-1) always succeeds without changing balance.
-- Free models (cost=0) always succeed.
CREATE OR REPLACE FUNCTION deduct_advisor_credits(p_user_id UUID, p_amount_cents INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF p_amount_cents <= 0 THEN RETURN TRUE; END IF;

  SELECT balance_cents INTO v_balance
  FROM ai_chat_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_balance = -1 THEN RETURN TRUE; END IF;
  IF v_balance < p_amount_cents THEN RETURN FALSE; END IF;

  UPDATE ai_chat_credits
  SET balance_cents = balance_cents - p_amount_cents,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- ── Auto-create credits row on user signup ────────────────────────────────────
CREATE OR REPLACE FUNCTION create_advisor_credits()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO ai_chat_credits (user_id, balance_cents)
  VALUES (NEW.id, 100)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_advisor_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_advisor_credits();
