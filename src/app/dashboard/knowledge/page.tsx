import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import KnowledgePageView from './KnowledgePageView'

export const dynamic = 'force-dynamic'

const SELECT = 'id, slug, business_name, niche, status, system_prompt, agent_voice_id, ultravox_agent_id, twilio_number, telegram_chat_id, telegram_bot_token, telegram_style, timezone, minutes_used_this_month, seconds_used_this_month, monthly_minute_limit, updated_at, created_at, bonus_minutes, sms_enabled, sms_template, business_facts, extra_qa, forwarding_number, setup_complete, agent_name, context_data, context_data_label, google_calendar_id, booking_enabled, booking_service_duration_minutes, booking_buffer_minutes, calendar_beta_enabled, calendar_auth_status, injected_note, subscription_status, subscription_current_period_end, grace_period_end, stripe_customer_id, stripe_subscription_id, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend, transfer_conditions, voice_style_preset, website_url, website_last_scraped_at, website_scrape_status, website_scrape_error, website_scrape_pages, website_knowledge_preview, website_knowledge_approved, stripe_discount_name, effective_monthly_rate, voicemail_greeting_text, voicemail_greeting_audio_url, weekly_digest_enabled, contact_email, owner_name, city, state, services_offered, callback_phone, ivr_enabled, ivr_prompt, selected_plan, trial_expires_at, trial_converted'

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams?: Promise<{ client_id?: string; preview?: string }>
}) {
  const params = searchParams ? await searchParams : {}
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
  const isPreview = params.preview === 'true' && typeof params.client_id === 'string'

  if (isAdmin) {
    const { data: clients } = await supabase
      .from('clients')
      .select(SELECT)
      .order('business_name')

    return (
      <KnowledgePageView
        clients={(clients ?? []) as ClientConfig[]}
        isAdmin={true}
        previewMode={isPreview}
        initialClientId={params.client_id}
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
    <KnowledgePageView
      clients={[client as ClientConfig]}
      isAdmin={false}
    />
  )
}
