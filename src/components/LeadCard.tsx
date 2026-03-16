interface LeadCardProps {
  niche?: "auto-glass" | "hvac" | "plumbing" | "dental" | "legal" | "salon" | "realty";
  className?: string;
}

const leadData = {
  "auto-glass": {
    badge: "🔥 HOT LEAD",
    badgeColor: "#EF4444",
    title: "Auto Glass — Full Crack",
    fields: [
      { label: "Vehicle", value: "2019 Ford F-150" },
      { label: "Damage", value: "Full crack, 8 inches — driver side" },
      { label: "ADAS Calibration", value: "Yes — required" },
      { label: "Urgency", value: "ASAP — driving tomorrow" },
      { label: "Phone", value: "(306) 555-1234" },
    ],
    time: "3 min ago · Calgary, AB",
  },
  "hvac": {
    badge: "🔥 HOT LEAD",
    badgeColor: "#EF4444",
    title: "HVAC — No Heat Emergency",
    fields: [
      { label: "Issue", value: "Furnace not turning on — no heat" },
      { label: "Home size", value: "2,400 sq ft" },
      { label: "Last serviced", value: "Over 2 years ago" },
      { label: "Urgency", value: "Temp inside dropping — kids at home" },
      { label: "Phone", value: "(403) 555-7890" },
    ],
    time: "11 min ago · Edmonton, AB",
  },
  "plumbing": {
    badge: "🔥 HOT LEAD",
    badgeColor: "#EF4444",
    title: "Plumbing — Pipe Burst",
    fields: [
      { label: "Issue", value: "Burst pipe — water shut off at main" },
      { label: "Location", value: "Basement utility room" },
      { label: "Home type", value: "Single family, 1987 build" },
      { label: "Urgency", value: "Water everywhere — need someone now" },
      { label: "Phone", value: "(587) 555-4321" },
    ],
    time: "2 min ago · Red Deer, AB",
  },
  "realty": {
    badge: "🌡️ WARM LEAD",
    badgeColor: "#F59E0B",
    title: "Real Estate Inquiry",
    fields: [
      { label: "Looking for", value: "3BR detached, $400K–$550K budget" },
      { label: "Timeline", value: "Within 60 days" },
      { label: "Pre-approved", value: "Yes — $520K" },
      { label: "Area", value: "SW Calgary or Cochrane" },
      { label: "Phone", value: "(403) 555-9012" },
    ],
    time: "8 min ago · Calgary, AB",
  },
  "dental": {
    badge: "🌡️ WARM LEAD",
    badgeColor: "#F59E0B",
    title: "Dental — New Patient",
    fields: [
      { label: "Reason", value: "Toothache — upper molar, 3 days" },
      { label: "Insurance", value: "Sun Life — covered" },
      { label: "Last visit", value: "18 months ago" },
      { label: "Availability", value: "Any day this week, morning" },
      { label: "Phone", value: "(780) 555-2345" },
    ],
    time: "15 min ago · Edmonton, AB",
  },
  "legal": {
    badge: "🌡️ WARM LEAD",
    badgeColor: "#F59E0B",
    title: "Legal — Consultation Request",
    fields: [
      { label: "Matter", value: "Employment dispute — wrongful dismissal" },
      { label: "Timeline", value: "Terminated 2 weeks ago" },
      { label: "Has docs", value: "Yes — termination letter, emails" },
      { label: "Budget", value: "Flexible — wants to discuss" },
      { label: "Phone", value: "(604) 555-6789" },
    ],
    time: "22 min ago · Vancouver, BC",
  },
  "salon": {
    badge: "🌡️ WARM LEAD",
    badgeColor: "#F59E0B",
    title: "Salon — Appointment Request",
    fields: [
      { label: "Service", value: "Full color + cut + blowout" },
      { label: "Hair type", value: "Long, thick — virgin hair" },
      { label: "Preferred", value: "Saturday afternoon" },
      { label: "New client", value: "Yes — referred by Sarah M." },
      { label: "Phone", value: "(416) 555-3456" },
    ],
    time: "5 min ago · Toronto, ON",
  },
};

export default function LeadCard({ niche = "auto-glass", className = "" }: LeadCardProps) {
  const data = leadData[niche];

  return (
    <div
      className={`rounded-2xl p-4 font-mono text-xs ${className}`}
      style={{
        backgroundColor: "var(--color-bg)",
        border: `1px solid ${data.badgeColor}33`,
        boxShadow: `0 0 30px ${data.badgeColor}15`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: "#3B82F6" }}
          >
            U
          </div>
          <span className="text-gray-400">unmissed.ai</span>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: data.badgeColor }}
        >
          {data.badge}
        </span>
      </div>

      {/* Title */}
      <p className="text-white font-bold mb-3">{data.title}</p>

      {/* Fields */}
      <div className="space-y-1.5">
        {data.fields.map((field, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-gray-600 w-28 flex-shrink-0">{field.label}:</span>
            <span className="text-gray-300">{field.value}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="mt-3 pt-3 flex items-center gap-2 text-gray-600"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0"
        />
        <span>{data.time}</span>
      </div>
    </div>
  );
}
