import { PLANS, CURRENCY, TRIAL, POLICIES } from "@/lib/pricing";

import { SITE_URL } from "@/lib/app-url";
import { BRAND_NAME, BRAND_PRODUCT } from "@/lib/brand";

const siteUrl = SITE_URL;

export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Will customers know it's AI?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most can't tell. But if asked directly, the agent says it's an AI assistant for your business. Transparency builds trust — it's our policy and best practice. Your agent identifies itself professionally when asked.",
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
        text: "We handle updates for you. Just message us what changed and we'll update your agent's knowledge base within 24 hours. No dashboard to log into, no prompts to write. Plus, with our Learning Loop, your agent automatically improves every week based on real call transcripts.",
      },
    },
    {
      "@type": "Question",
      name: "What if I want to cancel?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `${POLICIES.cancellation} Your call logs stay in your dashboard — we don't hold your data hostage.`,
      },
    },
  ],
};

export const pricingSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: `${BRAND_NAME} ${BRAND_PRODUCT}`,
  description:
    "Done-for-you AI receptionist service. AI voice agent answers every call 24/7, collects lead info, and sends instant notifications to your phone.",
  url: `${siteUrl}/pricing`,
  brand: {
    "@type": "Brand",
    name: BRAND_NAME,
  },
  offers: {
    "@type": "AggregateOffer",
    lowPrice: String(PLANS[0].monthly),
    highPrice: String(PLANS[PLANS.length - 1].monthly),
    priceCurrency: CURRENCY === "CAD" ? "CAD" : "USD",
    offerCount: PLANS.length,
  },
};

export function nicheSchema(niche: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${BRAND_NAME} — ${BRAND_PRODUCT} for ${niche}`,
    description,
    provider: {
      "@type": "Organization",
      name: BRAND_NAME,
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
