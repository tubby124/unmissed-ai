import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LeadCard from "@/components/LeadCard";
import PricingCards from "@/components/PricingCards";
import FaqAccordion from "@/components/FaqAccordion";
import ErrorBoundary from "@/components/ErrorBoundary";
import TryDemoPopup from "@/components/TryDemoPopup";
import { nicheSchema } from "@/lib/schema";
import Link from "next/link";
import type { NichePageData } from "@/lib/niche-pages";

const STAT_COLORS: Record<string, string> = {
  primary: "var(--color-primary)",
  red: "#EF4444",
  green: "#22C55E",
};

export default function NicheLandingPage({ data }: { data: NichePageData }) {
  const schema = nicheSchema(data.schema.name, data.schema.description);
  const secondaryCta = data.hero.secondaryCta ?? { href: "/try", label: "Try a Live Demo" };
  const leadCardLabel = data.hero.leadCardLabel ?? "This hits your Telegram within seconds of every call:";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <Navbar />

      <main style={{ backgroundColor: "var(--color-bg)" }}>
        {/* Hero */}
        <section className="relative pt-32 pb-20 px-4 overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-3xl opacity-10 pointer-events-none"
            style={{ backgroundColor: "var(--color-primary)" }}
          />
          <div className="relative max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p
                  className="text-xs font-mono uppercase tracking-widest mb-3"
                  style={{ color: "var(--color-primary)" }}
                >
                  {data.hero.subtitle}
                </p>
                <h1
                  className="text-4xl md:text-5xl font-black mb-4 leading-tight"
                  style={{ color: "var(--color-text-1)" }}
                >
                  {data.hero.headline}
                </h1>
                <p
                  className="text-lg leading-relaxed mb-6"
                  style={{ color: "var(--color-text-2)" }}
                >
                  {data.hero.body}
                </p>
                <p
                  className={`font-semibold text-lg ${data.hero.proofLine ? "mb-4" : "mb-8"}`}
                  style={{ color: "var(--color-text-1)" }}
                >
                  {data.hero.tagline}
                </p>

                {data.hero.proofLine && (
                  <p
                    className="text-sm px-3 py-2 rounded-lg mb-8 inline-block"
                    style={{ backgroundColor: "var(--color-surface)", color: "var(--color-primary)" }}
                  >
                    {data.hero.proofLine}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href={`/onboard?niche=${data.nicheParam}`}
                    className="px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors text-center"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    {data.hero.ctaLabel}
                  </Link>
                  <Link
                    href={secondaryCta.href}
                    className="px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors text-center"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text-2)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {secondaryCta.label}
                  </Link>
                </div>

                <p className="text-xs mt-3" style={{ color: "var(--color-text-3)" }}>
                  No contracts · Agent live within 24 hours
                </p>
              </div>

              {/* Lead card preview */}
              <div>
                <p
                  className="text-xs text-center mb-3"
                  style={{ color: "var(--color-text-2)" }}
                >
                  {leadCardLabel}
                </p>
                <LeadCard niche={data.leadCardNiche} />
              </div>
            </div>
          </div>
        </section>

        {/* Stat bar */}
        <div
          className="py-8 px-4"
          style={{
            backgroundColor: "var(--color-surface)",
            borderTop: "1px solid var(--color-border)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {data.stats.map((stat, i) => (
              <div key={i}>
                <p
                  className="text-3xl font-black mb-1"
                  style={{ color: STAT_COLORS[stat.color] }}
                >
                  {stat.value}
                </p>
                <p className="text-sm" style={{ color: "var(--color-text-2)" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* What your agent collects */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2
                className="text-2xl md:text-3xl font-bold mb-3"
                style={{ color: "var(--color-text-1)" }}
              >
                {data.collected.headline}
              </h2>
              <p style={{ color: "var(--color-text-2)" }}>
                {data.collected.subtext}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.collected.items.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl p-4 text-center"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="flex justify-center mb-2">
                    <item.icon size={22} style={{ color: "var(--color-primary)" }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-1)" }}>
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Demo section */}
        <section id="demo" className="py-12 px-4">
          <div
            className="max-w-2xl mx-auto rounded-xl p-6 text-center"
            style={
              data.demo.type === "live"
                ? { backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }
                : { backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }
            }
          >
            <p
              className="font-semibold text-sm mb-1"
              style={{ color: data.demo.type === "live" ? "#22C55E" : "#F59E0B" }}
            >
              {data.demo.type === "live" ? "Live Agent" : "Coming Soon"}
            </p>
            <p style={{ color: "var(--color-text-2)" }} className="text-sm mb-3">
              {data.demo.text}
            </p>
            <Link
              href="/try"
              className="inline-block px-6 py-2.5 rounded-xl text-white font-semibold text-sm"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Try a Live Demo Agent
            </Link>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2
                className="text-3xl font-bold mb-2"
                style={{ color: "var(--color-text-1)" }}
              >
                {data.pricing.headline}
              </h2>
              <p style={{ color: "var(--color-text-2)" }}>
                {data.pricing.subtext}
              </p>
            </div>
            <ErrorBoundary>
              <PricingCards compact />
            </ErrorBoundary>
          </div>
        </section>

        {/* FAQ */}
        <ErrorBoundary>
          <FaqAccordion />
        </ErrorBoundary>

        {/* Final CTA */}
        <section
          className="py-20 px-4 text-center"
          style={{ backgroundColor: "var(--color-surface)" }}
        >
          <div className="max-w-xl mx-auto">
            <h2
              className="text-3xl font-bold mb-4"
              style={{ color: "var(--color-text-1)" }}
            >
              {data.finalCta.headline}
            </h2>
            <Link
              href={`/onboard?niche=${data.nicheParam}`}
              className="inline-block px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              {data.finalCta.ctaLabel}
            </Link>
            <p className="text-xs mt-3" style={{ color: "var(--color-text-3)" }}>
              Agent live within 24 hours · No contracts · 30-day guarantee
            </p>
          </div>
        </section>
      </main>

      <Footer />
      {data.showDemoPopup && <TryDemoPopup />}
    </>
  );
}
