/**
 * Shared context-data helpers used by:
 * - api/webhook/[slug]/inbound/route.ts  (Twilio inbound calls)
 * - api/dashboard/browser-test-call/route.ts  (Lab test calls)
 */

export function parseMarkdownTableHeaders(mdText: string): string[] {
  const firstLine = mdText.trim().split('\n')[0]
  if (!firstLine.startsWith('|')) return []
  return firstLine.split('|').map(c => c.trim()).filter(Boolean)
}

export function buildContextBlock(label: string, data: string): string {
  const columns = parseMarkdownTableHeaders(data)
  if (columns.length === 0) {
    // Plain text / FAQ — no lookup instructions needed
    return `## ${label}\n${data}`
  }

  const hasUnit = columns.some(c => /unit|suite|apt|door/i.test(c))
  const hasAddress = columns.some(c => /address|addr|street|property/i.test(c))
  const hasName = columns.some(c => /name|tenant|resident|renter|owner/i.test(c))

  const matchHints: string[] = []
  if (hasUnit) matchHints.push('unit number (most reliable — prioritize this)')
  if (hasAddress) matchHints.push('street address (partial match fine — "4705B NW" matches "4705B 81 St NW Calgary")')
  if (hasName) matchHints.push('tenant or resident name')
  if (matchHints.length === 0) matchHints.push('the relevant identifier')

  const unitExample = hasUnit ? 'unit [Unit]' : 'the record'
  const nameField = hasName ? 'Tenant Name' : (columns[1] ?? columns[0])

  const instructions = `# ${label} LOOKUP

When the caller mentions ${matchHints.join(', or ')}, search the ${label} table below:
1. PARTIAL MATCH OK — "4705B NW" matches "4705B 81 St NW Calgary AB". Always try partial before giving up.
2. NORMALIZE abbreviations — NW/SW/NE/SE, St/Street, Ave/Avenue, Blvd/Boulevard, Rd/Road, Dr/Drive
3. UNIT NUMBER wins — if caller says "unit 4705B" or "the B unit", match on that field first
4. ONE MATCH → confirm back: "I have ${unitExample} under [${nameField}] — is that right?"
5. MULTIPLE MATCHES → ask one question: "Is that the 4705A or the 4705B unit?"
6. NO MATCH → say "I don't see that in our system — can you give me the full unit number or street address?" NEVER guess or invent a record
7. NEVER ask for info the caller already gave you`

  return `${instructions}\n\n## ${label}\n${data}`
}
