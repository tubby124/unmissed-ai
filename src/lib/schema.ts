const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://unmissed.ai";

export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Will customers know it's AI?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most can't tell. But if asked directly, the agent says it's an AI assistant for your business. Transparency builds trust — and it's required by law in some US states. Your agent identifies itself professionally at the start of every call.",
      },
    },
    {
      "@type": "Question",
      name: "What if the agent says something wrong?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The agent only knows what you tell it — it never guesses. If it doesn't know the answer, it takes a message and lets the caller know you'll follow up. You review everything in your call log.",
      },
    },
    {
      "@type": "Question",
      name: "Does it work after hours and on weekends?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Your agent works 24/7/365 — including weekends, holidays, and 2am emergencies. An 11pm burst pipe call gets answered and you get the lead in the morning.",
      },
    },
    {
      "@type": "Question",
      name: "How do I update what the agent knows?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Your agent's knowledge lives in a Google Sheet we set up for you. You or we can update it anytime in minutes — no coding required. Plus, with our Learning Loop, your agent automatically improves every week based on real call transcripts.",
      },
    },
    {
      "@type": "Question",
      name: "What if I want to cancel?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Month-to-month, no contracts. Cancel anytime. Your call logs stay in your own Google Sheet — we don't hold your data hostage.",
      },
    },
  ],
};

export const pricingSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "unmissed.ai AI Receptionist",
  description:
    "Done-for-you AI receptionist service. AI voice agent answers every call 24/7, collects lead info, and sends instant notifications to your phone.",
  url: `${siteUrl}/pricing`,
  brand: {
    "@type": "Brand",
    name: "unmissed.ai",
  },
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "147",
    highPrice: "397",
    priceCurrency: "USD",
    offerCount: 3,
  },
};

export function nicheSchema(niche: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `unmissed.ai — AI Receptionist for ${niche}`,
    description,
    provider: {
      "@type": "Organization",
      name: "unmissed.ai",
      url: siteUrl,
    },
    serviceType: "AI Receptionist",
    areaServed: ["US", "CA"],
    availableChannel: {
      "@type": "ServiceChannel",
      servicePhone: {
        "@type": "ContactPoint",
        contactType: "customer service",
        availableLanguage: "English",
      },
    },
  };
}
