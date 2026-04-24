'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import type { CallLog } from '@/components/dashboard/CallRow'

interface UseCallLogResult {
  calls: CallLog[]
  loading: boolean
  error: string | null
  refetch: () => void
}

const SELECT_COLUMNS = 'id, ultravox_call_id, caller_phone, call_status, call_direction, ai_summary, service_type, duration_seconds, started_at, client_id, confidence, sentiment, key_topics, next_steps, quality_score, transfer_status, sms_outcome, callback_preference, clients(business_name)'

/**
 * Shared call-log hook — single source of truth for call rows rendered on
 * the Overview surface and anywhere else that reuses <CallRow />.
 *
 * Design: one-shot SELECT scoped to the client, then a realtime subscription
 * that keeps the list fresh. No polling — callers that need polling parity
 * with /dashboard/calls should continue to use CallsList directly.
 */
export function useCallLog(clientId: string | null, limit?: number): UseCallLogResult {
  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createBrowserClient()

  const fetchCalls = useCallback(async () => {
    if (!clientId) {
      setCalls([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const supabase = supabaseRef.current!
    let q = supabase
      .from('call_logs')
      .select(SELECT_COLUMNS)
      .eq('client_id', clientId)
      .order('started_at', { ascending: false })
    if (typeof limit === 'number' && limit > 0) q = q.limit(limit)
    const { data, error: err } = await q
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    const rows = (data ?? []).map(r => ({
      ...r,
      business_name: (r.clients as { business_name?: string } | null)?.business_name ?? null,
    })) as CallLog[]
    setCalls(rows)
    setLoading(false)
  }, [clientId, limit])

  useEffect(() => { fetchCalls() }, [fetchCalls])

  useEffect(() => {
    if (!clientId) return
    const supabase = supabaseRef.current!
    const channel = supabase
      .channel(`use-call-log-${clientId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'call_logs', filter: `client_id=eq.${clientId}`,
      }, () => { fetchCalls() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [clientId, fetchCalls])

  return { calls, loading, error, refetch: fetchCalls }
}
