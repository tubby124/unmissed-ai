export interface TickerEvent {
  message: string;
  time: string;
  location: string;
}

// Example activity events — representative of typical agent activity
export const tickerEvents: TickerEvent[] = [
  { message: "🔥 HOT LEAD captured", time: "2 min ago", location: "Auto Glass — Calgary, AB" },
  { message: "📞 Call answered 24/7", time: "4 min ago", location: "Real Estate — Edmonton, AB" },
  { message: "🔥 HOT LEAD captured", time: "7 min ago", location: "Auto Glass — Saskatoon, SK" },
  { message: "📲 Lead card sent to owner", time: "11 min ago", location: "Real Estate — Calgary, AB" },
  { message: "🔥 HOT LEAD captured", time: "14 min ago", location: "Auto Glass — Edmonton, AB" },
  { message: "📞 After-hours call handled", time: "18 min ago", location: "Real Estate — Saskatoon, SK" },
  { message: "🔥 HOT LEAD captured", time: "21 min ago", location: "Auto Glass — Saskatoon, SK" },
  { message: "📲 Lead card sent to owner", time: "25 min ago", location: "Service Business — Calgary, AB" },
  { message: "📞 After-hours call handled", time: "31 min ago", location: "Auto Glass — Calgary, AB" },
  { message: "🔥 HOT LEAD captured", time: "38 min ago", location: "Real Estate — Edmonton, AB" },
];

// Fake testimonials removed in Wave 3A. Add real client quotes here when available.
export const marqueeTestimonials: { quote: string; author: string; business: string; stars: number }[] = [];

export const marqueeStats = [
  { value: "8,445+", label: "Real calls handled" },
  { value: "$126K", label: "Avg SMB loses/year to voicemail" },
  { value: "62%", label: "Of calls go unanswered" },
  { value: "24/7", label: "Always on, never sick" },
  { value: "85%", label: "Of callers never call back" },
  { value: "<15s", label: "Average answer time" },
  { value: "$0", label: "Setup fee for founding members" },
  { value: "2,082", label: "Calls for one realtor team" },
];
