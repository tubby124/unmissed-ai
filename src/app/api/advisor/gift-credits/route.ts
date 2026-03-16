import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authError } = await adminSupa.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only admins can gift credits
    const { data: cuRole } = await adminSupa
      .from('client_users')
      .select('role')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (cuRole?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({})) as {
      targetEmail?: string
      amountCents?: number
    }

    const { targetEmail, amountCents } = body

    if (!targetEmail || typeof targetEmail !== 'string') {
      return NextResponse.json({ error: 'targetEmail is required' }, { status: 400 })
    }

    if (!amountCents || typeof amountCents !== 'number' || amountCents <= 0 || amountCents > 100000) {
      return NextResponse.json({ error: 'amountCents must be 1-100000' }, { status: 400 })
    }

    // Find user by email
    const { data: targetUsers, error: listErr } = await adminSupa.auth.admin.listUsers()
    if (listErr) {
      console.error('[advisor] gift: listUsers error:', listErr.message)
      return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 })
    }

    const targetUser = targetUsers.users.find(u => u.email === targetEmail)
    if (!targetUser) {
      return NextResponse.json({ error: `User not found: ${targetEmail}` }, { status: 404 })
    }

    // Upsert credit row: add to existing balance (or create new)
    const { data: existing } = await adminSupa
      .from('ai_chat_credits')
      .select('balance_cents')
      .eq('user_id', targetUser.id)
      .single()

    if (existing) {
      // Don't modify unlimited accounts
      if (existing.balance_cents === -1) {
        return NextResponse.json({ error: 'User has unlimited credits' }, { status: 400 })
      }

      const { error: updateErr } = await adminSupa
        .from('ai_chat_credits')
        .update({ balance_cents: existing.balance_cents + amountCents })
        .eq('user_id', targetUser.id)

      if (updateErr) {
        console.error('[advisor] gift: update error:', updateErr.message)
        return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 })
      }
    } else {
      const { error: insertErr } = await adminSupa
        .from('ai_chat_credits')
        .insert({ user_id: targetUser.id, balance_cents: amountCents })

      if (insertErr) {
        console.error('[advisor] gift: insert error:', insertErr.message)
        return NextResponse.json({ error: 'Failed to create credits' }, { status: 500 })
      }
    }

    // Log the transaction
    await adminSupa.from('ai_transactions').insert({
      user_id: targetUser.id,
      type: 'grant',
      amount_cents: amountCents,
      note: `Admin gift from ${user.email} — ${amountCents}¢`,
    })

    const newBalance = existing
      ? existing.balance_cents + amountCents
      : amountCents

    console.log(`[advisor] gift: ${user.email} gifted ${amountCents}¢ to ${targetEmail}, new balance: ${newBalance}¢`)

    return NextResponse.json({
      targetEmail,
      amountCents,
      newBalance,
    })
  } catch (err) {
    console.error('[advisor] gift unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
