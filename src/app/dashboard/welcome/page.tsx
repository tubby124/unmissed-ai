import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { buildClientAgentConfig } from '@/lib/build-client-agent-config'
import { buildTrialWelcomeViewModel } from '@/lib/build-trial-welcome-view-model'
import { getCompiledChunkCount } from '@/lib/knowledge-stats'
import WelcomeView from './WelcomeView'

export const dynamic = 'force-dynamic'

export default async function WelcomePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) redirect('/login')
  // Admins don't have a trial — redirect to command center
  if (cu.role === 'admin') redirect('/dashboard')

  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, business_name, niche, status, subscription_status, trial_expires_at, agent_name, agent_voice_id, voice_style_preset, forwarding_number, transfer_conditions, booking_enabled, sms_enabled, knowledge_backend, business_facts, extra_qa, business_hours_weekday, business_hours_weekend, after_hours_behavior, website_url, website_scrape_status, ultravox_agent_id, setup_complete, selected_plan, monthly_minute_limit, calendar_auth_status, gbp_place_id, gbp_rating, gbp_review_count, gbp_photo_url, gbp_summary')
    .eq('id', cu.client_id)
    .single()

  if (!client) redirect('/dashboard')

  const c = client as Record<string, unknown>

  // Non-trial users → back to main dashboard
  if (c.subscription_status !== 'trialing') redirect('/dashboard')

  const config = buildClientAgentConfig({
    id: client.id,
    slug: c.slug as string ?? client.id,
    business_name: client.business_name,
    niche: client.niche,
    website_url: c.website_url as string | null,
    website_scrape_status: c.website_scrape_status as string | null,
    booking_enabled: client.booking_enabled,
    sms_enabled: c.sms_enabled as boolean | null,
    forwarding_number: c.forwarding_number as string | null,
    transfer_conditions: c.transfer_conditions as string | null,
    knowledge_backend: c.knowledge_backend as string | null,
    business_facts: c.business_facts as string | null,
    extra_qa: c.extra_qa as { q: string; a: string }[] | null,
    business_hours_weekday: c.business_hours_weekday as string | null,
    business_hours_weekend: c.business_hours_weekend as string | null,
    after_hours_behavior: c.after_hours_behavior as string | null,
    voice_style_preset: c.voice_style_preset as string | null,
    agent_voice_id: c.agent_voice_id as string | null,
    agent_name: client.agent_name,
    subscription_status: c.subscription_status as string | null,
    trial_expires_at: c.trial_expires_at as string | null,
    setup_complete: c.setup_complete as boolean | null,
    monthly_minute_limit: client.monthly_minute_limit,
    selected_plan: c.selected_plan as string | null,
    gbp_place_id: c.gbp_place_id as string | null,
    gbp_rating: c.gbp_rating as number | null,
    gbp_review_count: c.gbp_review_count as number | null,
    gbp_photo_url: c.gbp_photo_url as string | null,
    gbp_summary: c.gbp_summary as string | null,
  })

  const compiledCount = await getCompiledChunkCount(cu.client_id, supabase)

  const trialWelcome = buildTrialWelcomeViewModel(config, !!c.ultravox_agent_id, new Date(), compiledCount)

  return (
    <WelcomeView
      clientId={client.id}
      trialWelcome={trialWelcome}
      clientStatus={c.status as string | null}
      hasAgent={!!c.ultravox_agent_id}
      hasBooking={!!(client.booking_enabled && c.calendar_auth_status === 'connected')}
    />
  )
}
