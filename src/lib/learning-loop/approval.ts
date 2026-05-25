import type { SupabaseClient } from '@supabase/supabase-js'
import { recomposePrompt } from '@/lib/slot-regenerator'
import { buildAgentTools, updateAgent } from '@/lib/ultravox'
import { insertPromptVersion } from '@/lib/prompt-version-utils'

export type LearningLoopRisk = 'low' | 'medium' | 'high'
export type LearningLoopPatchType = 'extra_qa_append' | 'business_fact_append' | 'system_prompt_append'
export type LearningLoopDecision = 'approve' | 'reject'

export interface LearningLoopSuggestionRow {
  id: string
  client_id: string
  source_call_id?: string | null
  category: string
  risk_level: LearningLoopRisk
  patch_type: LearningLoopPatchType
  status: string
  title: string
  summary: string
  evidence: Record<string, unknown> | null
  proposed_patch: Record<string, unknown> | null
}

interface ClientForLearningLoop {
  id: string
  slug: string
  business_name: string | null
  system_prompt: string | null
  extra_qa: unknown
  business_facts: string | null
  telegram_chat_id: string | null
  ultravox_agent_id: string | null
  tools: object[] | null
  agent_voice_id: string | null
  booking_enabled: boolean | null
  forwarding_number: string | null
  sms_enabled: boolean | null
  twilio_number: string | null
  knowledge_backend: string | null
  transfer_conditions: string | null
  selected_plan: string | null
  subscription_status: string | null
  niche: string | null
}

export function canClientApproveSuggestion(s: Pick<LearningLoopSuggestionRow, 'risk_level' | 'patch_type'>): boolean {
  if (s.risk_level !== 'low') return false
  return s.patch_type === 'extra_qa_append' || s.patch_type === 'business_fact_append'
}

export function renderLearningLoopTelegramMessage(s: LearningLoopSuggestionRow): string {
  const patch = s.proposed_patch ?? {}
  const suggested = typeof patch.answer === 'string'
    ? patch.answer
    : typeof patch.text === 'string'
      ? patch.text
      : s.summary
  const evidence = s.evidence?.quote && typeof s.evidence.quote === 'string'
    ? `\n\n<b>Call evidence:</b> “${escapeHtml(s.evidence.quote.slice(0, 400))}”`
    : ''

  return [
    '🧠 <b>Suggested agent improvement</b>',
    '',
    `<b>${escapeHtml(s.title)}</b>`,
    escapeHtml(s.summary),
    evidence,
    '',
    '<b>Suggested update:</b>',
    escapeHtml(String(suggested).slice(0, 900)),
    '',
    canClientApproveSuggestion(s)
      ? 'Approve this update?'
      : 'This needs operator review before it can be applied.',
  ].filter(Boolean).join('\n')
}

export function buildLearningLoopKeyboard(id: string, approvable: boolean) {
  if (!approvable) {
    return { inline_keyboard: [[{ text: '👀 Needs review', callback_data: `noop:ll:${id.slice(0, 8)}` }]] }
  }
  return {
    inline_keyboard: [[
      { text: '✅ Approve', callback_data: `ll:approve:${id}` },
      { text: '❌ Reject', callback_data: `ll:reject:${id}` },
    ]],
  }
}

export async function handleLearningLoopDecision(
  supa: SupabaseClient,
  params: { suggestionId: string; chatId: number; decision: LearningLoopDecision },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const { data: suggestion, error: suggestionError } = await supa
    .from('learning_loop_suggestions')
    .select('*')
    .eq('id', params.suggestionId)
    .maybeSingle()

  if (suggestionError || !suggestion) {
    return { ok: false, message: 'That suggestion no longer exists.' }
  }
  const s = suggestion as LearningLoopSuggestionRow

  const { data: client, error: clientError } = await supa
    .from('clients')
    .select('id, slug, business_name, system_prompt, extra_qa, business_facts, telegram_chat_id, ultravox_agent_id, tools, agent_voice_id, booking_enabled, forwarding_number, sms_enabled, twilio_number, knowledge_backend, transfer_conditions, selected_plan, subscription_status, niche')
    .eq('id', s.client_id)
    .maybeSingle()

  if (clientError || !client) return { ok: false, message: 'Could not verify the client for this suggestion.' }
  const c = client as ClientForLearningLoop

  if (String(c.telegram_chat_id) !== String(params.chatId)) {
    return { ok: false, message: 'This suggestion belongs to a different Telegram chat.' }
  }

  if (!['pending', 'sent_to_client'].includes(s.status)) {
    return { ok: false, message: `This suggestion is already ${s.status}.` }
  }

  if (params.decision === 'reject') {
    await supa.from('learning_loop_suggestions').update({
      status: 'rejected',
      decided_by_chat_id: String(params.chatId),
      decided_at: new Date().toISOString(),
    }).eq('id', s.id)
    return { ok: true, message: 'Rejected — nothing changed.' }
  }

  if (!canClientApproveSuggestion(s)) {
    await supa.from('learning_loop_suggestions').update({
      status: 'needs_operator_review',
      decided_by_chat_id: String(params.chatId),
      decided_at: new Date().toISOString(),
      error: 'Client approval blocked by risk policy',
    }).eq('id', s.id)
    return { ok: false, message: 'This one needs operator review before I can apply it.' }
  }

  const applied = await applyApprovedSuggestion(supa, s, c, params.chatId)
  return applied
}

