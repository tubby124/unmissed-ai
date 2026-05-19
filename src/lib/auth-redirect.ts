export function safeAuthNext(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback
  return raw
}
