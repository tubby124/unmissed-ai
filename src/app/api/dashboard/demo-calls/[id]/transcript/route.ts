import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { getTranscript } from '@/lib/ultravox'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Admin-only auth
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Look up demo call to get ultravox_call_id
  const service = createServiceClient()
  const { data: demoCall, error } = await service
    .from('demo_calls')
    .select('ultravox_call_id')
    .eq('id', id)
    .single()

  if (error || !demoCall?.ultravox_call_id) {
    return NextResponse.json({ messages: [] })
  }

  const messages = await getTranscript(demoCall.ultravox_call_id)
  return NextResponse.json({ messages })
}
