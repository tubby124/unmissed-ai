import { redirect } from 'next/navigation'

// Intent-preserving redirect from the old /dashboard/agent route.
// Content has been absorbed into /dashboard (Phase 3 of the dashboard redesign).
// Old URL                                  → New URL
// /dashboard/agent                         → /dashboard?tab=overview&section=identity
// /dashboard/agent?voice=1                 → /dashboard?tab=overview&section=call-handling&sheet=voice
// /dashboard/agent?client_id=X&preview=…  → /dashboard?tab=overview&section=identity&client_id=X&preview=…

export const dynamic = 'force-dynamic'

export default async function AgentPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const section = params.voice ? 'call-handling' : 'identity'

  const extras: string[] = [`tab=overview`, `section=${section}`]
  if (params.voice) extras.push('sheet=voice')
  if (params.client_id) extras.push(`client_id=${encodeURIComponent(params.client_id)}`)
  if (params.preview) extras.push(`preview=${encodeURIComponent(params.preview)}`)

  redirect(`/dashboard?${extras.join('&')}`)
}
