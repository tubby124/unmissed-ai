"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

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
      style={{ backgroundColor: "#0A0A0A", borderTop: "1px solid #1F1F1F" }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">
            Ready to stop missing calls?
          </p>
          <p className="text-gray-500 text-xs">Agent live within 24 hours</p>
        </div>
        <Link
          href="/onboard"
          className="flex-shrink-0 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors"
          style={{ backgroundColor: "#3B82F6" }}
        >
          Get My Agent →
        </Link>
      </div>
    </div>
  );
}
