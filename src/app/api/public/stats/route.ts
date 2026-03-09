import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const revalidate = 3600

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { count, error } = await supabase
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .not('call_status', 'in', '(live,processing)')

    if (error) throw error

    return NextResponse.json({ calls: count ?? 0 }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch {
    return NextResponse.json({ calls: 0 }, { status: 200 })
  }
}
