import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BRAND_NAME, BRAND_DOMAIN, SUPPORT_EMAIL } from "@/lib/brand";
import { SITE_URL } from "@/lib/app-url";

const PAGE_URL = `${SITE_URL}/about`;
const DESCRIPTION =
  "Why End Voicemail exists, who built it, and what we believe about AI receptionists for small service businesses. Canadian-built, transparent pricing.";

export const metadata: Metadata = {
  title: `About — ${BRAND_NAME}`,
  description: DESCRIPTION,
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: `About — ${BRAND_NAME}`,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `About — ${BRAND_NAME}`,
    description: DESCRIPTION,
  },
};

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Hasan Sharif",
  jobTitle: "Founder",
  worksFor: {
    "@type": "Organization",
    name: BRAND_NAME,
    url: SITE_URL,
  },
  address: [
    {
      "@type": "PostalAddress",
      addressLocality: "Saskatoon",
      addressRegion: "SK",
      addressCountry: "CA",
    },
    {
      "@type": "PostalAddress",
      addressLocality: "Calgary",
      addressRegion: "AB",
      addressCountry: "CA",
    },
  ],
  image: `${SITE_URL}/brand/logo-dark.png`,
  sameAs: [],
};

const aboutPageSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: `About — ${BRAND_NAME}`,
  description: DESCRIPTION,
  url: PAGE_URL,
  datePublished: "2026-05-16",
  isPartOf: {
    "@type": "WebSite",
    name: BRAND_NAME,
    url: SITE_URL,
    publisher: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: SITE_URL,
      founder: {
        "@type": "Person",
        name: "Hasan Sharif",
      },
    },
  },
  about: {
    "@type": "Organization",
    name: BRAND_NAME,
    url: SITE_URL,
  },
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageSchema) }}
      />

      <Navbar />

      <main style={{ backgroundColor: "var(--color-bg)" }}>
        {/* Header */}
        <section className="pt-32 pb-8 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <p
              className="text-xs font-mono uppercase tracking-widest mb-3"
              style={{ color: "var(--color-primary)" }}
            >
              About
            </p>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
              Built for businesses that lose money when the phone rings out.
            </h1>
            <p className="text-gray-400 text-lg">
              A Canadian-built AI receptionist for small service businesses.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="pb-20 px-4">
          <div
            className="max-w-3xl mx-auto rounded-2xl p-8 md:p-12"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="space-y-10 text-gray-300 text-base leading-relaxed">
              {/* The voicemail problem */}
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  The voicemail problem
                </h2>
                <p>
                  Most small service businesses lose more revenue to missed calls
                  than to any other line item on the books. A plumber on a roof, a
                  realtor at a showing, a shop owner with both hands full — the
                  phone rings, nobody answers, the caller hits voicemail, and the
                  caller hangs up. Industry data puts the voicemail-to-callback
                  rate around 20 percent. That means four out of five missed calls
                  are gone for good — most of them straight to the next business on
                  the search results page.
                </p>
                <p className="mt-3">
                  {BRAND_NAME} exists because that math is unacceptable when the
                  fix is a phone that always answers, sounds like a real person,
                  and texts you the lead before the caller has finished parking.
                </p>
              </div>

              {/* Who built this */}
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  Who built this
                </h2>
                <p>
                  {BRAND_NAME} was built by Hasan Sharif, a Canadian operator
                  working out of Saskatoon and Calgary. Hasan came at this problem
                  from the wrong end of it — running a real estate practice where
                  the only time the phone rang was the only time he couldn&apos;t
                  pick it up. He was on showings, in inspections, mid-conversation
                  with another client. The leads kept routing to voicemail, and
                  voicemail kept eating them.
                </p>
                <p className="mt-3">
                  After enough lost deals he stopped looking for a better
                  voicemail greeting and started building the agent that should
                  have been answering in the first place. {BRAND_NAME} is what
                  came out of that. It now answers calls for plumbers, realtors,
                  auto glass shops, and property managers — businesses where the
                  job goes to whoever picks up first.
                </p>
              </div>

              {/* What we believe */}
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  What we believe
                </h2>
                <p className="mb-4">
                  Three principles run through every decision in the product:
                </p>
                <ul className="space-y-4">
                  <li>
                    <span className="text-white font-semibold">
                      Transparent pricing.
                    </span>{" "}
                    Flat monthly rate. No per-minute meter ticking in the
                    background, no surprise overage at month-end, no &quot;starts
                    at&quot; pricing that triples once you read the fine print.
                    You know what you pay before you sign.
                  </li>
                  <li>
                    <span className="text-white font-semibold">
                      Human-sounding AI.
                    </span>{" "}
                    The agent talks like a receptionist, not a phone tree. No
                    robotic cadence, no &quot;press one for sales,&quot; no
                    scripted dead ends. Callers tend not to realize they&apos;re
                    talking to AI — and when they ask, the agent tells them.
                  </li>
                  <li>
                    <span className="text-white font-semibold">
                      Canadian-built, PIPEDA-first.
                    </span>{" "}
                    Built in Canada under Canadian privacy law. PIPEDA-aligned
                    data handling, CASL-compliant messaging, and recording
                    disclosures available out of the box. Your data and your
                    callers&apos; data stay protected.
                  </li>
                </ul>
              </div>

              {/* What we DON'T do */}
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  What we don&apos;t do
                </h2>
                <p className="mb-3">
                  Equally important. We don&apos;t:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-400">
                  <li>Bill by the minute</li>
                  <li>Lock you into long contracts</li>
                  <li>Ship robotic scripts that get hung up on</li>
                  <li>
                    Upsell you to an &quot;enterprise&quot; tier to unlock basic
                    features
                  </li>
                  <li>Sell your data, your call recordings, or your leads</li>
                </ul>
              </div>

              {/* Where we are */}
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  Where we are
                </h2>
                <p>
                  {BRAND_NAME} is operated out of Saskatoon and Calgary — two
                  cities where small service businesses make up the spine of the
                  local economy. Working from that vantage point keeps the product
                  honest. The clients we serve are the same kind of operators we
                  see on the job sites and in the strip-mall storefronts every
                  day, which is why the agent sounds like a working receptionist
                  and not a Silicon Valley demo.
                </p>
                <p className="mt-3">
                  We serve clients across Canada and the United States, but
                  Saskatoon and Calgary are home.
                </p>
              </div>

              {/* Get in touch */}
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  Get in touch
                </h2>
                <p>
                  Want to see what the agent sounds like, or what it costs?
                </p>
                <div
                  className="mt-4 p-5 rounded-xl space-y-2"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <p className="text-gray-300">
                    <span className="text-white font-semibold">See pricing:</span>{" "}
                    <Link
                      href="/pricing"
                      className="hover:text-white transition-colors"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {BRAND_DOMAIN}/pricing
                    </Link>
                  </p>
                  <p className="text-gray-300">
                    <span className="text-white font-semibold">Sign in:</span>{" "}
                    <Link
                      href="/login"
                      className="hover:text-white transition-colors"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {BRAND_DOMAIN}/login
                    </Link>
                  </p>
                  <p className="text-gray-300">
                    <span className="text-white font-semibold">Email:</span>{" "}
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="hover:text-white transition-colors"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {SUPPORT_EMAIL}
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Back link */}
            <div
              className="mt-12 pt-8"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <Link
                href="/"
                className="text-sm hover:text-white transition-colors"
                style={{ color: "var(--color-primary)" }}
              >
                &larr; Back to home
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
