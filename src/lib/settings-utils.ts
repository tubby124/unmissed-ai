// ── Settings page utilities — shared between SettingsView and AgentOverviewCard ─

export function fmtPhone(p: string | null): string {
  if (!p) return '—'
  const d = p.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  }
  return p
}

export function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor(diff / 3600000)
  if (days > 30) return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
  if (days > 0) return `${days}d ago`
  if (hrs > 0) return `${hrs}h ago`
  return 'Just now'
}

export function getPlanName(limit: number | null): string {
  if (!limit || limit <= 50) return 'Starter (Trial)'
  if (limit <= 100) return 'Starter'
  if (limit <= 200) return 'Growth'
  if (limit <= 500) return 'Scale'
  return 'Enterprise'
}

// ── CSV utilities ──────────────────────────────────────────────────────────────

export function parseCsvRaw(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^\uFEFF/, '').trim()
  const lines = clean.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }
  function parseRow(line: string): string[] {
    const cells: string[] = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (c === ',' && !inQuote) { cells.push(cur.trim()); cur = '' }
      else cur += c
    }
    cells.push(cur.trim())
    return cells
  }
  return { headers: parseRow(lines[0]), rows: lines.slice(1).map(parseRow) }
}

export function detectKeyColumns(headers: string[]): string[] {
  const key = headers.filter(h =>
    /unit|suite|apt|apartment|door/i.test(h) ||
    /address|addr|street|property/i.test(h) ||
    /name|tenant|resident|renter|owner/i.test(h) ||
    /phone|tel|mobile|cell|contact/i.test(h) ||
    /status|active|lease|vacant/i.test(h)
  )
  return key.length > 0 ? key : headers.slice(0, Math.min(headers.length, 5))
}

export function columnsToMarkdownTable(headers: string[], selectedCols: string[], rows: string[][]): string {
  const colIndices = selectedCols.map(c => headers.indexOf(c)).filter(i => i >= 0)
  const selHeaders = colIndices.map(i => headers[i])
  const divider = selHeaders.map(() => '---')
  const dataRows = rows.map(row => colIndices.map(i => row[i] ?? ''))
  return [selHeaders, divider, ...dataRows].map(row => '| ' + row.join(' | ') + ' |').join('\n')
}
