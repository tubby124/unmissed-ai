'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Link from 'next/link'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { knowledgeRoutes } from '@/lib/dashboard-routes'

interface Props {
  client: ClientConfig
}

export default function KnowledgeProvenanceCard({ client }: Props) {
  const [open, setOpen] = useState(false)
  const [compiledCount, setCompiledCount] = useState(0)
  const [lastRun, setLastRun] = useState<{ model_used: string; chunk_count: number; faq_count: number; created_at: string } | null>(null)

  useEffect(() => {
    fetch(`/api/dashboard/knowledge/stats?client_id=${client.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.bySource) {
          setCompiledCount(data.bySource['compiled_import'] ?? 0)
        }
        if (data?.lastCompilerRun) {
          setLastRun(data.lastCompilerRun)
        }
      })
      .catch(() => {})
  }, [client.id])

  const hasGbp = !!client.gbp_place_id
  const hasWebsite = !!client.website_knowledge_approved

  if (!hasGbp && !hasWebsite && compiledCount === 0) return null

  const gbpFacts = client.gbp_summary
  const gbpRating = client.gbp_rating
  const gbpReviews = client.gbp_review_count
  const gbpPhoto = client.gbp_photo_url

  const websitePages = client.website_scrape_pages?.length ?? 0
  const websiteFacts = client.website_knowledge_approved?.businessFacts?.length ?? 0
  const websiteQa = client.website_knowledge_approved?.extraQa?.length ?? 0
  const scrapedAt = client.website_last_scraped_at
    ? new Date(client.website_last_scraped_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 w-full text-left"
      >
        {/* Map-pin icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Knowledge sources</p>
          <p className="text-[11px] t3 mt-0.5">Where your agent&apos;s knowledge was imported from</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasGbp && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400/70 border border-green-500/15">
              Google
            </span>
          )}
          {hasWebsite && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400/70 border border-blue-500/15">
              Website
            </span>
          )}
          {compiledCount > 0 && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400/70 border border-purple-500/15">
              AI Compiler
            </span>
          )}
        </div>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          className="t3 ml-1 shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-4 space-y-3">

              {/* GBP section */}
              {hasGbp && (
                <div className="p-4 rounded-xl bg-green-500/[0.03] border border-green-500/15 space-y-2">
                  <div className="flex items-center gap-2">
                    {/* Google G icon */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <p className="text-[11px] font-semibold t1">From Google My Business</p>
                    <span className="text-[9px] t3 ml-auto">Imported during setup</span>
                  </div>

                  <div className="flex items-start gap-3">
                    {gbpPhoto && (
                      <img
                        src={gbpPhoto}
                        alt="Business"
                        width={48}
                        height={48}
                        className="rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="min-w-0 space-y-1">
                      {gbpRating != null && (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-semibold text-yellow-400">{gbpRating.toFixed(1)}</span>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(i => (
                              <svg key={i} width="8" height="8" viewBox="0 0 24 24" fill={i <= Math.round(gbpRating) ? '#FACC15' : 'none'} stroke="#FACC15" strokeWidth="1.5">
                                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                              </svg>
                            ))}
                          </div>
                          {gbpReviews != null && (
                            <span className="text-[10px] t3">({gbpReviews.toLocaleString()} reviews)</span>
                          )}
                        </div>
                      )}
                      {gbpFacts && (
                        <p className="text-[11px] t2 line-clamp-3">{gbpFacts}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Website section */}
              {hasWebsite && (
                <div className="p-4 rounded-xl bg-blue-500/[0.03] border border-blue-500/15 space-y-2">
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <p className="text-[11px] font-semibold t1">From your website</p>
                    {scrapedAt && (
                      <span className="text-[9px] t3 ml-auto">Scraped {scrapedAt}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {websitePages > 0 && (
                      <span className="text-[10px] t3">{websitePages} page{websitePages !== 1 ? 's' : ''} scanned</span>
                    )}
                    {websiteFacts > 0 && (
                      <span className="text-[10px] t3">{websiteFacts} fact{websiteFacts !== 1 ? 's' : ''} extracted</span>
                    )}
                    {websiteQa > 0 && (
                      <span className="text-[10px] t3">{websiteQa} Q&amp;A pairs</span>
                    )}
                    <Link
                      href={knowledgeRoutes.add('website')}
                      className="text-[10px] font-medium ml-auto"
                      style={{ color: 'var(--color-primary)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      Re-scrape →
                    </Link>
                  </div>
                </div>
              )}

              {/* AI Compiler section */}
              {compiledCount > 0 && (
                <div className="p-4 rounded-xl bg-purple-500/[0.03] border border-purple-500/15 space-y-2">
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p className="text-[11px] font-semibold t1">From AI Compiler</p>
                    <Link
                      href={knowledgeRoutes.add('text')}
                      className="text-[10px] font-medium ml-auto"
                      style={{ color: 'var(--color-primary)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      Add more →
                    </Link>
                  </div>
                  <p className="text-[10px] t3">
                    {compiledCount} chunk{compiledCount !== 1 ? 's' : ''} imported via AI-assisted extraction
                  </p>
                  {lastRun && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400/70 border border-purple-500/15">
                        {lastRun.model_used.replace('claude-', '').replace(/-\d{8}$/, '')}
                      </span>
                      <span className="text-[10px] t3">
                        Last run {new Date(lastRun.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
