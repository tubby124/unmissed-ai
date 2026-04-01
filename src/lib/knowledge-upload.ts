/**
 * knowledge-upload.ts — Shared utilities for knowledge document processing
 *
 * Extracts text from uploaded files (PDF, TXT, DOCX, CSV),
 * splits into chunks suitable for pgvector embedding.
 *
 * Used by:
 * - /api/client/knowledge/upload (onboarding)
 * - /api/dashboard/knowledge/upload (dashboard)
 */

// ── Constants ──────────────────────────────────────────────────────────────────

/** Max chars to store per document. 50K covers a ~20-page PDF. */
export const MAX_TEXT_LENGTH = 50_000

/** Max file size in bytes (5MB) */
export const MAX_FILE_SIZE = 5 * 1024 * 1024

/** Allowed file extensions */
export const ALLOWED_EXTENSIONS = new Set(['pdf', 'txt', 'docx', 'csv', 'md'])

/** Min chars per chunk — skip fragments shorter than this */
export const MIN_CHUNK_CHARS = 20

/** Max chars per chunk — split paragraphs longer than this */
export const MAX_CHUNK_CHARS = 1500

// ── Text Extraction ────────────────────────────────────────────────────────────

/**
 * Extracts text from a file buffer based on extension/MIME type.
 * Supports: TXT, PDF, CSV, DOCX
 */
export async function extractText(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'txt' || ext === 'md' || mimeType === 'text/plain' || mimeType === 'text/markdown') {
    return buffer.toString('utf-8')
  }

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    return result.text
  }

  if (ext === 'csv' || mimeType === 'text/csv' || mimeType === 'application/vnd.ms-excel') {
    return parseCSV(buffer.toString('utf-8'))
  }

  if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  throw new Error(`Unsupported file type: ${ext}`)
}

/**
 * Parses CSV text: one chunk per data row, with column headers as labels.
 * Output format: "Column1: value | Column2: value | ..."
 * This keeps each chunk self-describing so vector search can match on field names.
 * Handles simple quoted fields (strips quotes).
 */
export function parseCSV(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length <= 1) return text // just header or single line
  const headers = lines[0].replace(/"/g, '').split(',').map(c => c.trim())
  const dataLines = lines.slice(1).map(line => {
    const cells = line.replace(/"/g, '').split(',').map(c => c.trim())
    return headers
      .map((h, i) => (cells[i] ? `${h}: ${cells[i]}` : null))
      .filter(Boolean)
      .join(' | ')
  })
  return dataLines.join('\n')
}

// ── Chunking ───────────────────────────────────────────────────────────────────

/**
 * Splits extracted text into chunks suitable for embedding.
 *
 * Strategy:
 * 1. Split on double newlines (paragraph breaks)
 * 2. If no paragraphs, split on single newlines
 * 3. Split any chunk > MAX_CHUNK_CHARS at sentence boundaries
 * 4. Filter out fragments < MIN_CHUNK_CHARS
 */
export function splitIntoChunks(text: string): string[] {
  // Step 1: Split on paragraph breaks
  let segments = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)

  // Step 2: If no paragraph breaks found, split on single newlines
  if (segments.length <= 1 && text.includes('\n')) {
    segments = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  }

  // Step 3: Split oversized segments at sentence boundaries
  const result: string[] = []
  for (const segment of segments) {
    if (segment.length <= MAX_CHUNK_CHARS) {
      result.push(segment)
    } else {
      result.push(...splitAtSentences(segment))
    }
  }

  // Step 4: Filter out short fragments
  return result.filter(c => c.length >= MIN_CHUNK_CHARS)
}

/**
 * Splits a long text block at sentence boundaries, targeting ~MAX_CHUNK_CHARS per chunk.
 */
function splitAtSentences(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text]
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if (current.length + sentence.length > MAX_CHUNK_CHARS && current.length > 0) {
      chunks.push(current.trim())
      current = ''
    }
    current += sentence
  }
  if (current.trim()) {
    chunks.push(current.trim())
  }
  return chunks
}

// ── Content Type Detection ─────────────────────────────────────────────────────

export interface ContentTypeResult {
  type: string
  label: string
  description: string
  emoji: string
}

/**
 * Auto-detects the type of content from extracted chunk text and filename.
 * Used to show the user a meaningful label when reviewing uploaded knowledge.
 */
export function detectContentType(chunks: string[], filename: string): ContentTypeResult {
  const sample = [filename, ...chunks.slice(0, 5)].join(' ').toLowerCase()

  if (/address.*rent|rent.*price|move.*in.*date|pet.*policy|sqft.*rent|bedroom.*bathroom.*rent|available.*unit|listing/i.test(sample)) {
    return { type: 'rental_listings', label: 'Rental Listings', description: 'Available properties with pricing and availability', emoji: '🏠' }
  }
  if (/work.*order|maintenance.*request|repair.*status|issue.*unit|priority.*open|reported.*by/i.test(sample)) {
    return { type: 'maintenance_log', label: 'Maintenance Log', description: 'Open work orders and service history', emoji: '🔧' }
  }
  if (/tenant.*name|lease.*start|lease.*end|balance.*owing|rent.*arrears|payment.*due|rent.*roll/i.test(sample)) {
    return { type: 'tenant_roster', label: 'Tenant Roster', description: 'Active tenants, lease terms, and balances', emoji: '👥' }
  }
  if (/question.*answer|q:.*a:|faq|q\s*\|.*a\s*\|/i.test(sample)) {
    return { type: 'faq', label: 'FAQ / Q&A', description: 'Frequently asked questions and answers', emoji: '💬' }
  }
  if (/price|rate|service.*fee|cost.*per|quote|estimate|package|plan/i.test(sample)) {
    return { type: 'service_menu', label: 'Services & Pricing', description: 'Service offerings and pricing details', emoji: '💰' }
  }
  if (/available|slot|appointment|schedule|booking|time.*window/i.test(sample)) {
    return { type: 'availability', label: 'Availability Schedule', description: 'Appointment windows and availability', emoji: '📅' }
  }
  if (/sku|part.*number|inventory|stock.*qty|item.*description|quantity.*on.*hand/i.test(sample)) {
    return { type: 'inventory', label: 'Inventory / Parts', description: 'Product and parts reference data', emoji: '📦' }
  }
  if (/procedure|policy|guideline|step.*\d|instruction|manual|how.*to/i.test(sample)) {
    return { type: 'manual', label: 'Policy & Procedures', description: 'Operational guidelines and procedures', emoji: '📋' }
  }
  return { type: 'general', label: 'General Knowledge', description: 'Custom knowledge for your agent', emoji: '📄' }
}

// ── Truncation ─────────────────────────────────────────────────────────────────

/**
 * Truncates extracted text to MAX_TEXT_LENGTH.
 * Returns { text, truncated, originalLength }
 */
export function truncateText(text: string): {
  text: string
  truncated: boolean
  originalLength: number
} {
  if (text.length <= MAX_TEXT_LENGTH) {
    return { text, truncated: false, originalLength: text.length }
  }
  return {
    text: text.slice(0, MAX_TEXT_LENGTH),
    truncated: true,
    originalLength: text.length,
  }
}
