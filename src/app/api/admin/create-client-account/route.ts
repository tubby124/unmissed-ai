import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const adminSupa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  // Auth check — must be admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, intakeId, clientId } = await req.json()

  if (!email || !intakeId) {
    return NextResponse.json({ error: 'Missing email or intakeId' }, { status: 400 })
  }

  // Create Supabase Auth user (email confirmed, no password — they set via reset email)
  const { data: newUser, error: createErr } = await adminSupa.auth.admin.createUser({
    email,
    email_confirm: true,
  })

  if (createErr || !newUser.user) {
    return NextResponse.json({ error: createErr?.message || 'Failed to create user' }, { status: 500 })
  }

  const newUserId = newUser.user.id

  // If clientId provided, link them in client_users
  if (clientId) {
    const { error: linkErr } = await adminSupa
      .from('client_users')
      .insert({ user_id: newUserId, client_id: clientId, role: 'owner' })

    if (linkErr) {
      console.error('[create-client-account] client_users insert failed:', linkErr)
      // Don't fail — user was created, just note the issue
    }

    // Link intake to the client
    await adminSupa
      .from('intake_submissions')
      .update({ client_id: clientId, supabase_user_id: newUserId })
      .eq('id', intakeId)
  } else {
    // Just update intake with the new user ID
    await adminSupa
      .from('intake_submissions')
      .update({ supabase_user_id: newUserId })
      .eq('id', intakeId)
  }

  // Send password reset email so client can set their own password
  await adminSupa.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'}/auth/callback?next=/dashboard`,
  })

  return NextResponse.json({ success: true, userId: newUserId })
}
