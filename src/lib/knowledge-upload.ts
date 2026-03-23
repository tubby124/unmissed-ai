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
export const ALLOWED_EXTENSIONS = new Set(['pdf', 'txt', 'docx', 'csv'])

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

  if (ext === 'txt' || mimeType === 'text/plain') {
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
 * Parses CSV text: skip header row, join cell values with " | " per row.
 * Handles simple quoted fields (strips quotes).
 */
export function parseCSV(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length <= 1) return text // just header or single line
  const dataLines = lines.slice(1).map(line => {
    return line.replace(/"/g, '').split(',').map(c => c.trim()).filter(c => c).join(' | ')
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
