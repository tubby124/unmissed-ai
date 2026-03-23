"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import LeadCard from "./LeadCard";
import { motion, AnimatePresence } from "motion/react";
import { NICHES } from "@/lib/niches";

export default function NicheSelectorGrid() {
  const [hoveredNiche, setHoveredNiche] = useState<string | null>(null);
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);

  const activeId = hoveredNiche || selectedNiche;
  const activeNiche = NICHES.find((n) => n.id === activeId);

  const handleTileInteraction = useCallback(
    (nicheId: string, e: React.MouseEvent) => {
      if ("ontouchstart" in window && selectedNiche !== nicheId) {
        e.preventDefault();
        setSelectedNiche(nicheId);
      }
    },
    [selectedNiche]
  );

  return (
    <section id="niches" className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "var(--color-primary)" }}
          >
            Built for your industry
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
            I work in…
          </h2>
          <p className="text-lg" style={{ color: "var(--color-text-3)" }}>
            Select an industry to see what your lead cards look like.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Niche tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {NICHES.map((niche, i) => {
              const NicheIcon = niche.icon;
              return (
                <motion.div
                  key={niche.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 300, damping: 24, delay: i * 0.05 }}
                  whileHover={{ scale: 1.03, y: -2 }}
                >
                  <Link
                    href={niche.href}
                    className="group rounded-2xl p-4 transition-all duration-200 cursor-pointer block"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      border: `1px solid ${
                        activeId === niche.id ? "var(--color-primary)" : "var(--color-border)"
                      }`,
                    }}
                    onClick={(e) => handleTileInteraction(niche.id, e)}
                    onMouseEnter={() => setHoveredNiche(niche.id)}
                    onMouseLeave={() => setHoveredNiche(null)}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                      style={{ backgroundColor: "rgba(99,102,241,0.12)" }}
                    >
                      <NicheIcon size={20} style={{ color: "var(--color-primary)" }} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold" style={{ color: "var(--color-text-1)" }}>{niche.label}</p>
                      {niche.live && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Live
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-3)" }}>{niche.stat}</p>
                    <p
                      className="text-xs mt-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--color-primary)" }}
                    >
                      See example →
                    </p>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Lead card preview */}
          <div className="lg:sticky lg:top-24">
            <AnimatePresence mode="wait">
              {activeNiche ? (
                <motion.div
                  key={activeNiche.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                >
                  <p className="text-xs mb-3 text-center" style={{ color: "var(--color-text-3)" }}>
                    This is what you&apos;d receive after each {activeNiche.label} call:
                  </p>
                  <LeadCard niche={activeNiche.leadCardNiche as "auto-glass" | "hvac" | "plumbing" | "dental" | "legal" | "realty"} />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="rounded-2xl p-8 text-center"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    minHeight: "280px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto"
                    style={{ backgroundColor: "rgba(99,102,241,0.12)" }}
                  >
                    <MessageSquare size={24} style={{ color: "var(--color-primary)" }} />
                  </div>
                  <p className="text-sm" style={{ color: "var(--color-text-2)" }}>
                    Select a tile to see your lead card
                  </p>
                  <p className="text-xs mt-2" style={{ color: "var(--color-text-3)" }}>
                    Every call = a structured card delivered to your phone
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
