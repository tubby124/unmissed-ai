"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Phone } from "lucide-react";

export default function StickyMobileCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ backgroundColor: "var(--color-bg)", borderTop: "1px solid var(--color-border)" }}
    >
      <div className="px-4 py-3 flex items-center gap-2">
        <a
          href="tel:+15873551834"
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{
            backgroundColor: "var(--color-surface)",
            color: "var(--color-cta)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Phone size={14} />
          Call Demo
        </a>
        <Link
          href="/onboard"
          className="flex-1 text-center py-2.5 rounded-lg text-white text-sm font-semibold transition-colors"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          Get My Agent →
        </Link>
      </div>
    </div>
  );
}
