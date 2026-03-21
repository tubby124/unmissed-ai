import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { SITE_URL } from "@/lib/app-url";

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "unmissed.ai — AI Receptionist for Service Businesses",
    template: "%s | unmissed.ai",
  },
  description:
    "Stop losing leads to voicemail. Your AI receptionist answers every call 24/7, collects lead info, and sends you instant notifications. AI receptionist for small businesses.",
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
  other: {
    "theme-color": "#F9FAFB",
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: siteUrl,
    siteName: "unmissed.ai",
    title: "unmissed.ai — AI Receptionist for Service Businesses",
    description:
      "Stop losing leads to voicemail. Your AI agent answers every call 24/7, knows your business, and sends you the lead instantly. AI receptionist for small businesses.",
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
      "Stop losing leads to voicemail. AI agent answers every call 24/7. AI receptionist for small businesses.",
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

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "unmissed.ai",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "297",
    priceCurrency: "CAD",
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
            __html: `(function(){var t=localStorage.getItem('unmissed-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')})()`,
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
