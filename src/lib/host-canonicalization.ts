const RAILWAY_HOST_SUFFIX = '.up.railway.app'

const PASSTHROUGH_PREFIXES = [
  '/api',
  '/auth',
  '/dashboard',
  '/_next',
  '/brand',
]

const PASSTHROUGH_PATHS = new Set([
  '/apple-icon',
  '/favicon.ico',
  '/favicon.svg',
  '/icon',
  '/manifest.json',
  '/opengraph-image',
  '/robots.txt',
  '/sitemap.xml',
  '/site.webmanifest',
])

export function shouldRedirectRailwayPublicHost(method: string, host: string | null, pathname: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false

  const normalizedHost = (host || '').split(':')[0]?.toLowerCase()
  if (!normalizedHost.endsWith(RAILWAY_HOST_SUFFIX)) return false

  if (PASSTHROUGH_PATHS.has(pathname)) return false
  if (PASSTHROUGH_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false

  return true
}
