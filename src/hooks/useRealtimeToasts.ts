'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'

/**
 * Subscribe to Supabase realtime and show dashboard toasts for:
 * - New bookings (INSERT on bookings table)
 * - Hot leads (call_logs UPDATE where call_status = 'HOT')
 *
 * Must be rendered inside the dashboard layout (after auth).
 */
export function useRealtimeToasts(clientId: string | null, isAdmin: boolean) {
  const shownRef = useRef(new Set<string>())

  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel('dashboard_toasts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        (payload) => {
          const row = payload.new as {
            id: string
            client_id: string | null
            caller_name: string | null
            service_name: string | null
            appointment_date: string | null
            appointment_time: string | null
          }
          if (!isAdmin && clientId && row.client_id !== clientId) return
          if (shownRef.current.has(`booking:${row.id}`)) return
          shownRef.current.add(`booking:${row.id}`)

          const name = row.caller_name || 'Someone'
          const time = row.appointment_time || ''
          const date = row.appointment_date || ''
          toast.success(`New booking: ${name}`, {
            description: date && time ? `${date} at ${time}` : 'Just booked via AI agent',
            duration: 8000,
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'call_logs' },
        (payload) => {
          const row = payload.new as {
            id: string
            client_id: string | null
            call_status: string | null
            caller_phone: string | null
          }
          if (!isAdmin && clientId && row.client_id !== clientId) return
          if (row.call_status !== 'HOT') return
          if (shownRef.current.has(`hot:${row.id}`)) return
          shownRef.current.add(`hot:${row.id}`)

          const phone = row.caller_phone || 'Unknown'
          toast('Hot lead detected', {
            description: `Caller ${phone} — ready to buy`,
            duration: 10000,
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'call_logs' },
        (payload) => {
          const row = payload.new as {
            id: string
            client_id: string | null
            call_status: string | null
            caller_phone: string | null
          }
          if (!isAdmin && clientId && row.client_id !== clientId) return
          // HOT has its own dedicated toast above
          if (!row.call_status || row.call_status === 'HOT') return
          // Only fire on terminal statuses
          const terminal = ['WARM', 'COLD', 'VOICEMAIL', 'voicemail', 'missed', 'completed', 'BUSY']
          if (!terminal.includes(row.call_status)) return
          if (shownRef.current.has(`completed:${row.id}`)) return
          shownRef.current.add(`completed:${row.id}`)

          const isTestCall = row.caller_phone === 'webrtc-test'
          if (isTestCall) return
          const raw = row.caller_phone || ''
          const digits = raw.replace(/\D/g, '')
          const phone = digits.length === 11 && digits[0] === '1'
            ? `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
            : digits.length === 10
            ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
            : raw || 'Unknown caller'
          toast('New call recorded', {
            description: phone,
            action: { label: 'View', onClick: () => { window.location.href = '/dashboard/calls' } },
            duration: 8000,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clientId, isAdmin])
}
