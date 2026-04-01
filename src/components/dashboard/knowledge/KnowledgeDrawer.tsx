'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'

interface KnowledgeDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Width of the drawer. Default '500px'. On mobile, always full width. */
  width?: string
  children: React.ReactNode
  /** Optional footer content (e.g., action buttons) */
  footer?: React.ReactNode
}

export default function KnowledgeDrawer({
  open,
  onClose,
  title,
  subtitle,
  width = '500px',
  children,
  footer,
}: KnowledgeDrawerProps) {
  // Escape key listener + body scroll lock
  useEffect(() => {
    if (!open) return

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)

    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed top-0 right-0 h-full z-50 flex flex-col shadow-2xl w-full sm:w-auto"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderLeft: '1px solid var(--color-border)',
              maxWidth: '100vw',
            }}
            // sm:width handled via CSS custom property
            // On mobile (<640px), Tailwind w-full makes it 100vw.
            // On sm+, we set the explicit width.
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Inject responsive width via style tag scoped to this element */}
            <style>{`
              @media (min-width: 640px) {
                .knowledge-drawer-panel { width: ${width} !important; }
              }
            `}</style>
            <div className="knowledge-drawer-panel flex flex-col h-full w-full">
              {/* Header */}
              <div
                className="flex items-start justify-between px-5 py-4 shrink-0"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <div className="min-w-0">
                  <h2
                    className="text-sm font-semibold truncate"
                    style={{ color: 'var(--color-text-1)' }}
                  >
                    {title}
                  </h2>
                  {subtitle && (
                    <p
                      className="text-[11px] mt-0.5 truncate"
                      style={{ color: 'var(--color-text-3)' }}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ml-3 transition-colors"
                  style={{ backgroundColor: 'var(--color-hover)' }}
                  aria-label="Close drawer"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div
                  className="px-5 py-4 shrink-0"
                  style={{ borderTop: '1px solid var(--color-border)' }}
                >
                  {footer}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
