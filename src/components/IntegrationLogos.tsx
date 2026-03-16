const integrations = [
  { name: "Twilio", description: "Call routing & SMS", icon: "📞" },
  { name: "Telegram", description: "Instant lead alerts", icon: "📲" },
  { name: "Google Sheets", description: "Your call log lives here", icon: "📊" },
  { name: "n8n", description: "Workflow automation", icon: "⚙️" },
  { name: "AI Engine", description: "Voice intelligence", icon: "🧠" },
  { name: "Ultravox", description: "Natural voice AI", icon: "🎙️" },
];

export default function IntegrationLogos() {
  return (
    <section className="py-16 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-xs uppercase tracking-widest font-mono mb-8" style={{ color: "var(--color-text-3)" }}>
          Built on enterprise-grade infrastructure
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="rounded-xl p-4 text-center transition-colors hover:border-gray-600"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="text-2xl mb-2">{integration.icon}</div>
              <p className="text-xs font-semibold" style={{ color: "var(--color-text-1)" }}>{integration.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-3)" }}>{integration.description}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "var(--color-text-3)" }}>
          And more integrations coming soon.
        </p>
      </div>
    </section>
  );
}
