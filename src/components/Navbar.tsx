"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Phone } from "lucide-react";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b"
      style={{
        backgroundColor: "rgba(10,10,10,0.92)",
        backdropFilter: "blur(12px)",
        borderColor: "#1F1F1F",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: "#3B82F6" }}
          >
            U
          </div>
          <span className="font-semibold text-white text-lg tracking-tight">
            unmissed<span style={{ color: "#3B82F6" }}>.ai</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/#how-it-works"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="/try"
            className="text-sm font-semibold transition-colors"
            style={{ color: "#3B82F6" }}
          >
            Try Free
          </Link>
          <Link
            href="/#demo"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Demo
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/for-auto-glass"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            For Glass Shops
          </Link>
          <Link
            href="/for-realtors"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            For Realtors
          </Link>
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/onboard"
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: "#3B82F6" }}
            onMouseEnter={(e) =>
              ((e.target as HTMLElement).style.backgroundColor = "#2563EB")
            }
            onMouseLeave={(e) =>
              ((e.target as HTMLElement).style.backgroundColor = "#3B82F6")
            }
          >
            Get My Agent →
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-gray-400 hover:text-white"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden border-t px-4 py-4 flex flex-col gap-4"
          style={{ backgroundColor: "#0A0A0A", borderColor: "#1F1F1F" }}
        >
          <Link
            href="/#how-it-works"
            className="text-sm text-gray-400"
            onClick={() => setOpen(false)}
          >
            How It Works
          </Link>
          <Link
            href="/try"
            className="text-sm font-semibold"
            style={{ color: "#3B82F6" }}
            onClick={() => setOpen(false)}
          >
            Try Free
          </Link>
          <Link
            href="/#demo"
            className="text-sm text-gray-400"
            onClick={() => setOpen(false)}
          >
            Demo
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-gray-400"
            onClick={() => setOpen(false)}
          >
            Pricing
          </Link>
          <Link
            href="/for-auto-glass"
            className="text-sm text-gray-400"
            onClick={() => setOpen(false)}
          >
            For Glass Shops
          </Link>
          <Link
            href="/for-realtors"
            className="text-sm text-gray-400"
            onClick={() => setOpen(false)}
          >
            For Realtors
          </Link>
          <Link
            href="/onboard"
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white text-center"
            style={{ backgroundColor: "#3B82F6" }}
            onClick={() => setOpen(false)}
          >
            Get My Agent →
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-center border"
            style={{ color: "#9CA3AF", borderColor: "#1F1F1F", backgroundColor: "transparent" }}
            onClick={() => setOpen(false)}
          >
            Sign In to Dashboard
          </Link>
          <a
            href="tel:+15873551834"
            className="flex items-center gap-2 text-sm text-gray-500"
          >
            <Phone size={14} />
            Call our demo line
          </a>
        </div>
      )}
    </nav>
  );
}
