/**
 * POST /api/dashboard/outbound/templates/:id/set-default
 *
 * Sets a template as the default for its client. All other templates for
 * that client have is_default set to false first.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || !['admin', 'owner'].includes(cu.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()

  // Fetch the template to verify it exists and resolve the client_id
  const { data: template } = await svc
    .from('outbound_templates')
    .select('id, client_id')
    .eq('id', id)
    .maybeSingle()

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  // Ownership check: non-admin may only set defaults on their own client's templates
  if (cu.role !== 'admin' && template.client_id !== cu.client_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clientId = template.client_id

  // Step 1: Unset all defaults for this client
  const { error: resetError } = await svc
    .from('outbound_templates')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('is_default', true)

  if (resetError) {
    console.error('[outbound/templates set-default] reset error:', resetError.message)
    return NextResponse.json({ error: 'Failed to update templates' }, { status: 500 })
  }

  // Step 2: Set this template as default
  const { data: updated, error: setError } = await svc
    .from('outbound_templates')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (setError) {
    // Attempt rollback (best-effort)
    console.error('[outbound/templates set-default] set error:', setError.message)
    return NextResponse.json({ error: 'Failed to set default template' }, { status: 500 })
  }

  return NextResponse.json({ template: updated })
}