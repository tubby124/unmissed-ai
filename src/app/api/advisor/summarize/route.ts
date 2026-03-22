import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const SUMMARIZE_COST_CENTS = 5

export async function POST(req: NextRequest) {
  const adminSupa = createServiceClient()
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authError } = await adminSupa.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { conversationId } = body as { conversationId?: string }

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
    }

    const { data: conversation, error: convError } = await adminSupa
      .from('ai_conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      console.error('[advisor] summarize: conversation not found:', convError?.message)
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { data: messages, error: msgError } = await adminSupa
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (msgError || !messages || messages.length === 0) {
      console.error('[advisor] summarize: messages fetch error:', msgError?.message)
      return NextResponse.json({ error: 'No messages to summarize' }, { status: 400 })
    }

    const summaryMessages = [
      {
        role: 'system' as const,
        content: 'You are a concise summarizer. Produce a 2-3 sentence summary of the following conversation. Focus on the key topics discussed and any conclusions reached. Do not use bullet points.',
      },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      {
        role: 'user' as const,
        content: 'Summarize the conversation above in 2-3 sentences.',
      },
    ]

    const openrouterKey = process.env.OPENROUTER_API_KEY
    if (!openrouterKey) {
      console.error('[advisor] summarize: OPENROUTER_API_KEY not set')
      return NextResponse.json({ error: 'Summarization service unavailable' }, { status: 503 })
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://unmissed.ai',
        'X-Title': 'unmissed.ai advisor',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        messages: summaryMessages,
        max_tokens: 200,
        temperature: 0,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[advisor] summarize: OpenRouter error:', res.status, errText)
      return NextResponse.json({ error: 'Summarization failed' }, { status: 502 })
    }

    const completionData = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const summary = completionData.choices?.[0]?.message?.content?.trim()

    if (!summary) {
      console.error('[advisor] summarize: empty summary from OpenRouter')
      return NextResponse.json({ error: 'Summarization produced empty result' }, { status: 502 })
    }

    const { error: archiveError } = await adminSupa
      .from('ai_conversations')
      .update({ is_archived: true, title: summary, updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', user.id)

    if (archiveError) {
      console.error('[advisor] summarize: archive error:', archiveError.message)
      return NextResponse.json({ error: 'Failed to archive conversation' }, { status: 500 })
    }

    const { data: newConversation, error: createError } = await adminSupa
      .from('ai_conversations')
      .insert({
        user_id: user.id,
        title: 'New conversation',
      })
      .select('id')
      .single()

    if (createError || !newConversation) {
      console.error('[advisor] summarize: create conversation error:', createError?.message)
      return NextResponse.json({ error: 'Failed to create new conversation' }, { status: 500 })
    }

    const { error: sysMessageError } = await adminSupa
      .from('ai_messages')
      .insert({
        conversation_id: newConversation.id,
        role: 'system',
        content: `Summary of previous conversation: ${summary}`,
      })

    if (sysMessageError) {
      console.error('[advisor] summarize: system message insert error:', sysMessageError.message)
    }

    // Check if admin — skip credit deduction
    const { data: cuRole } = await adminSupa
      .from('client_users')
      .select('role')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (cuRole?.role !== 'admin') {
      const { error: creditError } = await adminSupa.rpc('deduct_advisor_credits', {
        p_user_id: user.id,
        p_amount_cents: SUMMARIZE_COST_CENTS,
      })

      if (creditError) {
        console.log('[advisor] summarize: credit deduction failed (non-blocking):', creditError.message)
      } else {
        const { error: txError } = await adminSupa
          .from('ai_transactions')
          .insert({
            user_id: user.id,
            type: 'deduction',
            amount_cents: SUMMARIZE_COST_CENTS,
            note: `Summarization of conversation ${conversationId}`,
          })

        if (txError) {
          console.error('[advisor] summarize: transaction log error:', txError.message)
        }
      }
    }

    console.log('[advisor] summarize: conversation', conversationId, 'archived, new conversation', newConversation.id)

    return NextResponse.json({
      newConversationId: newConversation.id,
      summary,
    })
  } catch (err) {
    console.error('[advisor] summarize unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
