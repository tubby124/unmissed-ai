"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  function handleSubscribe(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    // TODO: wire to Brevo or backend endpoint
    setSubscribed(true);
    setEmail("");
  }

  return (
    <footer
      className="border-t mt-auto"
      style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)" }}
    >
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                U
              </div>
              <span className="font-semibold text-lg" style={{ color: "var(--color-text-1)" }}>
                unmissed<span style={{ color: "var(--color-primary)" }}>.ai</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: "var(--color-text-2)" }}>
              Done-for-you AI receptionist for service businesses. Your agent
              answers every call, captures every lead, and sends you instant
              notifications — 24/7.
            </p>

            {/* Email capture */}
            <div className="mt-5 max-w-sm">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-2)" }}>
                Get notified about new features
              </p>
              {subscribed ? (
                <p className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>
                  Thanks! We&apos;ll keep you posted.
                </p>
              ) : (
                <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none transition-colors"
                    style={{
                      backgroundColor: "var(--color-bg-raised)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-text-1)",
                    }}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 shrink-0"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    Subscribe
                  </button>
                </form>
              )}
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
              <Link href="/for-auto-glass" className="text-sm hover:t1 transition-colors" style={{ color: "var(--color-text-2)" }}>Auto Glass Shops</Link>
              <Link href="/for-realtors" className="text-sm hover:t1 transition-colors" style={{ color: "var(--color-text-2)" }}>Real Estate Agents</Link>
              <Link href="/for-hvac" className="text-sm hover:t1 transition-colors" style={{ color: "var(--color-text-2)" }}>HVAC Companies</Link>
              <Link href="/for-plumbing" className="text-sm hover:t1 transition-colors" style={{ color: "var(--color-text-2)" }}>Plumbers</Link>
              <Link href="/for-dental" className="text-sm hover:t1 transition-colors" style={{ color: "var(--color-text-2)" }}>Dental Offices</Link>
              <Link href="/for-legal" className="text-sm hover:t1 transition-colors" style={{ color: "var(--color-text-2)" }}>Law Firms</Link>
            </div>
          </div>
        </div>

        {/* Data privacy + legal */}
        <div
          className="border-t pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex flex-col gap-1">
            <p className="text-xs" style={{ color: "var(--color-text-3)" }}>
              &copy; 2026 unmissed.ai. All rights reserved.
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
