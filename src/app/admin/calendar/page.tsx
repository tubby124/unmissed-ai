import { redirect } from 'next/navigation'
import { createServiceClient, createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface Booking {
  id: string
  slug: string
  caller_name: string | null
  caller_phone: string | null
  appointment_date: string | null
  appointment_time: string | null
  service: string | null
  calendar_url: string | null
  created_at: string
  clients?: { business_name?: string }[] | null
}

export default async function AdminCalendarPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()

  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') redirect('/login')

  const { data: bookings } = await svc
    .from('bookings')
    .select('id, slug, caller_name, caller_phone, appointment_date, appointment_time, service, calendar_url, created_at, clients(business_name)')
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })
    .limit(100)

  const upcoming = (bookings || []).filter((b: Booking) => {
    if (!b.appointment_date) return true
    return b.appointment_date >= new Date().toISOString().split('T')[0]
  })

  const past = (bookings || []).filter((b: Booking) => {
    if (!b.appointment_date) return false
    return b.appointment_date < new Date().toISOString().split('T')[0]
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">All Bookings</h1>
        <p className="text-gray-400 text-sm mt-1">
          {upcoming.length} upcoming · {past.length} past
        </p>
      </div>

      {upcoming.length === 0 && past.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p>No bookings yet.</p>
          <p className="text-sm mt-2">When demo agents book appointments, they appear here.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <BookingTable title="Upcoming" bookings={upcoming} />
      )}

      {past.length > 0 && (
        <BookingTable title="Past" bookings={past} faded />
      )}
    </div>
  )
}

function BookingTable({ title, bookings, faded }: { title: string; bookings: Booking[]; faded?: boolean }) {
  return (
    <div className={`mb-10 ${faded ? 'opacity-60' : ''}`}>
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-3">{title}</h2>
      <div className="rounded-xl overflow-hidden border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Date / Time</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Caller</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Client</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Service</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b, i) => (
              <tr
                key={b.id}
                className="border-b border-white/5 last:border-0"
                style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
              >
                <td className="px-4 py-3 text-white font-mono text-xs">
                  <div>{b.appointment_date ?? '—'}</div>
                  <div className="text-gray-500">{b.appointment_time ?? ''}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white">{b.caller_name ?? 'Unknown'}</div>
                  <div className="text-gray-500 text-xs">{b.caller_phone ?? ''}</div>
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">
                  {b.clients?.[0]?.business_name ?? b.slug ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{b.service ?? '—'}</td>
                <td className="px-4 py-3">
                  {b.calendar_url && (
                    <Link
                      href={b.calendar_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 text-xs"
                    >
                      View →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
