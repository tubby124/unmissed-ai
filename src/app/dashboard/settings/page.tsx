import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { APP_URL } from '@/lib/app-url'
import { CLIENT_CONFIG_SELECT } from '@/lib/clients/select-columns'
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
  seconds_used_this_month: number | null
  monthly_minute_limit: number | null
  updated_at: string | null
  created_at: string
  bonus_minutes: number
  sms_enabled: boolean | null
  sms_template: string | null
  business_facts: string[] | null
  extra_qa: { q: string; a: string }[] | null
  forwarding_number: string | null
  setup_complete: boolean | null
  agent_name: string | null
  context_data: string | null
  context_data_label: string | null
  google_calendar_id: string | null
  booking_enabled: boolean | null
  booking_provider: string | null
  booking_service_duration_minutes: number | null
  booking_buffer_minutes: number | null
  calendar_beta_enabled: boolean | null
  calendar_auth_status: string | null
  telegram_style: string | null
  weekly_digest_enabled: boolean | null
  telegram_notifications_enabled: boolean | null
  email_notifications_enabled: boolean | null
  injected_note: string | null
  subscription_status: string | null
  subscription_current_period_end: string | null
  grace_period_end: string | null
  stripe_customer_id: string | null
  // A3 — After-hours config
  business_hours_weekday: string | null
  business_hours_weekend: string | null
  after_hours_behavior: string | null
  after_hours_emergency_phone: string | null
  // A5 — Website knowledge ingestion
  website_url: string | null
  website_last_scraped_at: string | null
  website_scrape_status: string | null
  website_scrape_error: string | null
  website_scrape_pages: string[] | null
  website_knowledge_preview: {
    businessFacts: string[]
    extraQa: { q: string; a: string }[]
    serviceTags: string[]
    warnings: string[]
  } | null
  website_knowledge_approved: {
    businessFacts: string[]
    extraQa: { q: string; a: string }[]
    serviceTags: string[]
  } | null
  // A6 — Knowledge retrieval backend
  knowledge_backend: string | null
  // B2 — Live transfer conditions
  transfer_conditions: string | null
  // B3 — Voice style preset
  voice_style_preset: string | null
  // B4 — Stripe discount info
  stripe_discount_name: string | null
  effective_monthly_rate: number | null
  stripe_subscription_id: string | null
  cancel_at: string | null
  // S14 — Voicemail fallback greeting
  voicemail_greeting_text: string | null
  voicemail_greeting_audio_url: string | null
  contact_email: string | null
  // Phase 0a — onboarding-sourced profile fields
  owner_name: string | null
  city: string | null
  state: string | null
  services_offered: string | null
  callback_phone: string | null
  // IVR — voicemail menu pre-filter
  ivr_enabled: boolean | null
  ivr_prompt: string | null
  // GBP provenance snapshot
  gbp_place_id: string | null
  gbp_summary: string | null
  gbp_rating: number | null
  gbp_review_count: number | null
  gbp_photo_url: string | null
  // Call handling mode + agent mode
  call_handling_mode: string | null
  agent_mode: string | null
  // Service catalog (appointment_booking mode)
  service_catalog: { name: string; duration_mins?: number; price?: string }[] | null
  // Plan selection
  selected_plan: string | null
  trial_expires_at: string | null
  trial_converted: boolean | null
  // D76 — Knowledge chunk count (not a DB column — injected by settings/page.tsx server query)
  approved_knowledge_chunk_count?: number
  // Outbound calling structured fields
  outbound_prompt: string | null
  outbound_goal: string | null
  outbound_opening: string | null
  outbound_vm_script: string | null
  outbound_tone: string | null
  outbound_notes: string | null
  // Telegram registration (pending connect)
  telegram_registration_token: string | null
  // D114 — Staff roster (booking-mode clients)
  staff_roster: { name: string; role: string; availability_note?: string }[] | null
  // D247/D254 — Owner intent variables (custom TRIAGE_DEEP, etc.)
  niche_custom_variables: Record<string, string> | null
  // G0.5 — agent sync instrumentation
  last_agent_sync_at: string | null
  last_agent_sync_status: string | null
  // Phase E Wave 1 — Day-1 edit panel fields
  today_update: string | null
  business_notes: string | null
  unknown_answer_behavior: string | null
  pricing_policy: string | null
  calendar_mode: string | null
  fields_to_collect: string[] | null
  hand_tuned: boolean | null
  // Outbound scheduling
  outbound_enabled: boolean | null
  outbound_number: string | null
  outbound_time_window_start: string | null
  outbound_time_window_end: string | null
  outbound_max_attempts: number | null
  // AI-generated niche config for 'other' businesses
  custom_niche_config: Record<string, unknown> | null
  // Go Live Tab Section 4 — carrier-chain forwarding verification status (DB_ONLY)
  forwarding_verified_at: string | null
  forwarding_self_attested: boolean | null
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ client_id?: string; tab?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const initialClientId = params?.client_id
  const initialTab = params?.tab as import('@/components/dashboard/settings/constants').SettingsTab | undefined
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) redirect('/login')

  const isAdmin = cu.role === 'admin'
  const appUrl = APP_URL

  if (isAdmin) {
    const { data: clients } = await supabase
      .from('clients')
      .select(CLIENT_CONFIG_SELECT)
      .order('business_name')

    return (
      <SettingsView
        clients={(clients ?? []) as ClientConfig[]}
        isAdmin={true}
        appUrl={appUrl}
        initialClientId={initialClientId}
        initialTab={initialTab}
      />
    )
  }

  const { data: client } = await supabase
    .from('clients')
    .select(CLIENT_CONFIG_SELECT)
    .eq('id', cu.client_id)
    .single()

  if (!client) redirect('/login')

  // D76 — inject chunk count so AgentTab/CapabilitiesCard can correct hasKnowledge badge
  const { count: chunkCount } = await supabase
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', cu.client_id)
    .eq('status', 'approved')

  const clientWithCount = { ...client, approved_knowledge_chunk_count: chunkCount ?? 0 } as ClientConfig

  return (
    <SettingsView
      clients={[clientWithCount]}
      isAdmin={false}
      appUrl={appUrl}
      initialClientId={initialClientId}
      initialTab={initialTab}
    />
  )
}
