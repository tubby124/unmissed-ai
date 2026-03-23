/* ── Demo conversation data — shared by DemoAudioPlayer sub-components ── */

export interface Message {
  role: "agent" | "caller"
  text: string
}

export interface DemoOutcomeData {
  status: "HOT" | "WARM"
  statusColor: string
  caller: string
  intent: string
  nextStep: string
  duration: string
}

export interface DemoNiche {
  id: string
  label: string
  agentName: string
  companyName: string
  messages: Message[]
  outcome: DemoOutcomeData
}

export const DEMOS: DemoNiche[] = [
  {
    id: "auto-glass",
    label: "Auto Glass",
    agentName: "Tyler",
    companyName: "Crystal Clear Auto Glass",
    messages: [
      { role: "agent", text: "Crystal Clear Auto Glass, this is Tyler \u2014 how can I help ya?" },
      { role: "caller", text: "Hey, I\u2019ve got a big crack running across my windshield" },
      { role: "agent", text: "Oof, sounds like a full replacement. What year and make is your vehicle?" },
      { role: "caller", text: "2021 Honda CR-V" },
      { role: "agent", text: "Got it \u2014 2021 CR-V. Does it have that lane assist camera near the mirror?" },
      { role: "caller", text: "Yeah I think so" },
      { role: "agent", text: "Alright, I\u2019ll get the boss to call ya back with a quote. Talk soon!" },
    ],
    outcome: {
      status: "WARM",
      statusColor: "#F59E0B",
      caller: "Customer",
      intent: "Windshield replacement \u2014 2021 Honda CR-V + ADAS calibration",
      nextStep: "Boss calling back with quote",
      duration: "1:38",
    },
  },
  {
    id: "property-mgmt",
    label: "Property Mgmt",
    agentName: "Nicole",
    companyName: "Maple Ridge Properties",
    messages: [
      { role: "agent", text: "Maple Ridge Properties, this is Nicole \u2014 how can I help you?" },
      { role: "caller", text: "Hi, I\u2019m in unit 204 and there\u2019s water leaking from the ceiling" },
      { role: "agent", text: "Oh no, sorry to hear that. Is it actively dripping right now?" },
      { role: "caller", text: "Yeah it\u2019s coming through pretty fast" },
      { role: "agent", text: "That sounds urgent \u2014 I\u2019m flagging this for Sarah right now. Can I get your name?" },
      { role: "caller", text: "It\u2019s Mike Chen" },
      { role: "agent", text: "Got it Mike. Sarah\u2019ll get someone over right away. Hang tight!" },
    ],
    outcome: {
      status: "HOT",
      statusColor: "#EF4444",
      caller: "Mike Chen",
      intent: "Active water leak \u2014 Unit 204, ceiling dripping",
      nextStep: "Manager dispatched immediately",
      duration: "1:24",
    },
  },
  {
    id: "real-estate",
    label: "Real Estate",
    agentName: "Aisha",
    companyName: "West Side Realty",
    messages: [
      { role: "agent", text: "West Side Realty, this is Aisha \u2014 how can I help you today?" },
      { role: "caller", text: "Hi, I saw a listing on 45 Maple Drive \u2014 is it still available?" },
      { role: "agent", text: "Yes it is! Are you looking to schedule a showing?" },
      { role: "caller", text: "Yeah, could I see it this weekend?" },
      { role: "agent", text: "Absolutely. Saturday at 2pm or Sunday at 11am work?" },
      { role: "caller", text: "Saturday at 2 works great" },
      { role: "agent", text: "You\u2019re booked in. I\u2019ll send you a confirmation text. Can I grab your name?" },
    ],
    outcome: {
      status: "HOT",
      statusColor: "#EF4444",
      caller: "Caller",
      intent: "Showing request \u2014 45 Maple Drive, Saturday 2pm",
      nextStep: "SMS confirmation sent, showing booked",
      duration: "1:12",
    },
  },
]
