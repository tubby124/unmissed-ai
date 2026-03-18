import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface EscalationBody {
  reason: string
  callerName: string
  summary: string
}

function buildEscalationPrompt(
  client: { system_prompt: string | null; business_name: string | null },
  body: EscalationBody
): string {
  const base = client.system_prompt || ''
  return `You are now in SUPERVISOR MODE. A customer has been escalated to you.

ESCALATION DETAILS:
- Caller: ${body.callerName}
- Reason: ${body.reason}
- Summary of conversation so far: ${body.summary}

SUPERVISOR GUIDELINES:
- Acknowledge the caller's frustration empathetically
- You have authority to offer solutions, discounts, or schedule callbacks with the owner
- Be calm, professional, and solution-oriented
- If you cannot resolve the issue, offer to have the business owner call them back personally

${base}`
}

export function buildEscalationTool(slug: string): object {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'
  return {
    temporaryTool: {
      modelToolName: 'escalateToManager',
      description:
        'Escalate to a supervisor. Use when the caller is upset, requests a refund, wants to speak to a manager, or has a complaint you cannot resolve.',
      timeout: '10s',
      dynamicParameters: [
        {
          name: 'reason',
          location: 'PARAMETER_LOCATION_BODY',
          schema: { type: 'string', description: 'Why the caller is being escalated' },
          required: true,
        },
        {
          name: 'callerName',
          location: 'PARAMETER_LOCATION_BODY',
          schema: { type: 'string', description: "The caller's name" },
          required: true,
        },
        {
          name: 'summary',
          location: 'PARAMETER_LOCATION_BODY',
          schema: { type: 'string', description: 'Brief summary of the conversation so far' },
          required: true,
        },
      ],
      http: {
        baseUrlPattern: `${appUrl}/api/stages/${slug}/escalate`,
        httpMethod: 'POST',
      },
    },
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const body: EscalationBody = await req.json().catch(() => ({
    reason: 'unknown',
    callerName: 'unknown',
    summary: '',
  }))

  if (!body.reason || !body.callerName) {
    return NextResponse.json(
      { error: 'Missing required fields: reason, callerName' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, system_prompt, business_name')
    .eq('slug', slug)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const escalationPrompt = buildEscalationPrompt(client, body)

  // Log stage transition in call_stages table
  // Note: ultravox_call_id not available here (Ultravox doesn't pass it to tool endpoints
  // unless wired via automaticParameters). We log what we can.
  await supabase.from('call_stages').insert({
    stage_index: 1,
    stage_type: 'escalation',
    trigger_reason: body.reason,
  })

  const response = NextResponse.json({
    systemPrompt: escalationPrompt,
    toolResultText: `Escalated to supervisor mode. Reason: ${body.reason}. I'll handle this with extra care.`,
  })
  response.headers.set('X-Ultravox-Response-Type', 'new-stage')
  return response
}
