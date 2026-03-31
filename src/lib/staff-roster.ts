export interface StaffMember {
  name: string
  role: string
  availability_note?: string // e.g. "available Mon-Wed", "call-outs only"
}

export function parseStaffRoster(raw: unknown): StaffMember[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (s): s is StaffMember =>
      typeof s === 'object' && s !== null &&
      typeof (s as StaffMember).name === 'string' &&
      (s as StaffMember).name.trim() !== '' &&
      typeof (s as StaffMember).role === 'string'
  )
}

export function formatStaffRoster(staff: StaffMember[]): string {
  if (staff.length === 0) return ''
  const lines = staff.map(s => {
    let line = `- ${s.name.trim()} (${s.role.trim()})`
    if (s.availability_note?.trim()) line += ` — ${s.availability_note.trim()}`
    return line
  })
  return `TEAM MEMBERS:\n${lines.join('\n')}`
}
