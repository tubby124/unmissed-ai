"use client";

import Link from "next/link";
import Logo from "./Logo";
import TrustPills from "./TrustPills";
import { BRAND_NAME, HELLO_EMAIL } from "@/lib/brand";
import { NAV_NICHES } from "@/lib/niches";

export default function Footer() {
  return (
    <footer
      className="border-t mt-auto"
      style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)" }}
    >
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="mb-3">
              <Logo href="/" height={32} />
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: "var(--color-text-2)" }}>
              Done-for-you AI receptionist for service businesses. Your agent
              answers forwarded missed calls, captures lead details, and sends
              callback-ready summaries.
            </p>

            {/* Email capture */}
            <div className="mt-5 max-w-sm">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-2)" }}>
                Need help setting up?
              </p>
              <Link
                href={`mailto:${HELLO_EMAIL}`}
                className="inline-flex rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Email {HELLO_EMAIL}
              </Link>
            </div>

            <p className="text-xs mt-4" style={{ color: "var(--color-text-3)" }}>
              Built for service businesses
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-2)" }}>
              Product
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/#how-it-works" className="text-sm hover:t1 transition-colors" style={{ color: "var(--color-text-2)" }}>How It Works</Link>
              <Link href="/pricing" className="text-sm hover:t1 transition-colors" style={{ color: "var(--color-text-2)" }}>Pricing</Link>
              <Link href="/demo" className="text-sm hover:t1 transition-colors" style={{ color: "var(--color-text-2)" }}>Demo</Link>
              <Link href="/onboard" className="text-sm hover:t1 transition-colors" style={{ color: "var(--color-text-2)" }}>Get Started</Link>
            </div>
          </div>

          {/* Niches */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-2)" }}>
              Industries
            </p>
            <div className="flex flex-col gap-2">
              {NAV_NICHES.map(n => (
                <Link key={n.id} href={n.href} className="text-sm hover:t1 transition-colors" style={{ color: "var(--color-text-2)" }}>{n.fullLabel}</Link>
              ))}
            </div>
          </div>
        </div>

        {/* Trust + compliance */}
        <div className="border-t pt-6 pb-6 flex justify-center" style={{ borderColor: "var(--color-border)" }}>
          <TrustPills variant="compact" />
        </div>

        {/* Data privacy + legal */}
        <div
          className="border-t pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex flex-col gap-1">
            <p className="text-xs" style={{ color: "var(--color-text-3)" }}>
              &copy; 2026 {BRAND_NAME}. All rights reserved.
            </p>
            <p className="text-xs max-w-md" style={{ color: "var(--color-text-3)" }}>
              Your data is encrypted and stored securely. We never sell or share
              your callers&apos; information.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs transition-colors" style={{ color: "var(--color-text-3)" }}>
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs transition-colors" style={{ color: "var(--color-text-3)" }}>
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
