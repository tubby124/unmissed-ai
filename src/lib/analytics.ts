/** Lightweight GA4 event tracking — safe to call without gtag loaded */
export function trackEvent(
  event: string,
  params?: Record<string, string | number | boolean>
) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', event, params)
  }
}
