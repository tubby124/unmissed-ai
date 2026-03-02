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
    <section className="py-12 px-4" style={{ backgroundColor: "#0D0D0D" }}>
      <div className="max-w-4xl mx-auto">
        <p className="text-center text-gray-600 text-xs uppercase tracking-widest font-mono mb-6">
          What early clients are saying
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((review, i) => (
            <div
              key={i}
              className="rounded-xl p-5"
              style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: "#1F1F1F" }}
                  >
                    {review.reviewer.split(" ")[0][0]}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{review.reviewer}</p>
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
              <p className="text-gray-400 text-sm italic">
                &ldquo;{review.text}&rdquo;
              </p>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          More reviews being collected. Ask us for a live reference call.
        </p>
      </div>
    </section>
  );
}
