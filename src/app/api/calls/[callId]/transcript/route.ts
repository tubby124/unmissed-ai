import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('call_logs')
    .select('transcript')
    .eq('ultravox_call_id', callId)
    .single()

  if (!data) {
    return new NextResponse('Not found', { status: 404 })
  }

  return NextResponse.json(data.transcript || [])
}
