/**
 * DELETE /api/dashboard/faq-suggestions
 * Dismisses all pending FAQ suggestions for the current client by clearing
 * faq_suggestions on all call_log rows that have non-empty suggestions.
 * Only touches rows belonging to the authenticated user's client.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (!cu) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('call_logs')
    .update({ faq_suggestions: [] })
    .eq('client_id', cu.client_id)
    .not('faq_suggestions', 'is', null)
    .neq('faq_suggestions', '[]')

  if (error) {
    console.error('[faq-suggestions] Dismiss failed:', error.message)
    return NextResponse.json({ error: 'Failed to dismiss suggestions' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
