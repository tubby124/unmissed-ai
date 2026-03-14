const reviews = [
  {
    platform: "Google",
    rating: 5,
    reviewer: "Mark T.",
    text: "Best investment I've made for the shop. Stopped losing jobs to voicemail overnight.",
  },
  {
    platform: "Google",
    rating: 5,
    reviewer: "Hasan S.",
    text: "2,082 calls handled while I was out showing properties. Incredible.",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <span className="text-yellow-400 text-sm">
      {"★".repeat(count)}{"☆".repeat(5 - count)}
    </span>
  );
}

export default function ReviewBadges() {
  return (
    <section className="py-12 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="max-w-4xl mx-auto">
        <p className="text-center text-xs uppercase tracking-widest font-mono mb-6" style={{ color: "var(--color-text-3)" }}>
          What early clients are saying
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((review, i) => (
            <div
              key={i}
              className="rounded-xl p-5"
              style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: "var(--color-border)", color: "var(--color-text-1)" }}
                  >
                    {review.reviewer.split(" ")[0][0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-text-1)" }}>{review.reviewer}</p>
                    <Stars count={review.rating} />
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className="text-xs font-semibold"
                    style={{ color: "#4285F4" }}
                  >
                    {review.platform}
                  </p>
                </div>
              </div>
              <p className="text-sm italic" style={{ color: "var(--color-text-2)" }}>
                &ldquo;{review.text}&rdquo;
              </p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "var(--color-text-3)" }}>
          More reviews being collected. Ask us for a live reference call.
        </p>
      </div>
    </section>
  );
}
