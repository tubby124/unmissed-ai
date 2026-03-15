import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import SettingsView from './SettingsView'

export const dynamic = 'force-dynamic'

export interface ClientConfig {
  id: string
  slug: string
  business_name: string
  niche: string | null
  status: string | null
  system_prompt: string | null
  agent_voice_id: string | null
  ultravox_agent_id: string | null
  twilio_number: string | null
  telegram_chat_id: string | null
  telegram_bot_token: string | null
  timezone: string | null
  minutes_used_this_month: number | null
  monthly_minute_limit: number | null
  updated_at: string | null
  created_at: string
  bonus_minutes: number
  sms_enabled: boolean | null
  sms_template: string | null
  business_facts: string | null
  extra_qa: { q: string; a: string }[] | null
  forwarding_number: string | null
  setup_complete: boolean | null
  agent_name: string | null
  context_data: string | null
  context_data_label: string | null
  google_calendar_id: string | null
  booking_enabled: boolean | null
  booking_service_duration_minutes: number | null
  booking_buffer_minutes: number | null
  calendar_beta_enabled: boolean | null
  calendar_auth_status: string | null
}

export default async function SettingsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .single()

  if (!cu) redirect('/login')

  const isAdmin = cu.role === 'admin'
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  const SELECT = 'id, slug, business_name, niche, status, system_prompt, agent_voice_id, ultravox_agent_id, twilio_number, telegram_chat_id, telegram_bot_token, timezone, minutes_used_this_month, monthly_minute_limit, updated_at, created_at, bonus_minutes, sms_enabled, sms_template, business_facts, extra_qa, forwarding_number, setup_complete, agent_name, context_data, context_data_label, google_calendar_id, booking_enabled, booking_service_duration_minutes, booking_buffer_minutes, calendar_beta_enabled, calendar_auth_status'

  if (isAdmin) {
    const { data: clients } = await supabase
      .from('clients')
      .select(SELECT)
      .order('business_name')

    return (
      <SettingsView
        clients={(clients ?? []) as ClientConfig[]}
        isAdmin={true}
        appUrl={appUrl}
      />
    )
  }

  const { data: client } = await supabase
    .from('clients')
    .select(SELECT)
    .eq('id', cu.client_id)
    .single()

  if (!client) redirect('/login')

  return (
    <SettingsView
      clients={[client as ClientConfig]}
      isAdmin={false}
      appUrl={appUrl}
    />
  )
}
