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
    id: "voicemail-replacement",
    label: "Voicemail Replacement",
    agentName: "Zara",
    companyName: "EndVoicemail.ai Demo",
    messages: [
      { role: "agent", text: "Hey, this is Zara from EndVoicemail. Quick demo: what kind of business should I pretend I’m answering for?" },
      { role: "caller", text: "Let’s say a plumbing company." },
      { role: "agent", text: "Perfect. And what’s the missed-call problem — after-hours emergencies, busy crews, or people just not leaving useful voicemails?" },
      { role: "caller", text: "Mostly after-hours calls. They leave vague voicemails and we don’t know who’s urgent." },
      { role: "agent", text: "Got it. Now act like the caller: what do you need help with tonight?" },
      { role: "caller", text: "My basement drain is backing up and there’s water coming in." },
      { role: "agent", text: "That’s urgent. I’d grab your name, address, callback number, how fast it’s spreading, then flag it as a hot callback instead of dumping audio in voicemail." },
      { role: "caller", text: "So the owner gets the summary right away?" },
      { role: "agent", text: "Exactly: hot plumbing lead, basement backup, call back immediately. That’s the product — less voicemail, more callbacks that actually close." },
    ],
    outcome: {
      status: "HOT",
      statusColor: "#EF4444",
      caller: "After-hours plumbing caller",
      intent: "Basement drain backup — urgent water issue, needs callback now",
      nextStep: "Owner receives HOT summary and calls back first",
      duration: "1:46",
    },
  },
  {
    id: "auto-glass",
    label: "Auto Glass",
    agentName: "Zara",
    companyName: "Crystal Clear Auto Glass",
    messages: [
      { role: "agent", text: "Crystal Clear Auto Glass, this is Zara. Are you calling about a chip repair or a windshield replacement?" },
      { role: "caller", text: "Replacement. The crack is across the driver side." },
      { role: "agent", text: "Got it. What year, make, and model is the vehicle?" },
      { role: "caller", text: "2021 Honda CR-V." },
      { role: "agent", text: "Thanks. Does it have lane assist or a camera near the mirror?" },
      { role: "caller", text: "Yeah, I think it has lane assist." },
      { role: "agent", text: "Perfect. Last one: are you going through insurance or paying cash, and how soon do you need it done?" },
      { role: "caller", text: "Cash if it’s not crazy. This week if possible." },
      { role: "agent", text: "I’ll flag this as a replacement lead: 2021 CR-V, ADAS likely, cash quote, this-week timeline. The shop can call back with the right glass and calibration question ready." },
    ],
    outcome: {
      status: "WARM",
      statusColor: "#F59E0B",
      caller: "Windshield replacement caller",
      intent: "2021 Honda CR-V replacement — likely ADAS, cash quote, this-week timeline",
      nextStep: "Shop calls back with quote + calibration follow-up",
      duration: "1:58",
    },
  },
  {
    id: "property-mgmt",
    label: "Property Mgmt",
    agentName: "Zara",
    companyName: "Maple Ridge Properties",
    messages: [
      { role: "agent", text: "Maple Ridge Properties, this is Zara. Are you a tenant, owner, or calling about a rental?" },
      { role: "caller", text: "Tenant. I’m in unit 204 and there’s water leaking from the ceiling." },
      { role: "agent", text: "I’m sorry — is it actively dripping right now or just a stain?" },
      { role: "caller", text: "Actively dripping. It’s getting worse." },
      { role: "agent", text: "That’s urgent. What’s your name and the best number for maintenance to call back?" },
      { role: "caller", text: "Mike Chen, same number I’m calling from." },
      { role: "agent", text: "Got it Mike. I’m flagging this as an active leak in unit 204 so the manager sees it ahead of routine calls." },
    ],
    outcome: {
      status: "HOT",
      statusColor: "#EF4444",
      caller: "Mike Chen",
      intent: "Active water leak — Unit 204, ceiling dripping and worsening",
      nextStep: "Manager gets HOT maintenance alert",
      duration: "1:31",
    },
  },
  {
    id: "real-estate",
    label: "Real Estate",
    agentName: "Zara",
    companyName: "West Side Realty",
    messages: [
      { role: "agent", text: "West Side Realty, this is Zara. Are you calling about a specific listing or looking generally?" },
      { role: "caller", text: "A listing on 45 Maple Drive. Is it still available?" },
      { role: "agent", text: "I can take the showing request for the agent. Are you already working with a Realtor?" },
      { role: "caller", text: "No, not yet." },
      { role: "agent", text: "Great. What day works best, and what’s your name and callback number?" },
      { role: "caller", text: "Saturday afternoon. Name is Jamie." },
      { role: "agent", text: "Perfect — I’ll send the agent: Jamie, interested in 45 Maple Drive, unrepresented buyer, Saturday afternoon request." },
    ],
    outcome: {
      status: "HOT",
      statusColor: "#EF4444",
      caller: "Jamie",
      intent: "Showing request — 45 Maple Drive, unrepresented buyer, Saturday afternoon",
      nextStep: "Agent calls back to confirm availability and showing details",
      duration: "1:22",
    },
  },
]
