/**
 * S7f: Shared utility for inserting prompt_versions rows with full audit trail.
 *
 * Extracted from 8 duplicate insert sites across the codebase.
 * All prompt version inserts MUST go through this utility to ensure
 * audit columns (triggered_by_user_id, triggered_by_role, char_count,
 * prev_char_count) are always populated.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface InsertPromptVersionParams {
  clientId: string
  content: string
  changeDescription: string
  /** Auth user ID — null for system-triggered actions (e.g. Stripe checkout) */
  triggeredByUserId: string | null
  /** 'admin' | 'owner' | 'system' */
  triggeredByRole: string
  /** Previous prompt char count for delta tracking. null if first version. */
  prevCharCount: number | null
  /** Explicit version number. If omitted, auto-increments from latest. */
  version?: number
}

export interface InsertPromptVersionResult {
  id: string
  version: number
}

/**
 * Deactivates all existing versions for the client, then inserts a new
 * prompt_versions row with full audit trail. Returns the new row's id + version.
 */
export async function insertPromptVersion(
  svc: SupabaseClient,
  params: InsertPromptVersionParams,
): Promise<InsertPromptVersionResult | null> {
  const {
    clientId,
    content,
    changeDescription,
    triggeredByUserId,
    triggeredByRole,
    prevCharCount,
  } = params

  // Resolve version number
  let version = params.version
  if (version === undefined) {
    const { data: latest } = await svc
      .from('prompt_versions')
      .select('version')
      .eq('client_id', clientId)
      .order('version', { ascending: false })
      .limit(1)
      .single()
    version = (latest?.version ?? 0) + 1
  }

  // Deactivate all existing versions for this client
  await svc.from('prompt_versions').update({ is_active: false }).eq('client_id', clientId)

  // Insert new version with audit trail
  const { data: row } = await svc
    .from('prompt_versions')
    .insert({
      client_id: clientId,
      version,
      content,
      change_description: changeDescription,
      is_active: true,
      triggered_by_user_id: triggeredByUserId,
      triggered_by_role: triggeredByRole,
      char_count: content.length,
      prev_char_count: prevCharCount,
    })
    .select('id')
    .single()

  return row ? { id: row.id, version: version! } : null
}