async function applyApprovedSuggestion(
  supa: SupabaseClient,
  s: LearningLoopSuggestionRow,
  c: ClientForLearningLoop,
  chatId: number,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  try {
    ensureClientPromptCanRecompose(c)

    if (s.patch_type === 'extra_qa_append') {
      const q = stringField(s.proposed_patch, 'question')
      const a = stringField(s.proposed_patch, 'answer')
      if (!q || !a) throw new Error('extra_qa_append requires question and answer')
      const extraQa = normalizeExtraQa(c.extra_qa)
      if (!extraQa.some(item => item.q.toLowerCase() === q.toLowerCase())) {
        extraQa.push({ q, a })
      }
      const { error } = await supa.from('clients').update({ extra_qa: extraQa }).eq('id', c.id)
      if (error) throw new Error(error.message)
      await assertRecomposed(c.id)
    } else if (s.patch_type === 'business_fact_append') {
      const text = stringField(s.proposed_patch, 'text')
      if (!text) throw new Error('business_fact_append requires text')
      const current = c.business_facts?.trim() ?? ''
      const nextFacts = current.includes(text) ? current : [current, `- ${text}`].filter(Boolean).join('\n')
      const { error } = await supa.from('clients').update({ business_facts: nextFacts }).eq('id', c.id)
      if (error) throw new Error(error.message)
      await assertRecomposed(c.id)
    } else {
      throw new Error('system_prompt_append is not client-approvable in MVP')
    }

    await supa.from('learning_loop_suggestions').update({
      status: 'applied',
      decided_by_chat_id: String(chatId),
      decided_at: new Date().toISOString(),
      applied_at: new Date().toISOString(),
      error: null,
    }).eq('id', s.id)

    return { ok: true, message: '✅ Approved and applied. Your agent has been updated.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supa.from('learning_loop_suggestions').update({
      status: 'failed',
      decided_by_chat_id: String(chatId),
      decided_at: new Date().toISOString(),
      error: message,
    }).eq('id', s.id)
    return { ok: false, message: `I couldn't apply that safely: ${message}` }
  }
}

export async function applySystemPromptAppendForOperator(
  supa: SupabaseClient,
  s: LearningLoopSuggestionRow,
  c: ClientForLearningLoop,
): Promise<void> {
  const text = stringField(s.proposed_patch, 'text')
  if (!text) throw new Error('system_prompt_append requires text')
  const currentPrompt = c.system_prompt ?? ''
  if (!currentPrompt.trim()) throw new Error('client has no system_prompt')
  const blockTitle = '## LEARNING LOOP APPROVED UPDATES'
  const nextPrompt = currentPrompt.includes(text)
    ? currentPrompt
    : `${currentPrompt.trim()}\n\n${blockTitle}\n- ${text.trim()}\n`

  const { error } = await supa.from('clients').update({
    system_prompt: nextPrompt,
    updated_at: new Date().toISOString(),
  }).eq('id', c.id)
  if (error) throw new Error(error.message)

  const version = await insertPromptVersion(supa, {
    clientId: c.id,
    content: nextPrompt,
    changeDescription: `Learning Loop: ${s.title}`,
    triggeredByUserId: null,
    triggeredByRole: 'system',
    prevCharCount: currentPrompt.length,
  })

  if (c.ultravox_agent_id) {
    await updateAgent(c.ultravox_agent_id, {
      systemPrompt: nextPrompt,
      voice: c.agent_voice_id,
      tools: c.tools ?? undefined,
      slug: c.slug,
      booking_enabled: c.booking_enabled ?? false,
      forwarding_number: c.forwarding_number ?? undefined,
      sms_enabled: c.sms_enabled ?? false,
      twilio_number: c.twilio_number,
      knowledge_backend: c.knowledge_backend,
      knowledge_chunk_count: 0,
      transfer_conditions: c.transfer_conditions,
      selectedPlan: c.selected_plan,
      subscriptionStatus: c.subscription_status,
      niche: c.niche,
    })
    const syncTools = buildAgentTools({
      tools: c.tools ?? undefined,
      slug: c.slug,
      booking_enabled: c.booking_enabled ?? false,
      forwarding_number: c.forwarding_number ?? undefined,
      sms_enabled: c.sms_enabled ?? false,
      twilio_number: c.twilio_number,
      knowledge_backend: c.knowledge_backend,
      knowledge_chunk_count: 0,
      transfer_conditions: c.transfer_conditions,
      selectedPlan: c.selected_plan,
      subscriptionStatus: c.subscription_status,
      niche: c.niche,
    })
    await supa.from('clients').update({ tools: syncTools }).eq('id', c.id)
  }

  await supa.from('learning_loop_suggestions').update({
    status: 'applied',
    applied_at: new Date().toISOString(),
    applied_prompt_version_id: version?.id ?? null,
    error: null,
  }).eq('id', s.id)
}

function stringField(obj: Record<string, unknown> | null | undefined, key: string): string {
  const value = obj?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function ensureClientPromptCanRecompose(client: ClientForLearningLoop): void {
  if (!client.system_prompt?.includes('<!-- unmissed:identity -->')) {
    throw new Error('This agent needs a one-time prompt migration before Telegram-approved updates can auto-apply.')
  }
}

async function assertRecomposed(clientId: string): Promise<void> {
  const result = await recomposePrompt(clientId, null, false, false)
  if (!result.success) {
    throw new Error(result.error ?? 'prompt recompose failed')
  }
}

function normalizeExtraQa(value: unknown): Array<{ q: string; a: string }> {
  if (!Array.isArray(value)) return []
  return value
    .map(item => {
      if (!item || typeof item !== 'object') return null
      const rec = item as Record<string, unknown>
      const q = typeof rec.q === 'string' ? rec.q.trim() : ''
      const a = typeof rec.a === 'string' ? rec.a.trim() : ''
      return q && a ? { q, a } : null
    })
    .filter((item): item is { q: string; a: string } => Boolean(item))
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
