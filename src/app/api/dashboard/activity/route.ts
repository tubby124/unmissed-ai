import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

interface CallRow {
  id: string
  caller_phone: string | null
  call_status: string | null
  created_at: string
  started_at: string
  end_reason: string | null
  duration_seconds: number | null
  client_id: string | null
  clients: { slug: string } | null
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')
  const period = searchParams.get('period') ?? '24h'

  const periodHours: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 }
  const hours = periodHours[period] ?? 24
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const svc = createServiceClient()

  try {
    let query = svc
      .from('call_logs')
      .select('id, caller_phone, call_status, created_at, started_at, end_reason, duration_seconds, client_id, clients(slug)')
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(1000)

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[activity] query error:', error.message)
      return NextResponse.json({
        summary: { total: 0, hot: 0, warm: 0, cold: 0, junk: 0, missed: 0, avgDuration: 0 },
        missedCalls: [],
        callbackQueue: [],
        stale: true,
      })
    }

    const rows = (data ?? []) as unknown as CallRow[]

    const completed = rows.filter(r =>
      ['HOT', 'WARM', 'COLD', 'JUNK', 'MISSED'].includes(r.call_status ?? '')
    )

    const hot = completed.filter(r => r.call_status === 'HOT').length
    const warm = completed.filter(r => r.call_status === 'WARM').length
    const cold = completed.filter(r => r.call_status === 'COLD').length
    const junk = completed.filter(r => r.call_status === 'JUNK').length

    const missedRows = rows.filter(r =>
      r.call_status === 'MISSED' || r.end_reason === 'unjoined'
    )

    const durations = completed
      .map(r => r.duration_seconds)
      .filter((d): d is number => d != null && d > 0)
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0

    const missedCalls = missedRows.map(r => ({
      id: r.id,
      caller_phone: r.caller_phone ?? 'Unknown',
      created_at: r.created_at ?? r.started_at,
      end_reason: r.end_reason,
      duration_seconds: r.duration_seconds,
      client_slug: r.clients?.slug ?? 'unknown',
    }))

    const missedPhones = new Set(
      missedRows
        .map(r => r.caller_phone)
        .filter((p): p is string => p != null)
    )

    const calledBackPhones = new Set(
      rows
        .filter(r =>
          r.call_status !== 'MISSED' &&
          r.end_reason !== 'unjoined' &&
          r.caller_phone != null
        )
        .map(r => r.caller_phone!)
    )

    const callbackQueue = missedRows
      .filter(r => r.caller_phone != null && !calledBackPhones.has(r.caller_phone!))
      .reduce<Array<{ id: string; caller_phone: string; created_at: string; client_slug: string }>>((acc, r) => {
        if (!acc.some(a => a.caller_phone === r.caller_phone)) {
          acc.push({
            id: r.id,
            caller_phone: r.caller_phone!,
            created_at: r.created_at ?? r.started_at,
            client_slug: r.clients?.slug ?? 'unknown',
          })
        }
        return acc
      }, [])

    return NextResponse.json({
      summary: {
        total: completed.length,
        hot,
        warm,
        cold,
        junk,
        missed: missedRows.length,
        avgDuration,
      },
      missedCalls,
      callbackQueue,
    })
  } catch (err) {
    console.error('[activity] unexpected error:', err)
    return NextResponse.json({
      summary: { total: 0, hot: 0, warm: 0, cold: 0, junk: 0, missed: 0, avgDuration: 0 },
      missedCalls: [],
      callbackQueue: [],
      stale: true,
    })
  }
}
