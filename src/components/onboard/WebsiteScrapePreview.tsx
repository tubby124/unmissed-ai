'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { OnboardingData, WebsiteScrapeResult } from '@/types/onboarding';

type ScrapeResponse = Omit<WebsiteScrapeResult, 'approvedFacts' | 'approvedQa'>;

interface WebsiteScrapePreviewProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export default function WebsiteScrapePreview({ data, onUpdate }: WebsiteScrapePreviewProps) {
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedQa, setExpandedQa] = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFetchedRef = useRef(false);

  const websiteUrl = data.websiteUrl?.trim() || '';
  const result = data.websiteScrapeResult;

  const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
  const isStale = result !== null && (
    Date.now() - new Date(result.scrapedAt).getTime() > STALE_MS
  );

  const shouldFetch = websiteUrl.length > 0 && (
    result === null ||
    result.scrapedUrl !== websiteUrl
  );

  const doFetch = useCallback(async () => {
    if (!websiteUrl) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSlow(false);
    setError(null);

    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = setTimeout(() => setSlow(true), 20_000);

    try {
      const res = await fetch('/api/onboard/scrape-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl, niche: data.niche }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Scan failed (${res.status})`);
      }

      const body: ScrapeResponse = await res.json();

      onUpdate({
        websiteScrapeResult: {
          businessFacts: body.businessFacts,
          extraQa: body.extraQa,
          serviceTags: body.serviceTags,
          warnings: body.warnings,
          scrapedAt: body.scrapedAt,
          scrapedUrl: body.scrapedUrl,
          contextData: body.contextData ?? null,
          approvedFacts: Array(body.businessFacts.length).fill(true),
          approvedQa: Array(body.extraQa.length).fill(true),
        },
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setSlow(false);
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    }
  }, [websiteUrl, data.niche, onUpdate]);

  useEffect(() => {
    if (shouldFetch && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      doFetch();
    }
  }, [shouldFetch, doFetch]);

  useEffect(() => {
    if (shouldFetch) {
      hasFetchedRef.current = false;
    }
  }, [websiteUrl]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    };
  }, []);

  const toggleFact = (index: number) => {
    if (!result) return;
    const next = [...result.approvedFacts];
    next[index] = !next[index];
    onUpdate({ websiteScrapeResult: { ...result, approvedFacts: next } });
  };

  const toggleQa = (index: number) => {
    if (!result) return;
    const next = [...result.approvedQa];
    next[index] = !next[index];
    onUpdate({ websiteScrapeResult: { ...result, approvedQa: next } });
  };

  const toggleExpandQa = (index: number) => {
    setExpandedQa(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (!websiteUrl) return null;

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-indigo-500 dark:text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {slow ? 'Still working on it...' : 'Scanning your website...'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {slow
                ? 'This is taking longer than expected. You can wait or try again.'
                : 'This takes 10\u201320 seconds'}
            </p>
            {slow && (
              <button
                type="button"
                onClick={() => {
                  abortRef.current?.abort();
                  setLoading(false);
                  setSlow(false);
                  if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
                  setError('Scan was taking too long. Please try again.');
                }}
                className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700 rounded-lg px-3 py-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer"
              >
                Cancel and retry
              </button>
            )}
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-indigo-200 dark:bg-indigo-800 shrink-0" />
              <div className="h-3.5 rounded bg-indigo-100 dark:bg-indigo-900/50 flex-1" style={{ maxWidth: `${60 + i * 10}%` }} />
            </div>
          ))}
          {[1, 2].map(i => (
            <div key={`qa-${i}`} className="animate-pulse space-y-1.5 pl-7">
              <div className="h-3 rounded bg-indigo-100 dark:bg-indigo-900/50 w-3/4" />
              <div className="h-2.5 rounded bg-indigo-50 dark:bg-indigo-950/30 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">Could not scan your website</p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{error}</p>
            <button
              type="button"
              onClick={() => {
                hasFetchedRef.current = false;
                doFetch();
              }}
              className="mt-3 text-xs font-medium text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-lg px-3 py-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── No result yet (pre-fetch or cleared) ────────────────────────────────────
  if (!result) return null;

  const staleHours = isStale ? Math.round((Date.now() - new Date(result!.scrapedAt).getTime()) / (60 * 60 * 1000)) : 0;

  const hasContent = result.businessFacts.length > 0 || result.extraQa.length > 0 || result.serviceTags.length > 0;

  if (!hasContent) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No content found</p>
            <p className="text-xs text-muted-foreground mt-0.5">We scanned your website but didn&apos;t find extractable business info. You can add details manually after activation.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Results ─────────────────────────────────────────────────────────────────
  const approvedFactCount = result.approvedFacts.filter(Boolean).length;
  const approvedQaCount = result.approvedQa.filter(Boolean).length;
  const totalApproved = approvedFactCount + approvedQaCount + result.serviceTags.length;

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">What we found on your website</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {totalApproved} item{totalApproved !== 1 ? 's' : ''} will train your agent
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            hasFetchedRef.current = false;
            doFetch();
          }}
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700 rounded-lg px-3 py-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer shrink-0"
        >
          Re-scan
        </button>
      </div>

      {/* Stale data banner */}
      {isStale && (
        <div className="mx-5 mb-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3.5 py-2.5">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            This data is {staleHours}h old. Your website may have changed — use Re-scan above to refresh.
          </p>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="mx-5 mb-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3.5 py-2.5">
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      {/* Business Facts */}
      {result.businessFacts.length > 0 && (
        <div className="border-t border-indigo-200 dark:border-indigo-800">
          <div className="px-5 py-2.5 bg-indigo-100/50 dark:bg-indigo-900/20">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Business facts ({approvedFactCount}/{result.businessFacts.length})
            </p>
          </div>
          <div className="px-5 py-3 space-y-1.5">
            {result.businessFacts.map((fact, i) => (
              <label
                key={i}
                className="flex items-start gap-2.5 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={result.approvedFacts[i] ?? true}
                  onChange={() => toggleFact(i)}
                  className="mt-0.5 w-4 h-4 rounded border-indigo-300 dark:border-indigo-700 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400 cursor-pointer shrink-0"
                />
                <span className={`text-sm leading-snug transition-colors ${
                  result.approvedFacts[i]
                    ? 'text-foreground'
                    : 'text-muted-foreground line-through'
                }`}>
                  {fact}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* FAQ Pairs */}
      {result.extraQa.length > 0 && (
        <div className="border-t border-indigo-200 dark:border-indigo-800">
          <div className="px-5 py-2.5 bg-indigo-100/50 dark:bg-indigo-900/20">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              FAQs ({approvedQaCount}/{result.extraQa.length})
            </p>
          </div>
          <div className="px-5 py-3 space-y-2">
            {result.extraQa.map((qa, i) => {
              const expanded = expandedQa.has(i);
              const approved = result.approvedQa[i] ?? true;
              return (
                <div
                  key={i}
                  className={`rounded-lg border transition-colors ${
                    approved
                      ? 'border-indigo-200 dark:border-indigo-800 bg-card'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-start gap-2.5 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={approved}
                      onChange={() => toggleQa(i)}
                      className="mt-0.5 w-4 h-4 rounded border-indigo-300 dark:border-indigo-700 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400 cursor-pointer shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => toggleExpandQa(i)}
                      className="flex-1 text-left min-w-0 cursor-pointer"
                    >
                      <p className={`text-sm font-medium leading-snug transition-colors ${
                        approved ? 'text-foreground' : 'text-muted-foreground line-through'
                      }`}>
                        {qa.q}
                      </p>
                      {expanded && (
                        <p className={`text-xs mt-1.5 leading-relaxed ${
                          approved ? 'text-muted-foreground' : 'text-muted-foreground/60 line-through'
                        }`}>
                          {qa.a}
                        </p>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpandQa(i)}
                      className="mt-0.5 shrink-0 cursor-pointer"
                    >
                      <svg
                        className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Service Tags */}
      {result.serviceTags.length > 0 && (
        <div className="border-t border-indigo-200 dark:border-indigo-800">
          <div className="px-5 py-2.5 bg-indigo-100/50 dark:bg-indigo-900/20">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Services detected
            </p>
          </div>
          <div className="px-5 py-3 flex flex-wrap gap-1.5">
            {result.serviceTags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center text-xs font-medium rounded-full px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer hint */}
      <div className="border-t border-indigo-200 dark:border-indigo-800 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Uncheck anything you don&apos;t want your agent to know. You can always add more in Settings after activation.
        </p>
      </div>
    </div>
  );
}
