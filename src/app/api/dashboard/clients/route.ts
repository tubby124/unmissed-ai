/**
 * GET /api/dashboard/clients
 * Returns all clients for admin, or the user's own client for owners.
 * Auth: Supabase session.
 */

import { NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase.from('client_users').select('client_id,role').eq('user_id', user.id).single()
  if (!cu) return new NextResponse('Forbidden', { status: 403 })

  const svc = createServiceClient()

  if (cu.role === 'admin') {
    const { data: clients } = await svc.from('clients').select('id,slug,business_name,niche,status').order('business_name')
    return NextResponse.json({ clients: clients || [] })
  }

  const { data: client } = await svc.from('clients').select('id,slug,business_name,niche,status').eq('id', cu.client_id).single()
  return NextResponse.json({ clients: client ? [client] : [] })
}
