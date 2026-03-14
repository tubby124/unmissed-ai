import { marqueeTestimonials, marqueeStats } from "@/lib/ticker-data";

function StarRating({ stars }: { stars: number }) {
  return (
    <span style={{ color: "#F59E0B" }}>
      {"★".repeat(stars)}{"☆".repeat(5 - stars)}
    </span>
  );
}

function TestimonialCard({ quote, author, business, stars }: {
  quote: string;
  author: string;
  business: string;
  stars: number;
}) {
  return (
    <div
      className="flex-shrink-0 w-72 rounded-xl p-4 mx-3"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <StarRating stars={stars} />
      <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--color-text-2)" }}>"{quote}"</p>
      <div className="mt-3">
        <p className="text-xs font-semibold" style={{ color: "var(--color-text-1)" }}>{author}</p>
        <p className="text-xs" style={{ color: "var(--color-text-3)" }}>{business}</p>
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="flex-shrink-0 flex items-center gap-3 rounded-xl px-5 py-3 mx-3"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div>
        <p className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>{value}</p>
        <p className="text-xs" style={{ color: "var(--color-text-3)" }}>{label}</p>
      </div>
    </div>
  );
}

export default function MarqueeStrip() {
  // Duplicate arrays for seamless loop
  const row1 = [...marqueeTestimonials, ...marqueeTestimonials];
  const row2 = [...marqueeStats, ...marqueeStats];

  return (
    <div className="py-8 overflow-hidden">
      {/* Row 1 — scrolls left */}
      <div className="marquee-mask mb-4">
        <div className="flex marquee-left" style={{ width: "max-content" }}>
          {row1.map((t, i) => (
            <TestimonialCard key={i} {...t} />
          ))}
        </div>
      </div>

      {/* Row 2 — scrolls right */}
      <div className="marquee-mask">
        <div className="flex marquee-right" style={{ width: "max-content" }}>
          {row2.map((s, i) => (
            <StatCard key={i} {...s} />
          ))}
        </div>
      </div>
    </div>
  );
}
