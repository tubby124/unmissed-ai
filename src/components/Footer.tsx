import Link from "next/link";

export default function Footer() {
  return (
    <footer
      className="border-t mt-auto"
      style={{ backgroundColor: "#0A0A0A", borderColor: "#1F1F1F" }}
    >
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: "#3B82F6" }}
              >
                U
              </div>
              <span className="font-semibold text-white text-lg">
                unmissed<span style={{ color: "#3B82F6" }}>.ai</span>
              </span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              Done-for-you AI receptionist for service businesses. Your agent
              answers every call, captures every lead, and sends you instant
              notifications — 24/7.
            </p>
            <p className="text-gray-600 text-xs mt-4">
              Built for service businesses 🇨🇦🇺🇸
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Product
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/#how-it-works" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">How It Works</Link>
              <Link href="/pricing" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">Pricing</Link>
              <Link href="/demo" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">Demo</Link>
              <Link href="/onboard" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">Get Started</Link>
            </div>
          </div>

          {/* Niches */}
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Industries
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/for-auto-glass" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">Auto Glass Shops</Link>
              <Link href="/for-realtors" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">Real Estate Agents</Link>
              <Link href="/#niches" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">HVAC Companies</Link>
              <Link href="/#niches" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">Plumbers</Link>
              <Link href="/#niches" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">Dental Offices</Link>
              <Link href="/#niches" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">Law Firms</Link>
            </div>
          </div>
        </div>

        {/* Data privacy + legal */}
        <div
          className="border-t pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          style={{ borderColor: "#1F1F1F" }}
        >
          <div className="flex flex-col gap-1">
            <p className="text-gray-600 text-xs">
              © 2026 unmissed.ai. All rights reserved.
            </p>
            <p className="text-gray-700 text-xs max-w-md">
              🔒 Your customer data lives in your own Google Sheet. We never store,
              sell, or access your callers&apos; information.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-gray-600 text-xs hover:text-gray-400 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-gray-600 text-xs hover:text-gray-400 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
