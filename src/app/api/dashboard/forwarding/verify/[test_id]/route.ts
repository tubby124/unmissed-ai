import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 10

const TEST_TIMEOUT_MS = 60_000

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ test_id: string }> }
) {
  const { test_id } = await params

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()

  if (!cu) return new NextResponse('Forbidden', { status: 403 })

  const svc = createServiceClient()
  const { data: test, error } = await svc
    .from('forwarding_verify_tests')
    .select('id, client_id, status, started_at, completed_at, error_message')
    .eq('id', test_id)
    .limit(1)
    .maybeSingle()

  if (error || !test) return NextResponse.json({ error: 'Test not found' }, { status: 404 })

  // Tenant isolation: non-admin can only read their own client's tests
  if (cu.role !== 'admin' && test.client_id !== cu.client_id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Lazy timeout: if still pending and past window, flip to 'timeout'
  if (test.status === 'pending') {
    const age = Date.now() - new Date(test.started_at).getTime()
    if (age > TEST_TIMEOUT_MS) {
      const nowIso = new Date().toISOString()
      await svc
        .from('forwarding_verify_tests')
        .update({ status: 'timeout', completed_at: nowIso })
        .eq('id', test.id)
        .eq('status', 'pending')
      return NextResponse.json({
        test_id: test.id,
        status: 'timeout',
        started_at: test.started_at,
        completed_at: nowIso,
      })
    }
  }

  return NextResponse.json({
    test_id: test.id,
    status: test.status,
    started_at: test.started_at,
    completed_at: test.completed_at,
    error_message: test.error_message,
  })
}
