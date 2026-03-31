/**
 * POST /api/dashboard/preview-question
 * D133 — Chat-style knowledge preview: query the client's knowledge base and
 * synthesize a plain-language answer using Haiku. No call created.
 *
 * Auth: Supabase session + client_users membership check
 * Body: { question: string, clientId?: string }
 * Returns: { answer: string, sources: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/embeddings'

const MATCH_COUNT = 5
const RRF_MIN_SCORE = 0.005
const SIMILARITY_FLOOR = 0.55 // slightly lower than live agent (0.60) for better preview coverage

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as { question?: string; clientId?: string }
  const question = body.question?.trim()
  if (!question || question.length < 3) {
    return NextResponse.json({ error: 'question required (min 3 chars)' }, { status: 400 })
  }
  if (question.length > 500) {
    return NextResponse.json({ error: 'question too long (max 500 chars)' }, { status: 400 })
  }

  // ── Look up client membership ───────────────────────────────────────────────
  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (!cu) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  // Admin can preview for a specific clientId; otherwise use their own
  const targetClientId = (cu.role === 'admin' && body.clientId) ? body.clientId : cu.client_id

  // ── Fetch client knowledge config ──────────────────────────────────────────
  const svc = createServiceClient()
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, business_facts, extra_qa, knowledge_backend')
    .eq('id', targetClientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // ── Gather knowledge context ────────────────────────────────────────────────
  const knowledgeChunks: string[] = []
  const sourceLabels: string[] = []

  // 1. business_facts (flat text or array)
  const rawFacts = client.business_facts
  if (rawFacts) {
    const factsArr = Array.isArray(rawFacts)
      ? (rawFacts as string[])
      : (rawFacts as string).split('\n').filter((l: string) => l.trim())
    if (factsArr.length > 0) {
      knowledgeChunks.push(`Business facts:\n${factsArr.slice(0, 30).join('\n')}`)
      sourceLabels.push('business facts')
    }
  }

  // 2. extra_qa
  const rawQa = client.extra_qa
  if (Array.isArray(rawQa) && rawQa.length > 0) {
    const pairs = (rawQa as { q: string; a: string }[])
      .filter(p => p.q?.trim() && p.a?.trim())
      .slice(0, 20)
    if (pairs.length > 0) {
      knowledgeChunks.push(`Q&A:\n${pairs.map(p => `Q: ${p.q}\nA: ${p.a}`).join('\n\n')}`)
      sourceLabels.push('Q&A')
    }
  }

  // 3. pgvector hybrid search (if enabled and chunks exist)
  if (client.knowledge_backend === 'pgvector') {
    try {
      const embedding = await embedText(question)
      if (embedding) {
        const { data: results } = await svc.rpc('hybrid_match_knowledge', {
          query_text: question,
          query_embedding: JSON.stringify(embedding),
          match_client_id: client.id,
          match_count: MATCH_COUNT,
          full_text_weight: 1.0,
          semantic_weight: 1.0,
          rrf_k: 50,
        })
        if (results && results.length > 0) {
          const relevant = (results as Array<{
            content: string
            source: string
            similarity: number
            keyword_rank: number | null
            rrf_score: number
            status: string
          }>)
            .filter(m => {
              const hasKeyword = m.keyword_rank !== null
              const hasGoodSimilarity = m.similarity >= SIMILARITY_FLOOR
              return m.status === 'approved' && (hasKeyword || hasGoodSimilarity) && m.rrf_score >= RRF_MIN_SCORE
            })
            .slice(0, 4)

          if (relevant.length > 0) {
            knowledgeChunks.push(`Knowledge base:\n${relevant.map(m => m.content).join('\n\n')}`)
            const sources = [...new Set(relevant.map(m => m.source as string))]
            if (sources.includes('website_scrape')) sourceLabels.push('website scrape')
            if (sources.some(s => s === 'compiled_import')) sourceLabels.push('AI compiled')
            if (sources.some(s => s === 'document')) sourceLabels.push('uploaded document')
            if (sources.some(s => s === 'settings_edit')) {
              // already captured above via business_facts / extra_qa
            }
          }
        }
      }
    } catch (e) {
      // Non-fatal — fall back to business_facts/extra_qa only
      console.error('[preview-question] pgvector search failed (non-fatal):', e)
    }
  }

  // ── Synthesize answer with Haiku ─────────────────────────────────────────────
  const openrouterKey = process.env.OPENROUTER_API_KEY
  if (!openrouterKey) {
    // Fallback: return raw knowledge without LLM synthesis
    const rawAnswer = knowledgeChunks.length > 0
      ? knowledgeChunks.join('\n\n').slice(0, 800)
      : 'No information found in your knowledge base for this question.'
    return NextResponse.json({
      answer: rawAnswer,
      sources: [...new Set(sourceLabels)],
    })
  }

  if (knowledgeChunks.length === 0) {
    return NextResponse.json({
      answer: "I don't have any information about that in my knowledge base yet. Add facts, Q&A, or connect your website to teach your agent.",
      sources: [],
    })
  }

  const knowledgeContext = knowledgeChunks.join('\n\n').slice(0, 3000)
  const systemPrompt =
    'You are a helpful business assistant. Answer the caller\'s question concisely and naturally ' +
    'based only on the provided knowledge. If the knowledge does not cover the question, say so honestly. ' +
    'Do not make up information. Keep your answer under 3 sentences.'
  const userPrompt = `Knowledge:\n${knowledgeContext}\n\nQuestion: ${question}`

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!resp.ok) {
      throw new Error(`OpenRouter ${resp.status}`)
    }

    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
    const answer = data.choices?.[0]?.message?.content?.trim()

    if (!answer) throw new Error('empty response')

    return NextResponse.json({
      answer,
      sources: [...new Set(sourceLabels)],
    })
  } catch (e) {
    console.error('[preview-question] LLM synthesis failed:', e)
    // Graceful fallback — return first relevant chunk raw
    const fallback = knowledgeChunks[0]?.slice(0, 400) ?? 'Unable to generate answer.'
    return NextResponse.json({
      answer: fallback,
      sources: [...new Set(sourceLabels)],
    })
  }
}
