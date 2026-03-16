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

    const [creditsResult, spentResult] = await Promise.all([
      adminSupa
        .from('ai_chat_credits')
        .select('balance_cents')
        .eq('user_id', user.id)
        .single(),
      adminSupa
        .from('ai_transactions')
        .select('amount_cents')
        .eq('user_id', user.id)
        .eq('type', 'deduction'),
    ])

    let balance_cents = 0
    let is_unlimited = false

    if (!creditsResult.error && creditsResult.data) {
      balance_cents = creditsResult.data.balance_cents
      if (balance_cents === -1) {
        is_unlimited = true
      }
    } else if (creditsResult.error?.code === 'PGRST116') {
      // No credit row exists — auto-create with 0 balance
      await adminSupa.from('ai_chat_credits').insert({
        user_id: user.id,
        balance_cents: 0,
      })
    }

    let lifetime_spent_cents = 0
    if (!spentResult.error && spentResult.data) {
      lifetime_spent_cents = spentResult.data.reduce(
        (sum, row) => sum + (row.amount_cents ?? 0),
        0
      )
    }

    console.log('[advisor] credits: user', user.id, 'balance', balance_cents, 'spent', lifetime_spent_cents)

    return NextResponse.json({
      balance_cents,
      lifetime_spent_cents,
      is_unlimited,
    })
  } catch (err) {
    console.error('[advisor] credits unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
