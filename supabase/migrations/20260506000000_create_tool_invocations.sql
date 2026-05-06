-- D-NEW-tool-invocation-log: per-fire log of every voice-agent tool invocation
-- Why: Phase 9 D270 (frequent KB query → auto-suggest FAQ) needs a hit-count signal across
-- queryKnowledge calls (and other tools) to drive the promotion loop. Today there's no
-- structured record of which chunks the agent actually retrieved on a call, only the call
-- transcript. Without this, the auto-promote step has no data to read.
-- Also unblocks: cross-tool invocation analytics (book vs sms vs transfer rates per client),
-- per-call latency observability for tool routes.
--
-- Plan: ~/.claude/projects/-Users-owner/memory/unmissed-knowledge-tier-architecture.md
-- Companion helper: src/lib/tool-invocations.ts (next step in this sprint).

create extension if not exists "pgcrypto";

create table if not exists public.tool_invocations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  -- call_log_id can be null when the tool fires on a demo/preview/test path that does not
  -- create a call_logs row (e.g. /api/dashboard/browser-test-call). The Ultravox call SID is
  -- still captured separately by the routes themselves; this column is only for the prod link.
  call_log_id uuid references public.call_logs(id) on delete set null,
  tool_name text not null,
  -- Free-form input the tool received. queryKnowledge stores the user query text; bookAppointment
  -- stores a JSON-stringified args summary; transferCall stores the reason; sendTextMessage stores
  -- the rendered body or template key. Capped at 4KB at the application layer.
  query_text text,
  -- For queryKnowledge: array of knowledge_chunks.id values returned. For other tools: null or empty.
  chunk_ids_hit uuid[],
  success boolean not null default true,
  latency_ms int,
  created_at timestamptz not null default now()
);

-- Hot-path read: D270 promotion job will scan recent rows per client by tool_name.
create index if not exists tool_invocations_client_tool_created_idx
  on public.tool_invocations (client_id, tool_name, created_at desc);

-- Per-call drill-down (e.g. "what did the agent retrieve on call X?").
create index if not exists tool_invocations_call_log_idx
  on public.tool_invocations (call_log_id)
  where call_log_id is not null;

comment on table public.tool_invocations is
  'D-NEW-tool-invocation-log: structured log of every voice-agent tool invocation (queryKnowledge, bookAppointment, sendTextMessage, transferCall, submitMaintenanceRequest, etc.). Read by Phase 9 D270 to identify high-frequency KB queries that should be promoted into clients.extra_qa.';
comment on column public.tool_invocations.chunk_ids_hit is
  'For queryKnowledge: array of knowledge_chunks.id values that the hybrid search returned. Drives the D270 promotion loop (chunks hit 3+ times in same week become FAQ candidates).';
comment on column public.tool_invocations.query_text is
  'Tool input summary. For queryKnowledge: the raw user query. For other tools: a short args/reason string. Capped to 4KB at the application layer to bound row size.';

-- Service-role only by design. The promotion job and the per-route helper both run server-side
-- with the service-role key (RLS bypass). No dashboard read-path on this table yet — surfacing
-- it to clients is a separate D-item (per-call retrieval drill-down on CallRowExpanded).
alter table public.tool_invocations enable row level security;
