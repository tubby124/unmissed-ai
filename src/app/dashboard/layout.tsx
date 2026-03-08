import type { ReactNode } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import MobileNav from '@/components/dashboard/MobileNav'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let businessName: string | undefined
  if (user) {
    const { data: cu } = await supabase
      .from('client_users')
      .select('client_id, clients(business_name)')
      .eq('user_id', user.id)
      .single()
    businessName = (cu?.clients as { business_name?: string } | null)?.business_name ?? undefined
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      {/* Ambient glow background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-60 -left-60 w-[500px] h-[500px] bg-blue-500/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-60 -right-60 w-[500px] h-[500px] bg-violet-500/8 rounded-full blur-3xl" />
      </div>

      {/* Mobile top bar */}
      <MobileNav businessName={businessName} />

      <div className="flex flex-1 relative">
        {/* Desktop sidebar */}
        <Sidebar businessName={businessName} />

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
