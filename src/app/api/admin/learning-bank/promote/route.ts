/**
 * POST /api/admin/learning-bank/promote
 *
 * Body:
 *   {
 *     lesson_id: uuid,
 *     pattern: {
 *       name: string,
 *       category: string,
 *       verbatim_line: string,
 *       rationale: string,
 *       niche_applicability: string[],
 *       score?: number,
 *       notes?: string
 *     }
 *   }
 *
 * Side effects:
 *   1. Insert prompt_patterns row (status='promoted', promoted_at=now, promoted_by=auth.uid)
 *   2. Update prompt_lessons row (status='promoted', promoted_pattern_id=<new id>, reviewed_at=now)
 *
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    lesson_id?: string
    pattern?: {
      name?: string
      category?: string
      verbatim_line?: string
      rationale?: string
      niche_applicability?: string[]
      score?: number
      notes?: string
    }
  }

  if (!body.lesson_id || typeof body.lesson_id !== 'string') {
    return NextResponse.json({ error: 'lesson_id required' }, { status: 400 })
  }
  const p = body.pattern
  if (!p || !p.name || !p.category || !p.verbatim_line || !p.rationale) {
    return NextResponse.json(
      { error: 'pattern.{name, category, verbatim_line, rationale} required' },
      { status: 400 },
    )
  }
  const niches = Array.isArray(p.niche_applicability) && p.niche_applicability.length > 0
    ? p.niche_applicability
    : ['all']

  // Look up the lesson to get source slug + call id (for provenance)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lesson, error: lessonErr } = await (svc as any)
    .from('prompt_lessons')
    .select('id, client_id, call_id, status, clients:client_id ( slug )')
    .eq('id', body.lesson_id)
    .maybeSingle()

  if (lessonErr) {
    return NextResponse.json({ error: lessonErr.message }, { status: 500 })
  }
  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  const sourceSlug = (lesson.clients as { slug?: string } | null)?.slug ?? null
  const sourceCallId = lesson.call_id ?? null
  const nowIso = new Date().toISOString()

  // 1. Insert pattern
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pattern, error: insertErr } = await (svc as any)
    .from('prompt_patterns')
    .insert({
      name: p.name,
      category: p.category,
      verbatim_line: p.verbatim_line,
      rationale: p.rationale,
      niche_applicability: niches,
      source_slug: sourceSlug,
      source_call_id: sourceCallId,
      status: 'promoted',
      score: typeof p.score === 'number' ? p.score : 0,
      promoted_at: nowIso,
      promoted_by: user.id,
      notes: p.notes ?? null,
    })
    .select()
    .maybeSingle()

  if (insertErr || !pattern) {
    return NextResponse.json(
      { error: insertErr?.message ?? 'Failed to insert pattern' },
      { status: 500 },
    )
  }

  // 2. Update lesson → promoted, link pattern
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (svc as any)
    .from('prompt_lessons')
    .update({
      status: 'promoted',
      promoted_pattern_id: pattern.id,
      reviewed_at: nowIso,
      reviewed_by: user.id,
    })
    .eq('id', body.lesson_id)

  if (updateErr) {
    // Best-effort: pattern is already inserted; surface the warning but include pattern
    return NextResponse.json(
      { ok: true, pattern, warning: `Pattern created but lesson update failed: ${updateErr.message}` },
    )
  }

  return NextResponse.json({ ok: true, pattern })
}
