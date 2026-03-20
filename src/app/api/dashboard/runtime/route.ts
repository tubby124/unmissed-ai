import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ULTRAVOX_BASE = 'https://api.ultravox.ai/api'

interface RuntimeResponse {
  promptLength: number
  toolCount: number
  tools: string[]
  maxDuration: string
  vadSettings: Record<string, unknown> | null
  inactivityMessages: Array<Record<string, unknown>>
  firstSpeakerSettings: Record<string, unknown> | null
  voice: string | null
  totalCalls: number
  recordingEnabled: boolean
  stale?: boolean
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return NextResponse.json({ error: 'No client found' }, { status: 404 })

  const clientId = req.nextUrl.searchParams.get('client_id')
  let targetClientId = cu.client_id
  if (cu.role === 'admin' && clientId) {
    targetClientId = clientId
  }

  // Fetch the Ultravox agent ID for this client
  const { data: clientRow } = await supabase
    .from('clients')
    .select('ultravox_agent_id')
    .eq('id', targetClientId)
    .single()

  if (!clientRow?.ultravox_agent_id) {
    return NextResponse.json({ error: 'No Ultravox agent configured' }, { status: 404 })
  }

  const uvKey = process.env.ULTRAVOX_API_KEY
  if (!uvKey) {
    return NextResponse.json({ error: 'Ultravox API key not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`${ULTRAVOX_BASE}/agents/${clientRow.ultravox_agent_id}`, {
      headers: { 'X-API-Key': uvKey },
    })

    if (!res.ok) {
      const empty: RuntimeResponse = {
        promptLength: 0,
        toolCount: 0,
        tools: [],
        maxDuration: 'unknown',
        vadSettings: null,
        inactivityMessages: [],
        firstSpeakerSettings: null,
        voice: null,
        totalCalls: 0,
        recordingEnabled: false,
        stale: true,
      }
      return NextResponse.json(empty)
    }

    const agent = await res.json() as {
      systemPrompt?: string
      callTemplate?: {
        selectedTools?: Array<{ temporaryTool?: { modelToolName?: string }; toolName?: string }>
        maxDuration?: string
        vadSettings?: Record<string, unknown>
        inactivityMessages?: Array<Record<string, unknown>>
        firstSpeakerSettings?: Record<string, unknown>
        voice?: string
        recordingEnabled?: boolean
      }
      totalCalls?: number
    }

    const ct = agent.callTemplate ?? {}
    const selectedTools = ct.selectedTools ?? []

    const toolNames = selectedTools.map(t => {
      if (t.temporaryTool?.modelToolName) return t.temporaryTool.modelToolName
      if (t.toolName) return t.toolName
      return 'unknown'
    })

    const runtime: RuntimeResponse = {
      promptLength: (agent.systemPrompt ?? '').length,
      toolCount: selectedTools.length,
      tools: toolNames,
      maxDuration: ct.maxDuration ?? '600s',
      vadSettings: ct.vadSettings ?? null,
      inactivityMessages: ct.inactivityMessages ?? [],
      firstSpeakerSettings: ct.firstSpeakerSettings ?? null,
      voice: ct.voice ?? null,
      totalCalls: agent.totalCalls ?? 0,
      recordingEnabled: ct.recordingEnabled ?? false,
    }

    return NextResponse.json(runtime)
  } catch {
    const empty: RuntimeResponse = {
      promptLength: 0,
      toolCount: 0,
      tools: [],
      maxDuration: 'unknown',
      vadSettings: null,
      inactivityMessages: [],
      firstSpeakerSettings: null,
      voice: null,
      totalCalls: 0,
      recordingEnabled: false,
      stale: true,
    }
    return NextResponse.json(empty)
  }
}
