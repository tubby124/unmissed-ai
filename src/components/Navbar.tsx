"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const INDUSTRIES = [
  { label: "Auto Glass", href: "/for-auto-glass" },
  { label: "Real Estate", href: "/for-realtors" },
  { label: "HVAC", href: "/for-hvac" },
  { label: "Plumbing", href: "/for-plumbing" },
  { label: "Dental", href: "/for-dental" },
  { label: "Legal", href: "/for-legal" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [industriesOpen, setIndustriesOpen] = useState(false);
  const [mobileIndustriesOpen, setMobileIndustriesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close desktop dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIndustriesOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleMouseEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIndustriesOpen(true);
  }

  function handleMouseLeave() {
    timeoutRef.current = setTimeout(() => setIndustriesOpen(false), 150);
  }

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
            href="/pricing"
            className="text-sm transition-colors"
            style={{ color: "var(--color-text-2)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-1)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-2)")}
          >
            Pricing
          </Link>

          {/* Industries Dropdown */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className="flex items-center gap-1 text-sm transition-colors"
              style={{ color: "var(--color-text-2)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-1)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-2)")}
              onClick={() => setIndustriesOpen(prev => !prev)}
            >
              Industries
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${industriesOpen ? "rotate-180" : ""}`}
              />
            </button>

            {industriesOpen && (
              <div
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 rounded-xl border shadow-lg py-2"
                style={{
                  backgroundColor: "var(--color-bg)",
                  borderColor: "var(--color-nav-border)",
                }}
              >
                {INDUSTRIES.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-4 py-2 text-sm transition-colors"
                    style={{ color: "var(--color-text-2)" }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = "var(--color-text-1)";
                      e.currentTarget.style.backgroundColor = "var(--color-nav-border)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = "var(--color-text-2)";
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                    onClick={() => setIndustriesOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/onboard"
            className="text-sm font-semibold transition-colors"
            style={{ color: "var(--color-primary)" }}
          >
            Try Free
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
            Get My Agent
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
          className="md:hidden border-t px-4 py-4 flex flex-col gap-3 rounded-b-2xl"
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
            href="/pricing"
            className="text-sm"
            style={{ color: "var(--color-text-2)" }}
            onClick={() => setOpen(false)}
          >
            Pricing
          </Link>

          {/* Mobile Industries Accordion */}
          <div>
            <button
              className="flex items-center gap-1 text-sm w-full"
              style={{ color: "var(--color-text-2)" }}
              onClick={() => setMobileIndustriesOpen(prev => !prev)}
            >
              Industries
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${mobileIndustriesOpen ? "rotate-180" : ""}`}
              />
            </button>
            {mobileIndustriesOpen && (
              <div className="flex flex-col gap-2 pl-4 pt-2">
                {INDUSTRIES.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-sm"
                    style={{ color: "var(--color-text-2)" }}
                    onClick={() => {
                      setOpen(false);
                      setMobileIndustriesOpen(false);
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/onboard"
            className="text-sm font-semibold"
            style={{ color: "var(--color-primary)" }}
            onClick={() => setOpen(false)}
          >
            Try Free
          </Link>

          <div className="border-t pt-3 flex flex-col gap-3" style={{ borderColor: "var(--color-nav-border)" }}>
            <Link
              href="/onboard"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white text-center"
              style={{ backgroundColor: "var(--color-primary)" }}
              onClick={() => setOpen(false)}
            >
              Get My Agent
            </Link>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-center border"
              style={{ color: "var(--color-text-2)", borderColor: "var(--color-nav-border)", backgroundColor: "transparent" }}
              onClick={() => setOpen(false)}
            >
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
