import Link from "next/link";

const outcomes = [
  {
    niche: "Auto Glass",
    agentName: "Mark",
    status: "WARM" as const,
    caller: "Customer",
    intent: "2026 BYD windshield replacement + ADAS calibration needed",
    nextStep: "Callback to confirm weekday booking slot",
    duration: "1:38",
    icon: "🔧",
  },
  {
    niche: "Property Mgmt",
    agentName: "Jade",
    status: "HOT" as const,
    caller: "Mike",
    intent: "Active dishwasher leak — 456 Oak Ave NW, water on floor",
    nextStep: "Manager dispatched immediately — callback confirmed",
    duration: "1:24",
    icon: "🏢",
  },
  {
    niche: "Your Business",
    agentName: null,
    status: null,
    caller: null,
    intent: "Your agent captures every call — 24/7, even when you're on the job.",
    nextStep: "Live within 24 hours. No contracts.",
    duration: null,
    icon: "→",
    isCta: true,
  },
];

const statusStyle: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  HOT:  { color: "#F87171", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", dot: "#EF4444" },
  WARM: { color: "#FCD34D", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", dot: "#F59E0B" },
};

export default function VideoTestimonialCarousel() {
  return (
    <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "var(--color-primary)" }}>
            Real Outcomes
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
            These happened this week.
          </h2>
          <p className="text-lg" style={{ color: "var(--color-text-3)" }}>
            Not marketing copy — actual calls from our live agents.
          </p>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
          {outcomes.map((o, i) => {
            const style = o.status ? statusStyle[o.status] : null;

            if (o.isCta) {
              return (
                <div
                  key={i}
                  className="flex-shrink-0 w-64 md:w-72 rounded-2xl p-5 flex flex-col justify-between snap-start"
                  style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-primary)", minHeight: "220px" }}
                >
                  <div>
                    <div className="text-3xl mb-4">{o.icon}</div>
                    <p className="font-semibold text-sm mb-2" style={{ color: "var(--color-text-1)" }}>{o.niche}</p>
                    <p className="text-sm leading-relaxed mb-2" style={{ color: "var(--color-text-2)" }}>{o.intent}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-3)" }}>{o.nextStep}</p>
                  </div>
                  <Link
                    href="/onboard"
                    className="mt-4 block text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    Get Mine Set Up →
                  </Link>
                </div>
              );
            }

            return (
              <div
                key={i}
                className="flex-shrink-0 w-64 md:w-72 rounded-2xl p-5 snap-start flex flex-col gap-3"
                style={{
                  backgroundColor: style ? style.bg : "var(--color-surface)",
                  border: `1px solid ${style ? style.border : "var(--color-border)"}`,
                  borderLeft: style ? `3px solid ${style.dot}` : undefined,
                  minHeight: "220px",
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{o.icon}</span>
                    <span className="text-xs font-medium" style={{ color: "var(--color-text-2)" }}>{o.niche}</span>
                  </div>
                  {o.status && style && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1"
                      style={{ backgroundColor: style.bg, color: style.color, border: `1px solid ${style.border}` }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: style.dot }} />
                      {o.status}
                    </span>
                  )}
                </div>

                {/* Caller + duration */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: "var(--color-border)", color: "var(--color-text-2)" }}
                  >
                    {o.caller?.[0]}
                  </div>
                  <span className="text-sm" style={{ color: "var(--color-text-2)" }}>{o.caller}</span>
                  {o.duration && (
                    <span className="text-xs ml-auto" style={{ color: "var(--color-text-3)" }}>{o.duration}</span>
                  )}
                </div>

                {/* Intent */}
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-2)" }}>{o.intent}</p>

                {/* Next step */}
                <div
                  className="mt-auto pt-3 flex items-start gap-1.5 text-xs"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span style={{ color: style?.color ?? "#60A5FA" }}>→</span>
                  <span style={{ color: "var(--color-text-3)" }}>{o.nextStep}</span>
                </div>

                {/* Agent label */}
                {o.agentName && (
                  <p className="text-xs" style={{ color: "var(--color-text-3)" }}>
                    Handled by {o.agentName} · unmissed.ai
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "var(--color-text-3)" }}>
          Real call outcomes from our live deployment · Updated weekly
        </p>
      </div>
    </section>
  );
}
