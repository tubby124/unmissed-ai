import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import CallDetail from '@/components/dashboard/CallDetail'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CallDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: call } = await supabase
    .from('call_logs')
    .select('*, clients(business_name)')
    .eq('ultravox_call_id', id)
    .single()

  if (!call) notFound()

  const isLive = call.call_status === 'live'
  const agentName = (call.clients as { business_name?: string } | null)?.business_name ?? 'Agent'

  return <CallDetail call={call} agentName={agentName} isLive={isLive} />
}
