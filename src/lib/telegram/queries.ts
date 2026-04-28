import type { SupabaseClient } from '@supabase/supabase-js'

export interface TelegramClientRow {
  id: string
  slug: string
  business_name: string | null
  monthly_minute_limit: number | null
  bonus_minutes: number | null
  seconds_used_this_month: number | null
}

export interface CallRow {
  id: string
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

const CALL_COLS =
  'id, started_at, caller_phone, caller_name, ai_summary, call_status, lead_status, service_type, duration_seconds, next_steps, callback_preference, recording_url, ultravox_call_id'

export async function fetchClientByChatId(
  supa: SupabaseClient,
  chatId: number
): Promise<TelegramClientRow | null> {
  const { data } = await supa
    .from('clients')
    .select('id, slug, business_name, monthly_minute_limit, bonus_minutes, seconds_used_this_month')
    .eq('telegram_chat_id', String(chatId))
    .limit(1)
    .maybeSingle()
  return (data as TelegramClientRow | null) ?? null
}

export async function fetchLastNCalls(
  supa: SupabaseClient,
  clientId: string,
  n: number
): Promise<CallRow[]> {
  const { data } = await supa
    .from('call_logs')
    .select(CALL_COLS)
    .eq('client_id', clientId)
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(n)
  return (data as CallRow[] | null) ?? []
}

export async function fetchTodayCalls(
  supa: SupabaseClient,
  clientId: string,
  timezone: string
): Promise<CallRow[]> {
  const now = new Date()
  const localDate = now.toLocaleDateString('en-CA', { timeZone: timezone })
  const startUtc = new Date(`${localDate}T00:00:00`).toISOString()
  const { data } = await supa
    .from('call_logs')
    .select(CALL_COLS)
    .eq('client_id', clientId)
    .gte('started_at', startUtc)
    .order('started_at', { ascending: false })
    .limit(20)
  return (data as CallRow[] | null) ?? []
}

export async function fetchMissedCalls(
  supa: SupabaseClient,
  clientId: string
): Promise<CallRow[]> {
  const { data } = await supa
    .from('call_logs')
    .select(CALL_COLS)
    .eq('client_id', clientId)
    .in('call_status', ['HOT', 'WARM', 'MISSED'])
    .or('lead_status.is.null,lead_status.eq.new')
    .order('started_at', { ascending: false })
    .limit(10)
  return (data as CallRow[] | null) ?? []
}

export async function recordUpdateSeen(
  supa: SupabaseClient,
  updateId: number,
  chatId: number
): Promise<{ alreadySeen: boolean }> {
  const { error } = await supa
    .from('telegram_updates_seen')
    .insert({ update_id: updateId, chat_id: chatId })
  if (error && error.code === '23505') return { alreadySeen: true }
  return { alreadySeen: false }
}
