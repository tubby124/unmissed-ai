"use client";

import { useState } from "react";
import Link from "next/link";
import LeadCard from "./LeadCard";

const niches = [
  {
    id: "auto-glass",
    icon: "🔧",
    label: "Auto Glass",
    href: "/for-auto-glass",
    stat: "Avg $400/job",
    leadCardNiche: "auto-glass" as const,
  },
  {
    id: "hvac",
    icon: "❄️",
    label: "HVAC",
    href: "/for-hvac",
    stat: "Avg $350/call",
    leadCardNiche: "hvac" as const,
  },
  {
    id: "plumbing",
    icon: "🚿",
    label: "Plumbing",
    href: "/for-plumbing",
    stat: "Avg $280/job",
    leadCardNiche: "plumbing" as const,
  },
  {
    id: "dental",
    icon: "🦷",
    label: "Dental Offices",
    href: "/for-dental",
    stat: "Avg $800/new patient",
    leadCardNiche: "dental" as const,
  },
  {
    id: "legal",
    icon: "⚖️",
    label: "Law Firms",
    href: "/for-legal",
    stat: "Avg $3,000/retainer",
    leadCardNiche: "legal" as const,
  },
  {
    id: "realty",
    icon: "🏠",
    label: "Real Estate",
    href: "/for-realtors",
    stat: "Avg $12,000/deal",
    leadCardNiche: "realty" as const,
  },
];

export default function NicheSelectorGrid() {
  const [hoveredNiche, setHoveredNiche] = useState<string | null>(null);
  const activeNiche = niches.find((n) => n.id === hoveredNiche);

  return (
    <section id="niches" className="py-20 px-4" style={{ backgroundColor: "#0D0D0D" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "#3B82F6" }}
          >
            Built for your industry
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            I work in…
          </h2>
          <p className="text-gray-500 text-lg">
            Hover a tile to see what lead cards look like for your business.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Niche tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {niches.map((niche) => (
              <Link
                key={niche.id}
                href={niche.href}
                className="group rounded-2xl p-4 transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor:
                    hoveredNiche === niche.id ? "#1A2A3A" : "#111111",
                  border: `1px solid ${
                    hoveredNiche === niche.id ? "#3B82F6" : "#1F1F1F"
                  }`,
                }}
                onMouseEnter={() => setHoveredNiche(niche.id)}
                onMouseLeave={() => setHoveredNiche(null)}
              >
                <div className="text-2xl mb-2">{niche.icon}</div>
                <p className="text-white text-sm font-semibold">{niche.label}</p>
                <p className="text-gray-500 text-xs mt-1">{niche.stat}</p>
                <p
                  className="text-xs mt-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "#3B82F6" }}
                >
                  See example →
                </p>
              </Link>
            ))}
          </div>

          {/* Lead card preview */}
          <div className="lg:sticky lg:top-24">
            {activeNiche ? (
              <div>
                <p className="text-gray-500 text-xs mb-3 text-center">
                  This is what you&apos;d receive after each {activeNiche.label} call:
                </p>
                <LeadCard niche={activeNiche.leadCardNiche} />
              </div>
            ) : (
              <div
                className="rounded-2xl p-8 text-center"
                style={{
                  backgroundColor: "#111111",
                  border: "1px solid #1F1F1F",
                  minHeight: "280px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <p className="text-4xl mb-4">📲</p>
                <p className="text-gray-400 text-sm">
                  Hover a tile to see your lead card
                </p>
                <p className="text-gray-600 text-xs mt-2">
                  Every call = a structured card delivered to your phone
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
