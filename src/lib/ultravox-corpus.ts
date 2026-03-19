import { createCorpus, getCorpus, createSource, listSources, deleteSource } from '@/lib/ultravox'

export type CorpusStatus = 'idle' | 'syncing' | 'ready' | 'failed' | 'stale'

export type CorpusState = {
  corpusId: string | null
  sourceId: string | null
  status: CorpusStatus
  error?: string
}

export async function ensureCorpus(
  clientSlug: string,
  existingCorpusId: string | null,
): Promise<string> {
  if (existingCorpusId) {
    try {
      await getCorpus(existingCorpusId)
      console.log(`[ultravox-corpus] Verified existing corpus ${existingCorpusId} for ${clientSlug}`)
      return existingCorpusId
    } catch {
      console.log(`[ultravox-corpus] Existing corpus ${existingCorpusId} not found for ${clientSlug}, creating new`)
    }
  }

  const name = `client-${clientSlug}-website`
  const { corpusId } = await createCorpus(name, `Website knowledge base for ${clientSlug}`)
  console.log(`[ultravox-corpus] Created corpus ${corpusId} for ${clientSlug}`)
  return corpusId
}

export async function syncWebsiteSource(
  corpusId: string,
  sourceUrls: string[],
  existingSourceId: string | null,
  clientSlug: string,
): Promise<string> {
  if (existingSourceId) {
    try {
      await deleteSource(corpusId, existingSourceId)
      console.log(`[ultravox-corpus] Deleted old source ${existingSourceId} for ${clientSlug}`)
    } catch (err) {
      console.log(`[ultravox-corpus] Could not delete old source ${existingSourceId} for ${clientSlug}: ${err}`)
    }
  }

  const { sourceId } = await createSource(corpusId, {
    startUrls: sourceUrls,
    name: `website-${clientSlug}`,
    maxDepth: 1,
  })
  console.log(`[ultravox-corpus] Created source ${sourceId} for ${clientSlug} with ${sourceUrls.length} start URL(s)`)
  return sourceId
}

export async function checkCorpusStatus(
  corpusId: string,
): Promise<CorpusStatus> {
  const sources = await listSources(corpusId)

  if (!sources || sources.length === 0) {
    console.log(`[ultravox-corpus] Corpus ${corpusId} has no sources — idle`)
    return 'idle'
  }

  const statuses: string[] = sources.map((s: { status?: string }) => s.status ?? '')

  if (statuses.some((s: string) => s === 'failed')) {
    console.log(`[ultravox-corpus] Corpus ${corpusId} has failed source(s)`)
    return 'failed'
  }

  if (statuses.some((s: string) => s === 'processing')) {
    console.log(`[ultravox-corpus] Corpus ${corpusId} has processing source(s)`)
    return 'syncing'
  }

  if (statuses.every((s: string) => s === 'completed')) {
    console.log(`[ultravox-corpus] Corpus ${corpusId} all sources completed — ready`)
    return 'ready'
  }

  console.log(`[ultravox-corpus] Corpus ${corpusId} sources in unknown state: ${statuses.join(', ')}`)
  return 'syncing'
}

export async function syncClientCorpus(
  clientSlug: string,
  sourceUrls: string[],
  existingCorpusId: string | null,
  existingSourceId: string | null,
): Promise<CorpusState> {
  try {
    const corpusId = await ensureCorpus(clientSlug, existingCorpusId)
    const sourceId = await syncWebsiteSource(corpusId, sourceUrls, existingSourceId, clientSlug)
    const status = await checkCorpusStatus(corpusId)

    console.log(`[ultravox-corpus] syncClientCorpus complete for ${clientSlug}: corpus=${corpusId} source=${sourceId} status=${status}`)
    return { corpusId, sourceId, status }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[ultravox-corpus] syncClientCorpus failed for ${clientSlug}: ${message}`)
    return {
      corpusId: existingCorpusId,
      sourceId: existingSourceId,
      status: 'failed',
      error: message,
    }
  }
}
