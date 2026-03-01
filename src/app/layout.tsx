import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://unmissed.ai";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "unmissed.ai — AI Receptionist for Service Businesses",
    template: "%s | unmissed.ai",
  },
  description:
    "Stop losing leads to voicemail. Your AI receptionist answers every call 24/7, collects lead info, and sends you instant notifications. 8,445+ calls handled. Starts at $147/mo.",
  keywords: [
    "AI receptionist",
    "AI answering service",
    "missed call solution",
    "auto glass AI receptionist",
    "HVAC call answering",
    "plumber AI receptionist",
    "never miss a customer call",
    "done for you AI receptionist",
    "small business call answering",
  ],
  authors: [{ name: "unmissed.ai" }],
  creator: "unmissed.ai",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "unmissed.ai",
    title: "unmissed.ai — AI Receptionist for Service Businesses",
    description:
      "Stop losing leads to voicemail. Your AI agent answers every call 24/7, knows your business, and sends you the lead instantly. 8,445+ calls handled.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "unmissed.ai — AI Receptionist for Service Businesses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "unmissed.ai — AI Receptionist for Service Businesses",
    description:
      "Stop losing leads to voicemail. AI agent answers every call 24/7. 8,445+ calls handled.",
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
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "unmissed.ai",
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  description:
    "Done-for-you AI receptionist service for small businesses. AI voice agents that answer every call, collect lead info, and send instant notifications.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    availableLanguage: "English",
  },
  areaServed: ["US", "CA"],
  serviceType: "AI Receptionist Service",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {/* Google Analytics 4 — replace G-XXXXXXXXXX with real ID when ready */}
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
        {children}
      </body>
    </html>
  );
}
