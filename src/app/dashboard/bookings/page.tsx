import { redirect } from 'next/navigation'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import BookingsView, { type Booking } from '@/components/dashboard/bookings/BookingsView'

export const dynamic = 'force-dynamic'

export default async function BookingsPage() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) redirect('/dashboard')

  const serviceClient = createServiceClient()

  const { data: bookings } = await serviceClient
    .from('bookings')
    .select('id, caller_name, caller_phone, appointment_date, appointment_time, service, calendar_url, created_at, slug')
    .eq('client_id', cu.client_id)
    .order('appointment_date', { ascending: false })
    .order('appointment_time', { ascending: false })

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-[18px] font-bold t1">Bookings</h1>
        <p className="text-[12px] t3 mt-0.5">Appointments booked by your agent</p>
      </div>
      <BookingsView bookings={(bookings ?? []) as Booking[]} />
    </div>
  )
}
