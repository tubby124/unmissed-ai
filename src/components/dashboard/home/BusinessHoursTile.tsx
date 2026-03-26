'use client'

/**
 * BusinessHoursTile — compact business hours bento card.
 * Shows weekday/weekend hours summary. Opens HoursSheet on click.
 */

interface Props {
  hoursWeekday: string | null
  hoursWeekend: string | null
  onOpenSheet: () => void
}

export default function BusinessHoursTile({ hoursWeekday, hoursWeekend, onOpenSheet }: Props) {
  const neitherSet = !hoursWeekday && !hoursWeekend

  return (
    <button
      onClick={onOpenSheet}
      className="rounded-2xl p-4 card-surface flex flex-col gap-3 text-left w-full hover:bg-hover transition-colors group"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">Hours</p>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="t3 opacity-0 group-hover:opacity-100 transition-opacity">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Hours rows */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs t2 flex-1">Weekdays</span>
          <span className="text-xs t2 font-medium truncate max-w-[140px]">{hoursWeekday ?? 'Not set'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs t2 flex-1">Weekends</span>
          <span className="text-xs t2 font-medium truncate max-w-[140px]">{hoursWeekend ?? 'Not set'}</span>
        </div>
      </div>

      {/* Nudge if nothing set */}
      {neitherSet && (
        <p className="text-[11px] t3 leading-relaxed">
          Add your hours so your agent knows when you&apos;re open.
        </p>
      )}
    </button>
  )
}
