'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { fmtPhone } from '@/lib/settings-utils'
import { UrlRow, CopyButton } from './shared'

interface WebhooksCardProps {
  appUrl: string
  slug: string
  twilioNumber: string | null
}

export default function WebhooksCard({ appUrl, slug, twilioNumber }: WebhooksCardProps) {
  const [collapsed, setCollapsed] = useState(true)

  const inboundUrl = `${appUrl}/api/webhook/${slug}/inbound`
  const completedUrl = `${appUrl}/api/webhook/${slug}/completed`

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.06 }}
    >
      <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
        <button
          onClick={() => setCollapsed(p => !p)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
              <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Developer Settings</p>
          </div>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            className={`t3 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="webhooks-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-5 pb-5 border-t b-theme">
                <p className="text-[11px] t3 mt-4 mb-3">These URLs are pre-configured in your Twilio console. No action needed.</p>
                <UrlRow label="Inbound" url={inboundUrl} />
                <UrlRow label="Completed" url={completedUrl} />
                <div className="flex items-center gap-3 py-2.5 border-b b-theme last:border-0">
                  <span className="text-xs t3 w-24 shrink-0">Twilio Number</span>
                  <span className="flex-1 text-sm font-mono font-medium t1">
                    {fmtPhone(twilioNumber)}
                  </span>
                  {twilioNumber && <CopyButton value={twilioNumber} />}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
