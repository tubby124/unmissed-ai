"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Menu, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import { BOOK_WALKTHROUGH_HREF } from "@/lib/booking";

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
        <Logo href="/" height={28} priority />


        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-7">
          <Link
            href="/for-auto-glass"
            className="text-sm transition-colors"
            style={{ color: "var(--color-text-2)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-1)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-2)")}
          >
            Auto Glass
          </Link>
          <Link
            href="/try"
            className="text-sm transition-colors"
            style={{ color: "var(--color-text-2)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-1)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-2)")}
          >
            Try Agent
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
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
            style={{
              color: "var(--color-text-2)",
              borderColor: "var(--color-nav-border)",
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--color-text-1)";
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-nav-border)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)";
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            }}
          >
            Log In
          </Link>
          <a
            href={BOOK_WALKTHROUGH_HREF}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: "var(--color-primary)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-primary-hover)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-primary)")
            }
          >
            <span className="inline-flex items-center gap-2">
              <CalendarDays size={15} />
              Book Walkthrough
            </span>
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden hover:text-white cursor-pointer"
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
          className="md:hidden border-t px-4 py-4 flex flex-col gap-3 rounded-b-2xl"
          style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-nav-border)" }}
        >
          <Link
            href="/for-auto-glass"
            className="text-sm"
            style={{ color: "var(--color-text-2)" }}
            onClick={() => setOpen(false)}
          >
            Auto Glass
          </Link>
          <Link
            href="/try"
            className="text-sm"
            style={{ color: "var(--color-text-2)" }}
            onClick={() => setOpen(false)}
          >
            Try Agent
          </Link>
          <Link
            href="/pricing"
            className="text-sm"
            style={{ color: "var(--color-text-2)" }}
            onClick={() => setOpen(false)}
          >
            Pricing
          </Link>

          <div className="border-t pt-3 flex flex-col gap-3" style={{ borderColor: "var(--color-nav-border)" }}>
            <a
              href={BOOK_WALKTHROUGH_HREF}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white text-center"
              style={{ backgroundColor: "var(--color-primary)" }}
              onClick={() => setOpen(false)}
            >
              Book 15-min Walkthrough
            </a>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-center border"
              style={{ color: "var(--color-text-2)", borderColor: "var(--color-nav-border)", backgroundColor: "transparent" }}
              onClick={() => setOpen(false)}
            >
              Log In
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
