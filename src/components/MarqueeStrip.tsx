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
      style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
    >
      <StarRating stars={stars} />
      <p className="text-gray-300 text-sm mt-2 leading-relaxed">"{quote}"</p>
      <div className="mt-3">
        <p className="text-white text-xs font-semibold">{author}</p>
        <p className="text-gray-500 text-xs">{business}</p>
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="flex-shrink-0 flex items-center gap-3 rounded-xl px-5 py-3 mx-3"
      style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
    >
      <div>
        <p className="text-white text-sm font-bold" style={{ color: "#3B82F6" }}>{value}</p>
        <p className="text-gray-500 text-xs">{label}</p>
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
