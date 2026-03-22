import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Not Found — unmissed.ai',
}

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-1)' }}
    >
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-3)' }}>
            <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 6.75z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--color-text-1)' }}>Page not found</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-3)' }}>
          The page you&apos;re looking for doesn&apos;t exist. Your AI receptionist is still on the job though.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 font-medium rounded-xl transition-colors"
            style={{ backgroundColor: '#4f46e5', color: '#fff' }}
          >
            Back to homepage
          </Link>
          <Link
            href="/onboard"
            className="inline-flex items-center justify-center px-6 py-3 font-medium rounded-xl transition-colors"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
          >
            Get my AI agent
          </Link>
        </div>
      </div>
    </div>
  )
}
