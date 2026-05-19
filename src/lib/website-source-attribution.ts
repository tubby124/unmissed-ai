type ResolveWebsiteApproveSourceUrlParams = {
  bodySourceUrl?: string | null
  primaryWebsiteUrl?: string | null
  knownSourceUrls?: string[] | null
}

type ResolveWebsiteApproveSourceUrlResult =
  | { ok: true; sourceUrl?: string }
  | { ok: false; error: string }

function cleanUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  return trimmed ? trimmed : null
}

export function resolveWebsiteApproveSourceUrl({
  bodySourceUrl,
  primaryWebsiteUrl,
  knownSourceUrls,
}: ResolveWebsiteApproveSourceUrlParams): ResolveWebsiteApproveSourceUrlResult {
  const requested = cleanUrl(bodySourceUrl)
  const known = Array.from(new Set((knownSourceUrls ?? []).map(cleanUrl).filter(Boolean))) as string[]

  if (requested) {
    if (known.length > 0 && !known.includes(requested)) {
      return {
        ok: false,
        error: 'sourceUrl must match a website source for this client',
      }
    }
    return { ok: true, sourceUrl: requested }
  }

  if (known.length > 1) {
    return {
      ok: false,
      error: 'sourceUrl is required when multiple website sources exist',
    }
  }

  return { ok: true, sourceUrl: known[0] ?? cleanUrl(primaryWebsiteUrl) ?? undefined }
}
