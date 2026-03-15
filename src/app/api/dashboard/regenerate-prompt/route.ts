/**
 * POST /api/dashboard/regenerate-prompt
 * Admin only. Re-generates system_prompt from latest intake_submission.
 * Body: { clientId: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { buildPromptFromIntake } from '@/lib/prompt-builder'

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => ({})) as { clientId?: string }
  const { clientId } = body
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const svc = createServiceClient()

  // Get client slug
  const { data: client } = await svc
    .from('clients')
    .select('slug, agent_name, status')
    .eq('id', clientId)
    .single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Get latest intake submission
  const { data: intake } = await svc
    .from('intake_submissions')
    .select('intake_json')
    .eq('client_slug', client.slug)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (!intake?.intake_json) return NextResponse.json({ error: 'No intake found for this client' }, { status: 404 })

  const intakeData = { ...intake.intake_json } as Record<string, unknown>

  // For active clients, preserve the current agent_name
  if (client.agent_name && client.status === 'active') {
    intakeData.db_agent_name = client.agent_name
  }

  const newPrompt = buildPromptFromIntake(intakeData, undefined)

  await svc
    .from('clients')
    .update({ system_prompt: newPrompt, updated_at: new Date().toISOString() })
    .eq('id', clientId)

  return NextResponse.json({ ok: true })
}
