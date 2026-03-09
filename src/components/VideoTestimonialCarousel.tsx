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
    caller: "Jacob",
    intent: "Active dishwasher leak — 4705 81st St NW, water on floor",
    nextStep: "Ray dispatched immediately — callback confirmed",
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
    <section className="py-20 px-4" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "#3B82F6" }}>
            Real Outcomes
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            These happened this week.
          </h2>
          <p className="text-zinc-500 text-lg">
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
                  style={{ backgroundColor: "#0D1A2E", border: "1px solid #1E3A5F", minHeight: "220px" }}
                >
                  <div>
                    <div className="text-3xl mb-4">{o.icon}</div>
                    <p className="text-white font-semibold text-sm mb-2">{o.niche}</p>
                    <p className="text-zinc-400 text-sm leading-relaxed mb-2">{o.intent}</p>
                    <p className="text-zinc-500 text-xs">{o.nextStep}</p>
                  </div>
                  <Link
                    href="/onboard"
                    className="mt-4 block text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: "#3B82F6" }}
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
                  backgroundColor: style ? style.bg : "#111111",
                  border: `1px solid ${style ? style.border : "#1F1F1F"}`,
                  borderLeft: style ? `3px solid ${style.dot}` : undefined,
                  minHeight: "220px",
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{o.icon}</span>
                    <span className="text-zinc-400 text-xs font-medium">{o.niche}</span>
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
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-zinc-300"
                    style={{ backgroundColor: "#1F1F1F" }}
                  >
                    {o.caller?.[0]}
                  </div>
                  <span className="text-zinc-300 text-sm">{o.caller}</span>
                  {o.duration && (
                    <span className="text-zinc-600 text-xs ml-auto">{o.duration}</span>
                  )}
                </div>

                {/* Intent */}
                <p className="text-zinc-300 text-sm leading-relaxed">{o.intent}</p>

                {/* Next step */}
                <div
                  className="mt-auto pt-3 flex items-start gap-1.5 text-xs"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span style={{ color: style?.color ?? "#60A5FA" }}>→</span>
                  <span className="text-zinc-500">{o.nextStep}</span>
                </div>

                {/* Agent label */}
                {o.agentName && (
                  <p className="text-zinc-700 text-xs">
                    Handled by {o.agentName} · unmissed.ai
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-zinc-700 text-xs mt-4">
          Real call outcomes from our live deployment · Updated weekly
        </p>
      </div>
    </section>
  );
}
