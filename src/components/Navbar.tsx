"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Phone } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="fixed top-3 left-4 right-4 z-50 rounded-2xl border shadow-md"
      style={{
        backgroundColor: "var(--color-nav-bg)",
        backdropFilter: "blur(12px)",
        borderColor: "var(--color-nav-border)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            U
          </div>
          <span className="font-semibold text-lg tracking-tight" style={{ color: "var(--color-text-1)" }}>
            unmissed<span style={{ color: "var(--color-primary)" }}>.ai</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/#how-it-works"
            className="text-sm transition-colors"
            style={{ color: "var(--color-text-2)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-1)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-2)")}
          >
            How It Works
          </Link>
          <Link
            href="/try"
            className="text-sm font-semibold transition-colors"
            style={{ color: "var(--color-primary)" }}
          >
            Try Free
          </Link>
          <Link
            href="/#demo"
            className="text-sm transition-colors"
            style={{ color: "var(--color-text-2)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-1)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-2)")}
          >
            Demo
          </Link>
          <Link
            href="/pricing"
            className="text-sm transition-colors"
            style={{ color: "var(--color-text-2)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-1)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-2)")}
          >
            Pricing
          </Link>
          <Link
            href="/for-auto-glass"
            className="text-sm transition-colors"
            style={{ color: "var(--color-text-2)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-1)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-2)")}
          >
            For Glass Shops
          </Link>
          <Link
            href="/for-realtors"
            className="text-sm transition-colors"
            style={{ color: "var(--color-text-2)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-1)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-2)")}
          >
            For Realtors
          </Link>
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm hover:text-white transition-colors"
            style={{ color: "var(--color-text-2)" }}
          >
            Sign In
          </Link>
          <Link
            href="/onboard"
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: "var(--color-primary)" }}
            onMouseEnter={(e) =>
              ((e.target as HTMLElement).style.backgroundColor = "var(--color-primary-hover)")
            }
            onMouseLeave={(e) =>
              ((e.target as HTMLElement).style.backgroundColor = "var(--color-primary)")
            }
          >
            Get My Agent →
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden hover:text-white"
          style={{ color: "var(--color-text-2)" }}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden border-t px-4 py-4 flex flex-col gap-4 rounded-b-2xl"
          style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-nav-border)" }}
        >
          <Link
            href="/#how-it-works"
            className="text-sm"
            style={{ color: "var(--color-text-2)" }}
            onClick={() => setOpen(false)}
          >
            How It Works
          </Link>
          <Link
            href="/try"
            className="text-sm font-semibold"
            style={{ color: "var(--color-primary)" }}
            onClick={() => setOpen(false)}
          >
            Try Free
          </Link>
          <Link
            href="/#demo"
            className="text-sm"
            style={{ color: "var(--color-text-2)" }}
            onClick={() => setOpen(false)}
          >
            Demo
          </Link>
          <Link
            href="/pricing"
            className="text-sm"
            style={{ color: "var(--color-text-2)" }}
            onClick={() => setOpen(false)}
          >
            Pricing
          </Link>
          <Link
            href="/for-auto-glass"
            className="text-sm"
            style={{ color: "var(--color-text-2)" }}
            onClick={() => setOpen(false)}
          >
            For Glass Shops
          </Link>
          <Link
            href="/for-realtors"
            className="text-sm"
            style={{ color: "var(--color-text-2)" }}
            onClick={() => setOpen(false)}
          >
            For Realtors
          </Link>
          <Link
            href="/onboard"
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white text-center"
            style={{ backgroundColor: "var(--color-primary)" }}
            onClick={() => setOpen(false)}
          >
            Get My Agent →
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-center border"
            style={{ color: "var(--color-text-2)", borderColor: "var(--color-nav-border)", backgroundColor: "transparent" }}
            onClick={() => setOpen(false)}
          >
            Sign In to Dashboard
          </Link>
          <Link
            href="/try"
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--color-text-2)" }}
          >
            <Phone size={14} />
            Try our AI agent
          </Link>
        </div>
      )}
    </nav>
  );
}
