import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authError } = await adminSupa.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = req.nextUrl.searchParams
    const conversationId = params.get('id')

    if (conversationId) {
      const { data: conversation, error: convError } = await adminSupa
        .from('ai_conversations')
        .select('id, title, is_archived, model, created_at, updated_at')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single()

      if (convError || !conversation) {
        console.error('[advisor] conversation fetch error:', convError?.message)
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }

      const { data: messages, error: msgError } = await adminSupa
        .from('ai_messages')
        .select('id, role, content, model, tokens_used, cost_cents, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (msgError) {
        console.error('[advisor] messages fetch error:', msgError.message)
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
      }

      return NextResponse.json({ conversation, messages: messages ?? [] })
    }

    const archived = params.get('archived') === 'true'

    const { data: conversations, error: listError } = await adminSupa
      .from('ai_conversations')
      .select('id, title, is_archived, model, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('is_archived', archived)
      .order('updated_at', { ascending: false })

    if (listError) {
      console.error('[advisor] conversations list error:', listError.message)
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
    }

    return NextResponse.json({ conversations: conversations ?? [] })
  } catch (err) {
    console.error('[advisor] conversations unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
