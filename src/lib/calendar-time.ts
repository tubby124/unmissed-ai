/**
 * Calendar time utilities — shared between book/route.ts and slots/route.ts.
 * Pure functions, no I/O — safe to unit test directly.
 */

/** Normalize time strings to "H:MM AM/PM" format to match displayTime from checkCalendarAvailability */
export function normalizeTime(input: string): string {
  const s = input.trim()
  // Already "H:MM AM/PM" or "HH:MM AM/PM"
  const standard = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (standard) return `${parseInt(standard[1])}:${standard[2]} ${standard[3].toUpperCase()}`
  // "9:00am" / "1:30pm" (no space)
  const compact = s.match(/^(\d{1,2}):(\d{2})(AM|PM)$/i)
  if (compact) return `${parseInt(compact[1])}:${compact[2]} ${compact[3].toUpperCase()}`
  // "9am" / "1pm"
  const short = s.match(/^(\d{1,2})(AM|PM)$/i)
  if (short) return `${parseInt(short[1])}:00 ${short[2].toUpperCase()}`
  // 24-hour "13:00" / "09:00"
  const military = s.match(/^(\d{2}):(\d{2})$/)
  if (military) {
    const h = parseInt(military[1]), m = military[2]
    if (h === 0) return `12:${m} AM`
    if (h < 12) return `${h}:${m} AM`
    if (h === 12) return `12:${m} PM`
    return `${h - 12}:${m} PM`
  }
  return s // passthrough — match attempt will fail gracefully
}

/** Convert a time string to "HH:MM" 24-hour format for listSlots preferredTime.
 *  Handles "H:MM AM/PM", "HH:MM", and full displayTime strings like "Friday March 20 at 2:00 PM".
 *  Returns undefined if parsing fails — listSlots skips sorting gracefully. */
export function toPreferredTime(input: string): string | undefined {
  // Try normalizeTime first (handles compact/short/military formats)
  const normalized = normalizeTime(input)
  // If normalizeTime returned a passthrough, extract just the time portion
  const timeStr = /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(normalized)
    ? normalized
    : (input.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i)?.[1]?.trim() ?? undefined)
  if (!timeStr) return undefined
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return undefined
  let h = parseInt(match[1])
  const m = match[2]
  const ampm = match[3].toUpperCase()
  if (ampm === 'AM' && h === 12) h = 0
  if (ampm === 'PM' && h !== 12) h += 12
  return `${h.toString().padStart(2, '0')}:${m}`
}

/** Check if a requested time string matches the first available slot.
 *  Used in slots/route.ts to decide whether to confirm directly vs offer options. */
export function requestedTimeMatchesSlot(
  requestedTime: string | null | undefined,
  firstSlot: { displayTime: string; start: string } | undefined,
): boolean {
  if (!requestedTime || !firstSlot) return false
  return (
    firstSlot.displayTime.toLowerCase().includes(requestedTime.toLowerCase()) ||
    firstSlot.start.includes(requestedTime)
  )
}
