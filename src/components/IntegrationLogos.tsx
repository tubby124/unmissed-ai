const integrations = [
  { name: "Twilio", description: "Call routing & SMS", icon: "📞" },
  { name: "Telegram", description: "Instant lead alerts", icon: "📲" },
  { name: "Google Sheets", description: "Your call log lives here", icon: "📊" },
  { name: "n8n", description: "Workflow automation", icon: "⚙️" },
  { name: "Claude AI", description: "Conversation intelligence", icon: "🧠" },
  { name: "Ultravox", description: "Natural voice AI", icon: "🎙️" },
];

export default function IntegrationLogos() {
  return (
    <section className="py-16 px-4" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-gray-600 text-xs uppercase tracking-widest font-mono mb-8">
          Built on enterprise-grade infrastructure
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="rounded-xl p-4 text-center transition-colors hover:border-gray-600"
              style={{
                backgroundColor: "#111111",
                border: "1px solid #1F1F1F",
              }}
            >
              <div className="text-2xl mb-2">{integration.icon}</div>
              <p className="text-white text-xs font-semibold">{integration.name}</p>
              <p className="text-gray-600 text-xs mt-0.5">{integration.description}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          And more integrations coming soon.
        </p>
      </div>
    </section>
  );
}
