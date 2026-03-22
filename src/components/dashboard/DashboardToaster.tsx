'use client'

import { Toaster } from 'sonner'

export function DashboardToaster() {
  return (
    <Toaster
      position="bottom-right"
      theme="dark"
      toastOptions={{
        style: {
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-1)',
          fontSize: '13px',
        },
      }}
    />
  )
}
