import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'
import BillingTab from '@/components/dashboard/settings/BillingTab'
import type { ClientConfig } from '@/app/dashboard/settings/page'

export const dynamic = 'force-dynamic'

const SELECT = 'id, slug, business_name, niche, status, system_prompt, agent_voice_id, ultravox_agent_id, twilio_number, telegram_chat_id, telegram_bot_token, telegram_style, timezone, minutes_used_this_month, seconds_used_this_month, monthly_minute_limit, updated_at, created_at, bonus_minutes, sms_enabled, sms_template, business_facts, extra_qa, forwarding_number, setup_complete, agent_name, context_data, context_data_label, google_calendar_id, booking_enabled, booking_service_duration_minutes, booking_buffer_minutes, calendar_beta_enabled, calendar_auth_status, injected_note, subscription_status, subscription_current_period_end, grace_period_end, stripe_customer_id, stripe_subscription_id, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend, transfer_conditions, voice_style_preset, website_url, website_last_scraped_at, website_scrape_status, website_scrape_error, website_scrape_pages, website_knowledge_preview, website_knowledge_approved, stripe_discount_name, effective_monthly_rate, voicemail_greeting_text, voicemail_greeting_audio_url, weekly_digest_enabled, contact_email, owner_name, city, state, services_offered, callback_phone, ivr_enabled, ivr_prompt, call_handling_mode, agent_mode, service_catalog, selected_plan, trial_expires_at, trial_converted, cancel_at, telegram_notifications_enabled, email_notifications_enabled, gbp_place_id, gbp_summary, gbp_rating, gbp_review_count, gbp_photo_url, outbound_prompt, outbound_goal, outbound_opening, outbound_vm_script, outbound_tone'

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ client_id?: string }>
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
  const targetClientId = isAdmin ? (params?.client_id ?? null) : cu.client_id

  if (!targetClientId) {
    return (
      <div className="p-3 sm:p-6">
        <h1 className="text-base font-semibold t1 mb-2">Billing</h1>
        <p className="text-sm t3">Select a client to view billing.</p>
      </div>
    )
  }

  const { data: client } = await supabase
    .from('clients')
    .select(SELECT)
    .eq('id', targetClientId)
    .single()

  if (!client) redirect('/dashboard')

  const minutesUsed = client.seconds_used_this_month != null
    ? Math.ceil(client.seconds_used_this_month / 60)
    : (client.minutes_used_this_month ?? 0)
  const minuteLimit = client.monthly_minute_limit ?? DEFAULT_MINUTE_LIMIT
  const totalAvailable = minuteLimit + (client.bonus_minutes ?? 0)
  const usagePct = totalAvailable > 0 ? (minutesUsed / totalAvailable) * 100 : 0

  return (
    <div className="p-3 sm:p-6 space-y-5">
      <div>
        <h1 className="text-base font-semibold t1">Billing</h1>
        <p className="text-[11px] t3 mt-0.5">Plan, usage, and payment details</p>
      </div>
      <BillingTab
        client={client as ClientConfig}
        isAdmin={isAdmin}
        minutesUsed={minutesUsed}
        minuteLimit={minuteLimit}
        totalAvailable={totalAvailable}
        usagePct={usagePct}
      />
    </div>
  )
}
