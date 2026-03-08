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

  const isAdmin = user.email === process.env.ADMIN_EMAIL

  const voices = await fetchAllEnglishVoices()

  let clients: object[] = []
  if (isAdmin) {
    const { data } = await supabase
      .from('clients')
      .select('id, slug, business_name, agent_voice_id, ultravox_agent_id')
      .order('business_name')
    clients = data || []
  }

  return NextResponse.json({ voices, clients, isAdmin })
}
