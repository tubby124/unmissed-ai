import Link from "next/link";

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
            <p className="text-xs mt-4" style={{ color: "var(--color-text-3)" }}>
              Built for service businesses 🇨🇦🇺🇸
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-2)" }}>
              Product
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/#how-it-works" className="text-sm hover:text-gray-300 transition-colors" style={{ color: "var(--color-text-2)" }}>How It Works</Link>
              <Link href="/pricing" className="text-sm hover:text-gray-300 transition-colors" style={{ color: "var(--color-text-2)" }}>Pricing</Link>
              <Link href="/demo" className="text-sm hover:text-gray-300 transition-colors" style={{ color: "var(--color-text-2)" }}>Demo</Link>
              <Link href="/onboard" className="text-sm hover:text-gray-300 transition-colors" style={{ color: "var(--color-text-2)" }}>Get Started</Link>
            </div>
          </div>

          {/* Niches */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-2)" }}>
              Industries
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/for-auto-glass" className="text-sm hover:text-gray-300 transition-colors" style={{ color: "var(--color-text-2)" }}>Auto Glass Shops</Link>
              <Link href="/for-realtors" className="text-sm hover:text-gray-300 transition-colors" style={{ color: "var(--color-text-2)" }}>Real Estate Agents</Link>
              <Link href="/for-hvac" className="text-sm hover:text-gray-300 transition-colors" style={{ color: "var(--color-text-2)" }}>HVAC Companies</Link>
              <Link href="/for-plumbing" className="text-sm hover:text-gray-300 transition-colors" style={{ color: "var(--color-text-2)" }}>Plumbers</Link>
              <Link href="/for-dental" className="text-sm hover:text-gray-300 transition-colors" style={{ color: "var(--color-text-2)" }}>Dental Offices</Link>
              <Link href="/for-legal" className="text-sm hover:text-gray-300 transition-colors" style={{ color: "var(--color-text-2)" }}>Law Firms</Link>
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
              © 2026 unmissed.ai. All rights reserved.
            </p>
            <p className="text-xs max-w-md" style={{ color: "var(--color-text-3)" }}>
              🔒 Your customer data lives in your own Google Sheet. We never store,
              sell, or access your callers&apos; information.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs hover:text-gray-400 transition-colors" style={{ color: "var(--color-text-3)" }}>
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs hover:text-gray-400 transition-colors" style={{ color: "var(--color-text-3)" }}>
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
