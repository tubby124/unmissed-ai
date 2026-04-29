/**
 * /dashboard/admin/learning-bank
 *
 * Admin-only learning bank workflow:
 *   - Tab 1: open prompt_lessons → review, promote to pattern, or reject
 *   - Tab 2: promoted prompt_patterns → filter by category/niche, retire
 *   - Tab 3: pattern_application_log → audit trail of pattern→prompt applications
 *
 * Server component handles admin auth + initial counts. Interactive client
 * subtree handles fetching, filtering, and mutations via the API routes.
 */

import { redirect } from 'next/navigation'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import LearningBankClient from './LearningBankClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Learning Bank' }

async function safeCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: any,
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: Array<[string, any]>,
): Promise<number> {
  try {
    let q = svc.from(table).select('id', { count: 'exact', head: true })
    for (const [col, val] of filters) {
      q = q.eq(col, val)
    }
    const { count, error } = await q
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

export default async function LearningBankPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') {
    redirect('/dashboard')
  }

  const [openLessonCount, promotedPatternCount] = await Promise.all([
    safeCount(svc, 'prompt_lessons', [['status', 'open']]),
    safeCount(svc, 'prompt_patterns', [['status', 'promoted']]),
  ])

  return (
    <div className="p-3 sm:p-6 space-y-5">
      <div>
        <h1 className="text-base font-semibold t1">Learning Bank</h1>
        <p className="text-[11px] t3 mt-0.5">Admin only — review observations, promote into reusable patterns, audit applications</p>
      </div>

      <LearningBankClient
        initialOpenLessonCount={openLessonCount}
        initialPromotedPatternCount={promotedPatternCount}
      />
    </div>
  )
}
