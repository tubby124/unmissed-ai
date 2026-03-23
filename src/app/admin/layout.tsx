import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { BRAND_NAME } from '@/lib/brand'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') redirect('/login')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-white/10 px-6 py-3 flex items-center gap-6 text-sm">
        <span className="font-semibold text-white tracking-tight">{BRAND_NAME}</span>
        <Link href="/admin/calls" className="text-gray-400 hover:text-white transition-colors">
          Calls
        </Link>
        <Link href="/admin/prompt" className="text-gray-400 hover:text-white transition-colors">
          Prompt
        </Link>
        <Link href="/admin/costs" className="text-gray-400 hover:text-white transition-colors">
          Costs
        </Link>
        <Link href="/admin/test-lab" className="text-gray-400 hover:text-white transition-colors">
          Test Lab
        </Link>
        <Link href="/admin/insights" className="text-gray-400 hover:text-white transition-colors">
          Insights
        </Link>
        <Link href="/admin/numbers" className="text-gray-400 hover:text-white transition-colors">
          Numbers
        </Link>
        <Link href="/admin/clients" className="text-gray-400 hover:text-white transition-colors">
          Clients
        </Link>
        <Link href="/admin/calendar" className="text-gray-400 hover:text-white transition-colors">
          Calendar
        </Link>
        <Link
          href="/onboard"
          className="ml-auto text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
        >
          + New Intake
        </Link>
      </nav>
      {children}
    </div>
  )
}
