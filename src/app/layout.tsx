import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BRAND_NAME } from "@/lib/brand";
import { websiteSchema, localBusinessSchema } from "@/lib/schema";
import { PUBLIC_PLANS, CURRENCY, getPlanDisplayMonthly } from "@/lib/pricing";
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;

import { SITE_URL } from "@/lib/app-url";

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BRAND_NAME} — AI Receptionist for Service Businesses`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    "Stop losing leads to voicemail. Your AI receptionist answers forwarded missed calls, collects lead info, and sends callback-ready summaries.",
  keywords: [
    "AI receptionist",
    "AI answering service",
    "AI phone agent",
    "AI voice agent",
    "virtual receptionist",
    "missed call solution",
    "voicemail alternative",
    "24/7 phone answering",
    "AI receptionist Canada",
    "AI receptionist for auto glass",
    "auto glass answering service",
    "windshield shop answering service",
    "call recovery",
    "missed call recovery",
    "never miss a customer call",
    "done for you AI receptionist",
    "small business call answering",
    "End Voicemail",
    "Saskatoon AI receptionist",
    "Calgary AI receptionist",
  ],
  authors: [{ name: BRAND_NAME }],
  creator: BRAND_NAME,
  other: {
    "theme-color": "#8B5CF6",
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: siteUrl,
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} — AI Receptionist for Service Businesses`,
    description:
      "Stop losing leads to voicemail. Your AI agent answers forwarded missed calls, knows your business, and sends you the lead details.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME} — AI Receptionist for Service Businesses`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} — AI Receptionist for Service Businesses`,
    description:
      "Stop losing leads to voicemail. AI agent answers forwarded missed calls for small businesses.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: BRAND_NAME,
  alternateName: ["EndVoicemail", "EndVoicemail.ai", "End Voicemail AI"],
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  description:
    "Done-for-you call recovery for small businesses. AI voice agents answer forwarded missed calls, collect lead info, and send callback-ready summaries.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    availableLanguage: "English",
    areaServed: ["CA", "US"],
  },
  areaServed: ["US", "CA"],
  foundingLocation: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Saskatoon",
      addressRegion: "SK",
      addressCountry: "CA",
    },
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: BRAND_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: String(Math.min(...PUBLIC_PLANS.map(getPlanDisplayMonthly))),
    highPrice: String(Math.max(...PUBLIC_PLANS.map(getPlanDisplayMonthly))),
    priceCurrency: CURRENCY === "CAD" ? "CAD" : "USD",
    offerCount: PUBLIC_PLANS.length,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('unmissed-ai-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
                    page_path: window.location.pathname,
                  });
                `,
              }}
            />
          </>
        )}
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <main id="main">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
