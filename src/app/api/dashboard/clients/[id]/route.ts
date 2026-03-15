/**
 * DELETE /api/dashboard/clients/[id]
 * Admin only. Deletes a test client (guard: must have no twilio_number AND no activation_log).
 * Cascades: clients, client_users, intake_submissions (by slug).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Admin auth
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const svc = createServiceClient()

  // Safety guard — only allow deleting test clients (no Twilio number, no activation log)
  const { data: client } = await svc
    .from('clients')
    .select('slug, twilio_number, activation_log')
    .eq('id', id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (client.twilio_number) {
    return NextResponse.json({ error: 'Cannot delete a client with an assigned Twilio number' }, { status: 409 })
  }
  if (client.activation_log) {
    return NextResponse.json({ error: 'Cannot delete a client that has been activated' }, { status: 409 })
  }

  // Delete in cascade order
  await svc.from('intake_submissions').delete().eq('client_slug', client.slug)
  await svc.from('client_users').delete().eq('client_id', id)
  await svc.from('clients').delete().eq('id', id)

  return NextResponse.json({ ok: true })
}
