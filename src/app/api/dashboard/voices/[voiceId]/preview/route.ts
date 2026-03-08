import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { voiceId } = await params

  const res = await fetch(
    `https://api.ultravox.ai/api/voices/${voiceId}/preview`,
    { headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! } }
  )

  if (!res.ok) return new NextResponse('Not found', { status: 404 })

  const contentType = res.headers.get('content-type') || 'audio/mpeg'
  const buffer = await res.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
