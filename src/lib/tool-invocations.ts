import { createServiceClient } from '@/lib/supabase/server'
import { recordClientEvent } from '@/lib/client-events'

// D-NEW-tool-invocation-log — single fire-and-forget insert into public.tool_invocations.
// Why: Phase 9 D270 (frequent KB query → auto-suggest FAQ) needs structured per-fire data
// across queryKnowledge + the other agent tools. Without this row, the promotion job has
// no signal. Logging MUST NOT block the tool response (voice agent latency budget is tight).
//
// Caller pattern (fire-and-forget):
//   const startedAt = Date.now()
//   const result = await doToolWork()
//   void recordToolInvocation({
//     clientId, callLogId, toolName: 'queryKnowledge', queryText: query,
//     chunkIdsHit: result.chunkIds, success: true,
//     latencyMs: Date.now() - startedAt,
//   })
//   return NextResponse.json(result)
//
// Migration: supabase/migrations/20260506000000_create_tool_invocations.sql
// Architecture: ~/.claude/projects/-Users-owner/memory/unmissed-knowledge-tier-architecture.md

const QUERY_TEXT_MAX_BYTES = 4096

export interface ToolInvocationEntry {
  clientId: string
  callLogId?: string | null
  toolName: string
  queryText?: string | null
  chunkIdsHit?: string[] | null
  success?: boolean
  latencyMs?: number | null
}

function capQueryText(text: string | null | undefined): string | null {
  if (!text) return null
  if (text.length <= QUERY_TEXT_MAX_BYTES) return text
  return text.slice(0, QUERY_TEXT_MAX_BYTES)
}

export async function recordToolInvocation(entry: ToolInvocationEntry): Promise<void> {
  try {
    const svc = createServiceClient()
    await svc.from('tool_invocations').insert({
      client_id: entry.clientId,
      call_log_id: entry.callLogId ?? null,
      tool_name: entry.toolName,
      query_text: capQueryText(entry.queryText),
      chunk_ids_hit: entry.chunkIdsHit ?? null,
      success: entry.success ?? true,
      latency_ms: entry.latencyMs ?? null,
    })
    void recordClientEvent(svc, {
      clientId: entry.clientId,
      eventType: 'tool.invoked',
      eventGroup: 'runtime',
      actorType: 'webhook',
      source: 'tool-invocations',
      callLogId: entry.callLogId ?? null,
      status: entry.success === false ? 'error' : 'success',
      severity: entry.success === false ? 'warning' : 'info',
      visibility: 'admin_only',
      summary: `Tool invoked: ${entry.toolName}`,
      details: {
        tool_name: entry.toolName,
        success: entry.success ?? true,
        latency_ms: entry.latencyMs ?? null,
        query_text_length: entry.queryText?.length ?? 0,
        chunk_count: entry.chunkIdsHit?.length ?? 0,
      },
    })
  } catch {
    // intentionally swallowed — invocation logging must never break the tool response
  }
}
