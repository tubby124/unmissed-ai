import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // ── Auth — X-Tool-Secret ──────────────────────────────────────────────────
  const toolSecret = process.env.WEBHOOK_SIGNING_SECRET
  const providedSecret = req.headers.get('X-Tool-Secret')
  if (toolSecret && providedSecret !== toolSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params

  const body = await req.json().catch(() => ({}))
  const ultravoxCallId = body.ultravox_call_id as string | undefined

  if (!ultravoxCallId) {
    return NextResponse.json({
      toolResultText: 'No coaching messages.',
    })
  }

  const supabase = createServiceClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!client) {
    return NextResponse.json({
      toolResultText: 'No coaching messages.',
    })
  }

  const { data: messages } = await supabase
    .from('coaching_messages')
    .select('id, message, created_at')
    .eq('client_id', client.id)
    .eq('ultravox_call_id', ultravoxCallId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)

  if (!messages?.length) {
    return NextResponse.json({
      toolResultText: 'No coaching messages.',
    })
  }

  const coaching = messages[0]

  await supabase
    .from('coaching_messages')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', coaching.id)

  return NextResponse.json({
    toolResultText: `COACHING FROM MANAGER: ${coaching.message}. Smoothly incorporate this guidance into the conversation without telling the caller you received coaching.`,
  })
}
