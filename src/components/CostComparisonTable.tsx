import Link from "next/link";

const rows = [
  {
    feature: "Monthly cost",
    human: "$3,500+",
    answering: "$300–$500 + overage",
    unmissed: "$147–$397",
    best: "unmissed",
  },
  {
    feature: "Hours covered",
    human: "Business hours only",
    answering: "Limited",
    unmissed: "24/7/365",
    best: "unmissed",
  },
  {
    feature: "After-hours calls",
    human: "❌ No",
    answering: "Sometimes",
    unmissed: "✅ Always",
    best: "unmissed",
  },
  {
    feature: "Sick days / no-shows",
    human: "Yes — gaps happen",
    answering: "Rare",
    unmissed: "✅ Never",
    best: "unmissed",
  },
  {
    feature: "Lead card (structured data)",
    human: "Hit or miss",
    answering: "❌ No",
    unmissed: "✅ Every call",
    best: "unmissed",
  },
  {
    feature: "Instant Telegram/SMS alert",
    human: "❌ No",
    answering: "❌ No",
    unmissed: "✅ Yes",
    best: "unmissed",
  },
  {
    feature: "Learns from its own calls",
    human: "With training",
    answering: "❌ No",
    unmissed: "✅ Weekly (The Learning Loop)",
    best: "unmissed",
  },
  {
    feature: "Setup time",
    human: "2–4 weeks + HR",
    answering: "1–3 days",
    unmissed: "✅ 24 hours",
    best: "unmissed",
  },
];

export default function CostComparisonTable() {
  return (
    <section className="py-20 px-4" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "#3B82F6" }}
          >
            Why not just hire someone?
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            The honest comparison.
          </h2>
          <p className="text-gray-500 text-lg">
            A part-time receptionist costs more and works less.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #1F1F1F" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#111111", borderBottom: "1px solid #1F1F1F" }}>
                <th className="text-left p-4 text-gray-400 font-medium w-1/4">Feature</th>
                <th className="text-center p-4 text-gray-400 font-medium">Human Receptionist</th>
                <th className="text-center p-4 text-gray-400 font-medium">Answering Service</th>
                <th
                  className="text-center p-4 font-semibold rounded-t-none"
                  style={{ color: "#3B82F6", backgroundColor: "#0D1A2E" }}
                >
                  unmissed.ai ⭐
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    backgroundColor: i % 2 === 0 ? "#0A0A0A" : "#0D0D0D",
                    borderBottom: "1px solid #1F1F1F",
                  }}
                >
                  <td className="p-4 text-gray-300 font-medium">{row.feature}</td>
                  <td className="p-4 text-center text-gray-500">{row.human}</td>
                  <td className="p-4 text-center text-gray-500">{row.answering}</td>
                  <td
                    className="p-4 text-center font-semibold"
                    style={{
                      color: "#22C55E",
                      backgroundColor: "rgba(34,197,94,0.04)",
                    }}
                  >
                    {row.unmissed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/onboard"
            className="inline-block px-8 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors"
            style={{ backgroundColor: "#3B82F6" }}
          >
            Get My Agent Set Up →
          </Link>
          <p className="text-gray-600 text-xs mt-2">
            No contracts · No hiring · No training
          </p>
        </div>
      </div>
    </section>
  );
}
