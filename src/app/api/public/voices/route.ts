import { NextResponse } from 'next/server'

const ULTRAVOX_BASE = 'https://api.ultravox.ai/api'

interface UltravoxVoice {
  voiceId: string
  name: string
  description: string
  primaryLanguage: string
  languageLabel: string
  provider: string
  previewUrl: string
}

let cachedVoices: UltravoxVoice[] | null = null
let cacheTs = 0
const CACHE_TTL = 3600_000 // 1 hour

async function fetchEnglishVoices(): Promise<UltravoxVoice[]> {
  if (cachedVoices && Date.now() - cacheTs < CACHE_TTL) return cachedVoices

  const voices: UltravoxVoice[] = []
  let nextUrl: string | null = `${ULTRAVOX_BASE}/voices?pageSize=100`

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, {
      headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
    })
    if (!res.ok) break
    const data = await res.json() as { results?: UltravoxVoice[]; next?: string }
    const english = (data.results || []).filter(
      (v: { primaryLanguage: string }) =>
        v.primaryLanguage === 'en' || v.primaryLanguage.startsWith('en-')
    )
    voices.push(...english)
    nextUrl = data.next || null
  }

  cachedVoices = voices
  cacheTs = Date.now()
  return voices
}

export async function GET() {
  const voices = await fetchEnglishVoices()

  // Strip previewUrl (requires auth) — client uses /api/public/voice-preview/[voiceId] instead
  const publicVoices = voices.map((v) => ({
    voiceId: v.voiceId,
    name: v.name,
    description: v.description || '',
    provider: v.provider || 'Unknown',
  }))

  return NextResponse.json(
    { voices: publicVoices, total: publicVoices.length },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } }
  )
}
