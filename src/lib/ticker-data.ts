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

export const marqueeTestimonials = [
  {
    quote: "I used to lose 3-4 jobs a week to voicemail. Now every call gets answered while we're doing installs.",
    author: "Mark",
    business: "Windshield Hub Auto Glass",
    location: "Saskatoon, SK",
    stars: 5,
  },
  {
    quote: "My agent Aisha handles 2,000+ calls a year while I'm showing properties. Never missed a lead since.",
    author: "Hasan S.",
    business: "EXP Realty",
    location: "Edmonton, AB",
    stars: 5,
  },
  {
    quote: "Set up in 24 hours. The agent knew my whole service menu from day one. Customers can't tell it's AI.",
    author: "Glass Shop Owner",
    business: "Auto Glass Client",
    location: "Phoenix, AZ",
    stars: 5,
  },
  {
    quote: "Our emergency HVAC calls used to go to voicemail at night. Now every $2,000 job gets captured.",
    author: "HVAC Tech",
    business: "Heating & Cooling Client",
    location: "Dallas, TX",
    stars: 5,
  },
  {
    quote: "The Telegram notification hits my phone before I've even put down my tools. ROI in the first week.",
    author: "Plumber",
    business: "Service Plumbing Client",
    location: "Denver, CO",
    stars: 5,
  },
];

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
