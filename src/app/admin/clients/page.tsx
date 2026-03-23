"use client"

import { useState, useEffect, useCallback } from 'react'

interface ClientRow {
  id: string
  slug: string
  business_name: string
  status: string
  twilio_number: string | null
  contact_email: string | null
  booking_enabled: boolean
  calendar_beta_enabled: boolean
  calendar_auth_status: string
  google_calendar_id: string | null
}

const STATUS_STYLES: Record<string, string> = {
  active:  'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
  setup:   'bg-amber-900/40 text-amber-300 border-amber-700/40',
  paused:  'bg-gray-800/60 text-gray-400 border-gray-700/40',
  demo:    'bg-blue-900/40 text-blue-300 border-blue-700/40',
  churned: 'bg-red-900/40 text-red-300 border-red-700/40',
}

function CalendarBadge({ status, calendarId }: { status: string; calendarId: string | null }) {
  if (status === 'connected') {
    return (
      <div>
        <span className="text-xs text-emerald-400">● connected</span>
        {calendarId && (
          <div className="text-[10px] text-gray-500 font-mono mt-0.5 truncate max-w-[160px]">{calendarId}</div>
        )}
      </div>
    )
  }
  if (status === 'expired') {
    return <span className="text-xs text-amber-400">● expired</span>
  }
  return <span className="text-xs text-gray-600">○ disconnected</span>
}

function Toggle({ on, disabled, onClick }: { on: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
        on ? 'bg-emerald-500' : 'bg-gray-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
        on ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </button>
  )
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [calConnected, setCalConnected] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('calendar_connected') === '1') setCalConnected(true)
  }, [])

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/clients')
      if (!res.ok) return
      const json = await res.json()
      setClients(json.clients ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  async function patchClient(clientId: string, patch: Record<string, unknown>) {
    setToggling(clientId)
    try {
      const res = await fetch('/api/admin/client-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, ...patch }),
      })
      if (res.ok) {
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...patch } : c))
      }
    } finally {
      setToggling(null)
    }
  }

  const active = clients.filter(c => c.status === 'active')
  const other  = clients.filter(c => c.status !== 'active')

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold t1">Clients</h1>
          <p className="text-sm t3 mt-1">
            {active.length} active · {other.length} other
          </p>
        </div>
        <button
          onClick={fetchClients}
          className="text-xs t3 hover:t1 transition-colors"
        >
          Refresh
        </button>
      </div>

      {calConnected && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
          Google Calendar connected successfully.
        </div>
      )}

      <ClientTable
        clients={active}
        loading={loading}
        toggling={toggling}
        onToggleBooking={(c) => patchClient(c.id, { booking_enabled: !c.booking_enabled })}
        onToggleBeta={(c) => patchClient(c.id, { calendar_beta_enabled: !c.calendar_beta_enabled })}
      />

      {other.length > 0 && !loading && (
        <div className="opacity-60">
          <p className="text-xs font-medium t3 uppercase tracking-widest mb-3">Other</p>
          <ClientTable
            clients={other}
            loading={false}
            toggling={toggling}
            onToggleBooking={(c) => patchClient(c.id, { booking_enabled: !c.booking_enabled })}
            onToggleBeta={(c) => patchClient(c.id, { calendar_beta_enabled: !c.calendar_beta_enabled })}
          />
        </div>
      )}
    </div>
  )
}

function ClientTable({
  clients,
  loading,
  toggling,
  onToggleBooking,
  onToggleBeta,
}: {
  clients: ClientRow[]
  loading: boolean
  toggling: string | null
  onToggleBooking: (c: ClientRow) => void
  onToggleBeta: (c: ClientRow) => void
}) {
  return (
    <div className="bg-surface rounded-xl border b-theme overflow-hidden">
      {loading ? (
        <div className="px-5 py-10 text-center text-sm text-gray-500">Loading…</div>
      ) : clients.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-500">No clients.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b b-theme text-xs t3 uppercase tracking-wide bg-hover">
              <th className="px-5 py-3 text-left font-medium">Client</th>
              <th className="px-3 py-3 text-left font-medium">Status</th>
              <th className="px-3 py-3 text-left font-medium">Number</th>
              <th className="px-3 py-3 text-center font-medium">Booking</th>
              <th className="px-3 py-3 text-center font-medium">Beta</th>
              <th className="px-3 py-3 text-left font-medium">Calendar</th>
              <th className="px-3 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => (
              <tr
                key={c.id}
                className={`border-b b-theme last:border-b-0 ${i % 2 === 0 ? '' : 'bg-page'}`}
              >
                <td className="px-5 py-3">
                  <div className="t1 font-medium">{c.business_name}</div>
                  <div className="text-xs t3 font-mono mt-0.5">{c.slug}</div>
                  {c.contact_email && (
                    <div className="text-[11px] t3 mt-0.5">{c.contact_email}</div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[c.status] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-3 py-3 font-mono text-xs t2 whitespace-nowrap">
                  {c.twilio_number ?? <span className="t3">—</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  <Toggle
                    on={c.booking_enabled}
                    disabled={toggling === c.id}
                    onClick={() => onToggleBooking(c)}
                  />
                </td>
                <td className="px-3 py-3 text-center">
                  <Toggle
                    on={c.calendar_beta_enabled}
                    disabled={toggling === c.id}
                    onClick={() => onToggleBeta(c)}
                  />
                </td>
                <td className="px-3 py-3">
                  <CalendarBadge status={c.calendar_auth_status} calendarId={c.google_calendar_id} />
                </td>
                <td className="px-3 py-3 text-right">
                  <a
                    href={`/api/auth/google?client_id=${c.id}`}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap"
                  >
                    {c.calendar_auth_status === 'connected' ? 'Reconnect ↗' : 'Connect Calendar ↗'}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
