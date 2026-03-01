const steps = [
  {
    number: "01",
    icon: "📞",
    title: "Customer calls your number",
    description:
      "Your existing business number (or a new one) forwards to your AI agent. Zero downtime, zero configuration by you.",
  },
  {
    number: "02",
    icon: "🤖",
    title: "AI agent answers — every time",
    description:
      "Your agent knows your business, your services, your pricing. It speaks naturally, collects the caller's info, and qualifies the lead.",
  },
  {
    number: "03",
    icon: "📲",
    title: "You get an instant alert",
    description:
      "A structured lead card hits your Telegram or SMS within seconds: caller name, number, what they need, and how hot the lead is.",
  },
  {
    number: "04",
    icon: "✅",
    title: "You call back only warm leads",
    description:
      "No more chasing cold voicemails. You see the full context before you dial. Close the job, not the guesswork.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-20 px-4"
      style={{ backgroundColor: "#0A0A0A" }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "#3B82F6" }}
          >
            How It Works
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Four steps. Zero work on your end.
          </h2>
          <p className="text-gray-500 text-lg">
            We set it all up. You just get the leads.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {steps.map((step, i) => (
            <div
              key={i}
              className="relative rounded-2xl p-6"
              style={{
                backgroundColor: "#111111",
                border: "1px solid #1F1F1F",
              }}
            >
              {/* Step number */}
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black"
                  style={{ backgroundColor: "#0D1A2E", color: "#3B82F6" }}
                >
                  {step.number}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{step.icon}</span>
                    <h3 className="text-white font-semibold">{step.title}</h3>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Connector arrow (for steps 1, 2, 3 on desktop) */}
              {i < steps.length - 1 && (
                <div
                  className="hidden md:block absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-gray-700 text-xl leading-none z-10"
                  style={{ display: i % 2 === 1 ? "none" : undefined }}
                >
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom proof line */}
        <div className="text-center mt-10">
          <p className="text-gray-600 text-sm">
            8,445+ calls handled · 24/7 coverage · Agent live within 24 hours
          </p>
        </div>
      </div>
    </section>
  );
}
