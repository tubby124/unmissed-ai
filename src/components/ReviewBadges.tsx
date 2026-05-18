'use client'

/**
 * ReviewBadges — renders real customer testimonials.
 *
 * Reads from src/lib/testimonials.ts. Renders NOTHING if the list is empty.
 * Adding a testimonial: edit testimonials.ts only. No fake content.
 */

import { TESTIMONIALS, type Testimonial } from '@/lib/testimonials'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

function Card({ t }: { t: Testimonial }) {
  return (
    <div
      className="rounded-2xl p-5 space-y-3"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-1)' }}>
        &ldquo;{t.quote}&rdquo;
      </p>
      <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        {t.photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.photoPath}
            alt={t.name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: 'var(--color-primary)' }}
            aria-hidden="true"
          >
            {initials(t.name).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>{t.name}</p>
          <p className="text-xs truncate" style={{ color: 'var(--color-text-3)' }}>
            {t.business}{t.city ? ` · ${t.city}` : ''}
          </p>
        </div>
      </div>
      {t.metric && (
        <p className="text-xs font-mono px-2.5 py-1.5 rounded-md inline-block" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}>
          {t.metric}
        </p>
      )}
    </div>
  )
}

export default function ReviewBadges() {
  if (TESTIMONIALS.length === 0) return null

  return (
    <section className="py-16 px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--color-primary)' }}>
            Real customers
          </p>
          <h2 className="text-3xl font-bold" style={{ color: 'var(--color-text-1)' }}>
            What they say
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t) => (
            <Card key={t.slug} t={t} />
          ))}
        </div>
      </div>
    </section>
  )
}
