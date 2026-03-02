import Link from "next/link";

const testimonials = [
  {
    name: "Mark T.",
    business: "Windshield Hub Auto Glass",
    location: "Calgary, AB",
    quote: "I used to lose 3–4 windshield jobs a week to voicemail. My agent catches everything now — even at 11pm when I'm doing late installs.",
    callsStat: "800+ calls handled",
    placeholder: true,
  },
  {
    name: "Hasan S.",
    business: "eXp Realty",
    location: "Saskatoon, SK",
    quote: "Aisha handled 2,082 calls while I was showing properties. Every lead card hit my Telegram before I was done with the walkthrough.",
    callsStat: "2,082 calls handled",
    placeholder: true,
  },
  {
    name: "Your business here?",
    business: "Join as a founding client",
    location: "CA / US",
    quote: "We're onboarding a small number of founding members at locked-in pricing. Your agent could be live within 24 hours.",
    callsStat: "Founding pricing available",
    placeholder: true,
    cta: true,
  },
];

export default function VideoTestimonialCarousel() {
  return (
    <section className="py-20 px-4" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "#3B82F6" }}>
            Real Results
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Hear it from shop owners like you.
          </h2>
          <p className="text-gray-500 text-lg">
            Not sales demos — real businesses, real calls, real revenue saved.
          </p>
        </div>

        <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-64 md:w-72 rounded-2xl overflow-hidden snap-start relative"
              style={{
                backgroundColor: "#111111",
                border: "1px solid #1F1F1F",
                minHeight: "380px",
              }}
            >
              {/* Thumbnail area */}
              <div
                className="relative flex items-center justify-center"
                style={{ height: "220px", backgroundColor: "#1A1A1A" }}
              >
                {/* Gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to bottom, transparent 40%, #111111 100%)",
                  }}
                />
                {/* Initials avatar */}
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: "#1F1F1F" }}
                >
                  {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                {/* Stat badge */}
                <div
                  className="absolute bottom-3 left-3 px-2 py-1 rounded-md text-xs font-semibold text-white"
                  style={{ backgroundColor: "#3B82F6" }}
                >
                  {t.callsStat}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <p className="text-gray-300 text-sm leading-relaxed mb-3">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="text-white text-sm font-semibold">{t.name}</p>
                  <p className="text-gray-500 text-xs">{t.business}</p>
                  <p className="text-gray-600 text-xs">{t.location}</p>
                </div>
                {t.cta && (
                  <Link
                    href="/onboard"
                    className="mt-3 block text-center py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: "#3B82F6" }}
                  >
                    Claim Founding Spot →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          Real clients, real results. Want to be featured? Join as a founding member.
        </p>
      </div>
    </section>
  );
}
