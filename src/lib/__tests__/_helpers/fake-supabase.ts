import type { routeTelegramMessage } from '@/lib/telegram/router'

export interface FakeRow {
  id: string
  slug: string
  business_name: string | null
  monthly_minute_limit: number | null
  bonus_minutes: number | null
  seconds_used_this_month: number | null
  business_facts?: string | null
  extra_qa?: unknown
}

export interface FakeCall {
  id: string
  client_id: string
  started_at: string | null
  caller_phone: string | null
  caller_name: string | null
  ai_summary: string | null
  call_status: string | null
  lead_status: string | null
  service_type: string | null
  duration_seconds: number | null
  next_steps: string | null
  callback_preference: string | null
  recording_url: string | null
  ultravox_call_id: string | null
}

export interface FakeAssistantLogRow {
  chat_id: number
  client_id: string
  model: string
  input_tokens: number
  output_tokens: number
  latency_ms: number
  outcome: 'ok' | 'timeout' | 'fallback' | 'error'
  created_at?: string
}

export interface FakeReplyAuditRow {
  client_id: string
  system_prompt_hash: string
  reply: string
  recent_calls_count: number
  citation_passed: boolean
  intent: string
}

export interface FakeState {
  clientByChatId: Map<number, FakeRow>
  calls: FakeCall[]
  seen: Set<number>
  callsQueriedFor: string[]
  assistantLog?: FakeAssistantLogRow[]
  replyAudit?: FakeReplyAuditRow[]
}

type SupaForRouter = Parameters<typeof routeTelegramMessage>[1]['supa']

/**
 * Test-only Supabase double. Mirrors the narrow surface the Telegram
 * router + assistant code touches: clients, call_logs, telegram_updates_seen,
 * and (optionally) telegram_assistant_log. Shared across Tier 1 + Tier 2 tests.
 */
export function makeFakeSupa(state: FakeState): SupaForRouter {
  return {
    from(table: string) {
      if (table === 'clients') {
        return {
          select() { return this },
          eq(_col: string, val: string) {
            this._chatId = Number(val); return this
          },
          limit() { return this },
          maybeSingle() {
            const row = state.clientByChatId.get(this._chatId) ?? null
            return Promise.resolve({ data: row })
          },
          _chatId: 0,
        }
      }
      if (table === 'call_logs') {
        const filters: Record<string, unknown> = {}
        return {
          select() { return this },
          eq(col: string, val: unknown) { filters[col] = val; return this },
          in() { return this },
          gte() { return this },
          or() { return this },
          order() { return this },
          limit() {
            const cid = filters.client_id as string | undefined
            if (cid) state.callsQueriedFor.push(cid)
            const matched = state.calls.filter((c) => c.client_id === cid)
            return Promise.resolve({ data: matched })
          },
        }
      }
      if (table === 'telegram_updates_seen') {
        return {
          insert(row: { update_id: number }) {
            if (state.seen.has(row.update_id)) {
              return Promise.resolve({ error: { code: '23505' } })
            }
            state.seen.add(row.update_id)
            return Promise.resolve({ error: null })
          },
        }
      }
      if (table === 'telegram_reply_audit') {
        return {
          insert(row: FakeReplyAuditRow) {
            if (!state.replyAudit) state.replyAudit = []
            state.replyAudit.push(row)
            return Promise.resolve({ error: null })
          },
        }
      }
      if (table === 'telegram_assistant_log') {
        // The select chain is used by fetchMtdSpendUsd (Tier 3 spend cap)
        // and renderHealth (operator p95 + error count). The chain ends
        // at gte() for the spend path; the helper returns rows filtered
        // by the captured client_id. Other filters are accepted as no-ops.
        const filters: Record<string, unknown> = {}
        return {
          select() { return this },
          eq(col: string, val: unknown) { filters[col] = val; return this },
          in() { return this },
          order() { return this },
          gte() {
            const cid = filters.client_id as string | undefined
            const log = state.assistantLog ?? []
            const matched = cid ? log.filter((r) => r.client_id === cid) : log
            return Promise.resolve({ data: matched, error: null })
          },
          insert(row: FakeAssistantLogRow) {
            if (!state.assistantLog) state.assistantLog = []
            state.assistantLog.push(row)
            return Promise.resolve({ error: null })
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  } as unknown as SupaForRouter
}
