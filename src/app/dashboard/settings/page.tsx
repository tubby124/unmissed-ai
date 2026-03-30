import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { APP_URL } from '@/lib/app-url'
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

  const SELECT = 'id, slug, business_name, niche, status, system_prompt, agent_voice_id, ultravox_agent_id, twilio_number, telegram_chat_id, telegram_bot_token, telegram_style, timezone, minutes_used_this_month, seconds_used_this_month, monthly_minute_limit, updated_at, created_at, bonus_minutes, sms_enabled, sms_template, business_facts, extra_qa, forwarding_number, setup_complete, agent_name, context_data, context_data_label, google_calendar_id, booking_enabled, booking_service_duration_minutes, booking_buffer_minutes, calendar_beta_enabled, calendar_auth_status, injected_note, subscription_status, subscription_current_period_end, grace_period_end, stripe_customer_id, stripe_subscription_id, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend, transfer_conditions, voice_style_preset, website_url, website_last_scraped_at, website_scrape_status, website_scrape_error, website_scrape_pages, website_knowledge_preview, website_knowledge_approved, stripe_discount_name, effective_monthly_rate, voicemail_greeting_text, voicemail_greeting_audio_url, weekly_digest_enabled, contact_email, owner_name, city, state, services_offered, callback_phone, ivr_enabled, ivr_prompt, call_handling_mode, agent_mode, service_catalog, selected_plan, trial_expires_at, trial_converted, cancel_at, telegram_notifications_enabled, email_notifications_enabled, gbp_place_id, gbp_summary, gbp_rating, gbp_review_count, gbp_photo_url, outbound_prompt, outbound_goal, outbound_opening, outbound_vm_script, outbound_tone'

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
        initialClientId={initialClientId}
        initialTab={initialTab}
      />
    )
  }

  const { data: client } = await supabase
    .from('clients')
    .select(SELECT)
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
