/**
 * knowledge-stats.ts — Shared queries for knowledge chunk counts.
 *
 * Single source of truth for compiled_import chunk counts used by:
 *   - welcome/page.tsx  (trial welcome readiness)
 *   - KnowledgeProvenanceCard  (knowledge source summary)
 *
 * Hard rule (Tree C): do NOT inline these queries in components. Always import here.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns the count of approved compiled_import knowledge chunks for a client.
 * Requires a server-side Supabase client (service role or authenticated).
 */
export async function getCompiledChunkCount(
  clientId: string,
  supabase: SupabaseClient,
): Promise<number> {
  const { count } = await supabase
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('source', 'compiled_import')
    .eq('status', 'approved')
  return count ?? 0
}
