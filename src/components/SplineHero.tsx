'use client'

import Link from 'next/link'
import { SplineScene } from '@/components/ui/splite'
import { Spotlight } from '@/components/ui/spotlight'
import ErrorBoundary from '@/components/ErrorBoundary'

interface SplineHeroProps {
  callsStat: string
}

export function SplineHero({ callsStat }: SplineHeroProps) {
  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden" style={{ backgroundColor: '#0A0A0A' }}>
      {/* Spotlight effect */}
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="#3B82F6"
      />

      <div className="relative max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8">

          {/* ── Left: hero copy ── */}
          <div className="flex-1 text-center lg:text-left z-10">
            {/* Live badge */}
            <div className="flex justify-center lg:justify-start mb-6">
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono"
                style={{ backgroundColor: '#0D1A2E', color: '#3B82F6', border: '1px solid #1E3A5F' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                {callsStat} calls answered · live
              </span>
            </div>

            <p
              className="text-xs font-mono uppercase tracking-widest mb-4"
              style={{ color: '#3B82F6' }}
            >
              AI Receptionist for Service Businesses
            </p>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight mb-6">
              Every call answered.
              <br />
              Every lead captured.
              <br />
              <span style={{ color: '#3B82F6' }}>Even at 2am.</span>
            </h1>

            <p className="text-gray-400 text-lg md:text-xl leading-relaxed mb-4 max-w-xl mx-auto lg:mx-0">
              You&apos;re on the job. A customer calls. 3 rings. They hang up.
              That&apos;s a $400 job gone — to a competitor who picked up.
            </p>
            <p className="text-white text-lg md:text-xl font-semibold mb-10 max-w-xl mx-auto lg:mx-0">
              unmissed.ai fixes that — for good.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6">
              <Link
                href="#demo"
                className="px-8 py-4 rounded-xl text-white font-semibold text-sm transition-colors cursor-pointer"
                style={{ backgroundColor: '#3B82F6' }}
              >
                Hear a Real Demo Call →
              </Link>
              <Link
                href="/onboard"
                className="px-8 py-4 rounded-xl font-semibold text-sm transition-colors cursor-pointer"
                style={{
                  backgroundColor: '#111111',
                  color: '#D1D5DB',
                  border: '1px solid #1F1F1F',
                }}
              >
                Get My Agent Set Up
              </Link>
            </div>

            <p className="text-gray-600 text-xs">
              Trusted by service businesses in Alberta · Saskatchewan · British Columbia · Ontario · Texas
            </p>
            <p className="text-gray-600 text-xs mt-2">
              🔒 No contracts · Cancel anytime · 30-day money-back guarantee
            </p>
          </div>

          {/* ── Right: 3D Spline scene ── */}
          <div className="flex-1 relative h-[420px] lg:h-[540px] w-full rounded-2xl overflow-hidden" style={{ border: '1px solid #1F1F1F' }}>
            <ErrorBoundary fallback={<div className="w-full h-full" style={{ backgroundColor: '#0D1117' }} />}>
              <SplineScene
                scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                className="w-full h-full"
              />
            </ErrorBoundary>
          </div>

        </div>
      </div>
    </section>
  )
}
