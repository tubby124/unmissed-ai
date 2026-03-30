'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProvisioningWait() {
  const router = useRouter()

  useEffect(() => {
    // Reload every 3 seconds until the Twilio number is provisioned
    const id = setTimeout(() => router.refresh(), 3000)
    return () => clearTimeout(id)
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pulse"
          style={{ backgroundColor: 'var(--color-primary)', opacity: 0.8 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.72A2 2 0 012 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold t1 mb-2">Activating your plan…</h1>
        <p className="text-sm t3">Assigning your phone number. This takes just a few seconds.</p>
        <div className="flex justify-center gap-1 mt-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: 'var(--color-primary)',
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
          ))}
        </div>
      </div>
    </div>
  )
}
