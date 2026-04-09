import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import AgentPageView from './AgentPageView'

// Phase E.5 Wave 4 — unhide /dashboard/agent.
// Pre-E.5 this redirected to /dashboard?tab=overview&section=identity, making
// AgentPageView (and the Phase E Wave 3 Day-1 edit panel inside it) orphan
// code. Sidebar/MobileNav/settings link here → now they resolve to a real view.

export const dynamic = 'force-dynamic'

const SELECT =
  'id, slug, business_name, niche, status, system_prompt, agent_voice_id, ultravox_agent_id, twilio_number, telegram_chat_id, telegram_bot_token, telegram_registration_token, telegram_style, timezone, minutes_used_this_month, seconds_used_this_month, monthly_minute_limit, updated_at, created_at, bonus_minutes, sms_enabled, sms_template, business_facts, extra_qa, forwarding_number, setup_complete, agent_name, context_data, context_data_label, google_calendar_id, booking_enabled, booking_service_duration_minutes, booking_buffer_minutes, calendar_beta_enabled, calendar_auth_status, injected_note, subscription_status, subscription_current_period_end, grace_period_end, stripe_customer_id, stripe_subscription_id, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend, transfer_conditions, voice_style_preset, website_url, website_last_scraped_at, website_scrape_status, website_scrape_error, website_scrape_pages, website_knowledge_preview, website_knowledge_approved, stripe_discount_name, effective_monthly_rate, voicemail_greeting_text, voicemail_greeting_audio_url, weekly_digest_enabled, contact_email, owner_name, city, state, services_offered, callback_phone, ivr_enabled, ivr_prompt, call_handling_mode, agent_mode, service_catalog, selected_plan, trial_expires_at, trial_converted, cancel_at, telegram_notifications_enabled, email_notifications_enabled, gbp_place_id, gbp_summary, gbp_rating, gbp_review_count, gbp_photo_url, outbound_prompt, outbound_goal, outbound_opening, outbound_vm_script, outbound_tone, outbound_notes, staff_roster, niche_custom_variables, last_agent_sync_at, last_agent_sync_status, today_update, business_notes, unknown_answer_behavior, pricing_policy, calendar_mode, fields_to_collect, hand_tuned'

export default async function AgentPage({
  searchParams,
}: {
  searchParams?: Promise<{ client_id?: string; preview?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const initialClientId = params?.client_id
  const previewMode = params?.preview === 'true'

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()

  if (!cu) redirect('/login')

  const isAdmin = cu.role === 'admin'

  if (isAdmin) {
    const { data: clients } = await supabase
      .from('clients')
      .select(SELECT)
      .order('business_name')

    return (
      <AgentPageView
        clients={(clients ?? []) as ClientConfig[]}
        isAdmin={true}
        previewMode={previewMode}
        initialClientId={initialClientId}
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
    <AgentPageView
      clients={[client as ClientConfig]}
      isAdmin={false}
      previewMode={previewMode}
      initialClientId={initialClientId}
    />
  )
}
