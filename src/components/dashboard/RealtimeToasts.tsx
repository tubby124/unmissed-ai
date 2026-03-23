'use client'

import { useRealtimeToasts } from '@/hooks/useRealtimeToasts'

export default function RealtimeToasts({ clientId, isAdmin }: { clientId: string | null; isAdmin: boolean }) {
  useRealtimeToasts(clientId, isAdmin)
  return null
}
