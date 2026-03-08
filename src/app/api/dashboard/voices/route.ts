import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ULTRAVOX_BASE = 'https://api.ultravox.ai/api'

async function fetchAllEnglishVoices() {
  const voices: object[] = []
  let nextUrl: string | null = `${ULTRAVOX_BASE}/voices?pageSize=100`

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, {
      headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
      next: { revalidate: 3600 },
    } as RequestInit)
    if (!res.ok) break
    const data: { results: { primaryLanguage: string }[]; next: string | null } = await res.json()
    const english = (data.results || []).filter(
      v => v.primaryLanguage === 'en' || v.primaryLanguage.startsWith('en-')
    )
    voices.push(...english)
    nextUrl = data.next || null
  }

  return voices
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  const isAdmin = cu?.role === 'admin'

  const voices = await fetchAllEnglishVoices()

  let clients: object[] = []
  let myVoiceId: string | null = null

  if (isAdmin) {
    const { data } = await supabase
      .from('clients')
      .select('id, slug, business_name, agent_voice_id, ultravox_agent_id')
      .order('business_name')
    clients = data || []
  } else if (cu?.client_id) {
    const { data } = await supabase
      .from('clients')
      .select('agent_voice_id')
      .eq('id', cu.client_id)
      .single()
    myVoiceId = data?.agent_voice_id ?? null
  }

  return NextResponse.json({ voices, clients, isAdmin, myVoiceId })
}
