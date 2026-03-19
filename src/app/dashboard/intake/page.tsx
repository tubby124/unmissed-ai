import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import IntakeTable from '@/components/dashboard/IntakeTable'
import type { Intake } from '@/components/dashboard/IntakeTable'

export const dynamic = 'force-dynamic'

export default async function IntakePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') redirect('/dashboard/calls')

  const { data: intakes } = await supabase
    .from('intake_submissions')
    .select('id, submitted_at, status, progress_status, business_name, niche, client_id, intake_json, owner_name, contact_email')
    .order('submitted_at', { ascending: false })

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-text-1)" }}>Intake Pipeline</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-3)" }}>
          Onboarding submissions — generate prompt, activate, and create accounts
        </p>
      </div>

      <IntakeTable intakes={(intakes ?? []) as Intake[]} />
    </div>
  )
}
