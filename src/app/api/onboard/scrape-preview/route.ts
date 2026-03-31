/**
 * POST /api/onboard/scrape-preview
 *
 * Scrapes a website URL and returns normalized extraction for onboarding preview.
 * Rate limited: 5 requests/IP/hour.
 * S12-SCRAPE1 Phase B
 */

import { NextRequest, NextResponse } from "next/server";
import { SlidingWindowRateLimiter } from "@/lib/rate-limiter";
import { scrapeWebsite } from "@/lib/website-scraper";
import { normalizeExtraction } from "@/lib/knowledge-extractor";

const limiter = new SlidingWindowRateLimiter(5, 60 * 60 * 1000); // 5 req/IP/hr

const URL_REGEX = /^https?:\/\/.+\..+/;

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { allowed, retryAfterMs } = limiter.check(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again later.", retry_after_seconds: Math.ceil(retryAfterMs / 1000) },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  let body: { websiteUrl?: string; niche?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { websiteUrl, niche } = body;

  if (!websiteUrl || typeof websiteUrl !== "string" || !URL_REGEX.test(websiteUrl)) {
    return NextResponse.json({ error: "Invalid or missing websiteUrl" }, { status: 400 });
  }

  if (!niche || typeof niche !== "string" || niche.trim().length === 0) {
    return NextResponse.json({ error: "Invalid or missing niche" }, { status: 400 });
  }

  limiter.record(ip);

  const SCRAPE_TIMEOUT_MS = 30_000;

  try {
    const scrapeResult = await Promise.race([
      scrapeWebsite(websiteUrl, niche.trim()),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SCRAPE_TIMEOUT")), SCRAPE_TIMEOUT_MS),
      ),
    ]);

    if (scrapeResult.failureBucket !== "success") {
      return NextResponse.json(
        { error: `Scrape failed: ${scrapeResult.failureBucket}`, code: "scrape_failed", warnings: scrapeResult.warnings },
        { status: 500 },
      );
    }

    const normalized = normalizeExtraction(
      scrapeResult.businessFacts,
      scrapeResult.extraQa,
      scrapeResult.serviceTags,
      scrapeResult.warnings,
    );

    return NextResponse.json({
      businessFacts: normalized.result.businessFacts,
      extraQa: normalized.result.extraQa,
      serviceTags: normalized.result.serviceTags,
      warnings: normalized.result.warnings,
      contextData: scrapeResult.contextData ?? null,
      scrapedUrl: websiteUrl,
      scrapedAt: new Date().toISOString(),
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.message === "SCRAPE_TIMEOUT" || err.name === "TimeoutError");

    if (isTimeout) {
      console.warn(`[scrape-preview] Timeout after ${SCRAPE_TIMEOUT_MS}ms | url=${websiteUrl}`);
      return NextResponse.json(
        { error: "Website scan timed out. The site may be slow or temporarily unavailable.", code: "timeout" },
        { status: 504 },
      );
    }

    console.error("[scrape-preview] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error during scrape", code: "error" }, { status: 500 });
  }
}
