/**
 * knowledge-upload.test.ts — Tests for knowledge document processing pipeline
 *
 * Run: npx tsx --test src/lib/__tests__/knowledge-upload.test.ts
 *
 * Tests text extraction, CSV parsing, chunking, and truncation
 * with realistic data to verify the pipeline actually works.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCSV,
  splitIntoChunks,
  truncateText,
  extractText,
  MAX_TEXT_LENGTH,
  MIN_CHUNK_CHARS,
  MAX_CHUNK_CHARS,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
} from '../knowledge-upload'

// ── Constants ──────────────────────────────────────────────────────────────────

describe('constants', () => {
  test('MAX_TEXT_LENGTH is 50K (not 4K)', () => {
    assert.equal(MAX_TEXT_LENGTH, 50_000)
  })

  test('MAX_FILE_SIZE is 5MB', () => {
    assert.equal(MAX_FILE_SIZE, 5 * 1024 * 1024)
  })

  test('allowed extensions include csv', () => {
    assert.ok(ALLOWED_EXTENSIONS.has('csv'))
    assert.ok(ALLOWED_EXTENSIONS.has('pdf'))
    assert.ok(ALLOWED_EXTENSIONS.has('txt'))
    assert.ok(ALLOWED_EXTENSIONS.has('docx'))
    assert.ok(!ALLOWED_EXTENSIONS.has('exe'))
  })
})

// ── CSV Parsing ────────────────────────────────────────────────────────────────

describe('parseCSV', () => {
  test('skips header row and joins cells with pipe', () => {
    const csv = 'Name,Phone,Service\nJohn Doe,555-1234,Oil Change\nJane Smith,555-5678,Brake Repair'
    const result = parseCSV(csv)
    assert.equal(result, 'John Doe | 555-1234 | Oil Change\nJane Smith | 555-5678 | Brake Repair')
  })

  test('handles quoted fields', () => {
    const csv = 'Question,Answer\n"What are your hours?","Mon-Fri 9am-5pm"\n"Do you deliver?","Yes, within 50km"'
    const result = parseCSV(csv)
    assert.ok(result.includes('What are your hours?'))
    assert.ok(result.includes('Mon-Fri 9am-5pm'))
    assert.ok(!result.includes('"'))
  })

  test('returns raw text for single-line CSV (header only)', () => {
    const csv = 'Name,Phone,Service'
    const result = parseCSV(csv)
    assert.equal(result, csv)
  })

  test('handles empty cells', () => {
    const csv = 'A,B,C\nfoo,,bar\n,baz,'
    const result = parseCSV(csv)
    // Empty cells are filtered out
    assert.equal(result, 'foo | bar\nbaz')
  })

  test('handles real-world FAQ CSV', () => {
    const csv = `Question,Answer,Category
"Do you offer free estimates?","Yes all estimates are completely free.",General
"What areas do you serve?","We serve the entire GTA.",Coverage
"How quickly can you come out?","Same-day service available for most jobs.",Timing
"Do you offer financing?","We partner with FinanceIt for monthly payments.",Payment`
    const result = parseCSV(csv)
    const lines = result.split('\n')
    assert.equal(lines.length, 4)
    assert.ok(lines[0].includes('Do you offer free estimates?'))
    assert.ok(lines[0].includes('Yes all estimates are completely free.'))
    assert.ok(lines[0].includes('General'))
    assert.ok(lines[2].includes('Same-day service'))
  })

  test('commas inside quoted values split into separate cells (known limitation)', () => {
    // Our simple CSV parser doesn't handle RFC 4180 quoted commas.
    // This is acceptable for knowledge docs — content is still captured, just split differently.
    const csv = 'Q,A\n"What hours?","Mon-Fri, 9-5"'
    const result = parseCSV(csv)
    // "Mon-Fri, 9-5" becomes "Mon-Fri | 9-5" — content preserved, just pipe-separated
    assert.ok(result.includes('Mon-Fri'))
    assert.ok(result.includes('9-5'))
  })
})

// ── Text Extraction ────────────────────────────────────────────────────────────

describe('extractText', () => {
  test('extracts plain text from .txt buffer', async () => {
    const content = 'Hello, this is a test document.\nIt has multiple lines.\nLine three here.'
    const buffer = Buffer.from(content, 'utf-8')
    const result = await extractText(buffer, 'test.txt', 'text/plain')
    assert.equal(result, content)
  })

  test('extracts CSV from .csv buffer', async () => {
    const csv = 'Header1,Header2\nValue1,Value2\nValue3,Value4'
    const buffer = Buffer.from(csv, 'utf-8')
    const result = await extractText(buffer, 'data.csv', 'text/csv')
    assert.equal(result, 'Value1 | Value2\nValue3 | Value4')
  })

  test('detects CSV by mime type even without .csv extension', async () => {
    const csv = 'Q,A\nQuestion 1,Answer 1'
    const buffer = Buffer.from(csv, 'utf-8')
    const result = await extractText(buffer, 'data.xls', 'application/vnd.ms-excel')
    assert.equal(result, 'Question 1 | Answer 1')
  })

  test('throws on unsupported file type', async () => {
    const buffer = Buffer.from('binary junk', 'utf-8')
    await assert.rejects(
      () => extractText(buffer, 'virus.exe', 'application/octet-stream'),
      { message: 'Unsupported file type: exe' },
    )
  })

  test('handles large plain text without truncation (extraction layer)', async () => {
    const content = 'A'.repeat(60_000)
    const buffer = Buffer.from(content, 'utf-8')
    const result = await extractText(buffer, 'big.txt', 'text/plain')
    assert.equal(result.length, 60_000, 'extractText should NOT truncate — truncation happens separately')
  })
})

// ── Chunking ───────────────────────────────────────────────────────────────────

describe('splitIntoChunks', () => {
  test('splits on paragraph breaks (double newlines)', () => {
    const text = 'First paragraph with enough text to pass minimum.\n\nSecond paragraph also long enough to pass.'
    const chunks = splitIntoChunks(text)
    assert.equal(chunks.length, 2)
    assert.ok(chunks[0].startsWith('First paragraph'))
    assert.ok(chunks[1].startsWith('Second paragraph'))
  })

  test('falls back to single newlines when no paragraph breaks', () => {
    const lines = Array.from({ length: 5 }, (_, i) => `Line ${i + 1} has enough content to meet the minimum.`)
    const text = lines.join('\n')
    const chunks = splitIntoChunks(text)
    assert.equal(chunks.length, 5)
  })

  test('filters out fragments shorter than MIN_CHUNK_CHARS', () => {
    const text = 'Short\n\nThis is a sufficiently long paragraph to pass the minimum character threshold for chunking.'
    const chunks = splitIntoChunks(text)
    assert.equal(chunks.length, 1) // "Short" is < MIN_CHUNK_CHARS
    assert.ok(chunks[0].includes('sufficiently long'))
  })

  test('splits oversized paragraphs at sentence boundaries', () => {
    // Create a paragraph with many sentences that exceeds MAX_CHUNK_CHARS
    const sentences = Array.from({ length: 30 }, (_, i) =>
      `Sentence number ${i + 1} provides some useful information about the business. `
    )
    const bigParagraph = sentences.join('')
    assert.ok(bigParagraph.length > MAX_CHUNK_CHARS, 'Test setup: paragraph should exceed max')

    const chunks = splitIntoChunks(bigParagraph)
    assert.ok(chunks.length > 1, 'Should split into multiple chunks')
    for (const chunk of chunks) {
      assert.ok(chunk.length <= MAX_CHUNK_CHARS + 100, `Chunk should be roughly within max: ${chunk.length}`)
    }
  })

  test('handles realistic multi-section document', () => {
    const doc = `About Our Company

We are a leading provider of auto glass repair and replacement services in the Greater Toronto Area. Our team has over 20 years of combined experience in the industry.

Services We Offer

Windshield Replacement: We stock OEM and aftermarket windshields for all major vehicle makes and models. Our certified technicians can complete most replacements in under 90 minutes.

Chip Repair: Small chips and cracks up to 6 inches can often be repaired without full replacement. Our resin injection process restores structural integrity and clarity.

Mobile Service: We come to your location — home, office, or roadside. Our fully equipped mobile units carry everything needed for on-site repairs and replacements.

Coverage and Insurance

We work directly with all major insurance providers including Intact, Aviva, TD Insurance, and The Co-operators. In most cases, windshield replacement is fully covered with zero deductible.

Contact Us

Call us at 416-555-0123 or visit our website for a free quote. Same-day service available for most vehicles.`

    const chunks = splitIntoChunks(doc)
    assert.ok(chunks.length >= 4, `Expected 4+ chunks for a multi-section doc, got ${chunks.length}`)
    // Every chunk should have meaningful content
    for (const chunk of chunks) {
      assert.ok(chunk.length >= MIN_CHUNK_CHARS, `Chunk too short: "${chunk.slice(0, 30)}..."`)
    }
  })

  test('handles CSV-style output (single newlines)', () => {
    const csvOutput = Array.from({ length: 10 }, (_, i) =>
      `Product ${i + 1} | Category ${i + 1} | $${(i + 1) * 29.99}`
    ).join('\n')
    const chunks = splitIntoChunks(csvOutput)
    assert.ok(chunks.length > 0, 'Should produce chunks from CSV output')
  })

  test('returns empty array for empty/whitespace input', () => {
    assert.deepEqual(splitIntoChunks(''), [])
    assert.deepEqual(splitIntoChunks('   \n\n   '), [])
  })

  test('returns empty array when all content is below MIN_CHUNK_CHARS', () => {
    assert.deepEqual(splitIntoChunks('Too short'), [])
    assert.deepEqual(splitIntoChunks('A\n\nB\n\nC'), [])
  })
})

// ── Truncation ─────────────────────────────────────────────────────────────────

describe('truncateText', () => {
  test('does not truncate text under limit', () => {
    const text = 'Hello world'
    const result = truncateText(text)
    assert.equal(result.text, text)
    assert.equal(result.truncated, false)
    assert.equal(result.originalLength, text.length)
  })

  test('truncates text over 50K chars', () => {
    const text = 'X'.repeat(60_000)
    const result = truncateText(text)
    assert.equal(result.text.length, MAX_TEXT_LENGTH)
    assert.equal(result.truncated, true)
    assert.equal(result.originalLength, 60_000)
  })

  test('exactly at limit is not truncated', () => {
    const text = 'Y'.repeat(MAX_TEXT_LENGTH)
    const result = truncateText(text)
    assert.equal(result.truncated, false)
  })

  test('old 4000 char limit would have lost this content', () => {
    // Prove that a realistic 10K doc is NOT truncated under new limit
    const doc = 'Lorem ipsum dolor sit amet. '.repeat(400) // ~11.2K chars
    const result = truncateText(doc)
    assert.equal(result.truncated, false, '10K doc should NOT be truncated with 50K limit')
    assert.equal(result.text.length, doc.length)
  })
})

// ── End-to-End Pipeline ────────────────────────────────────────────────────────

describe('end-to-end: extract → truncate → chunk', () => {
  test('TXT file → chunks', async () => {
    const content = `About Our Business

We are a family-owned plumbing company serving Saskatoon and surrounding areas since 1985. We specialize in residential and commercial plumbing services.

Our Services

We offer drain cleaning, pipe repair, water heater installation, bathroom renovations, and emergency plumbing services. All work is guaranteed for 2 years.

Pricing

Service calls start at $89. Free estimates for larger jobs. Senior discount of 10% available. We accept cash, credit cards, and e-transfer.`

    const buffer = Buffer.from(content, 'utf-8')
    const raw = await extractText(buffer, 'about-us.txt', 'text/plain')
    const { text } = truncateText(raw)
    const chunks = splitIntoChunks(text)

    assert.ok(chunks.length >= 3, `Expected 3+ chunks, got ${chunks.length}`)
    assert.ok(chunks.some(c => c.includes('family-owned')))
    assert.ok(chunks.some(c => c.includes('drain cleaning')))
    assert.ok(chunks.some(c => c.includes('$89')))
  })

  test('CSV file → chunks', async () => {
    const csv = `Question,Answer
"What are your hours?","Monday to Friday 8am-6pm, Saturday 9am-2pm"
"Do you offer emergency service?","Yes, 24/7 emergency service available at 306-555-0199"
"What areas do you cover?","Saskatoon, Warman, Martensville, Osler, and Dalmeny"
"Do you give free quotes?","Yes, all estimates are free with no obligation"
"Are you licensed?","Yes, fully licensed and insured. Saskatchewan license #PL-12345"`

    const buffer = Buffer.from(csv, 'utf-8')
    const raw = await extractText(buffer, 'faq.csv', 'text/csv')
    const { text } = truncateText(raw)
    const chunks = splitIntoChunks(text)

    assert.ok(chunks.length >= 1, 'Should produce chunks from FAQ CSV')
    // Verify the pipe-separated format
    assert.ok(raw.includes('What are your hours?'))
    assert.ok(raw.includes('Monday to Friday'))
    assert.ok(!raw.includes('"'), 'Quotes should be stripped')
  })

  test('large document chunks correctly (proves 4K bug is fixed)', async () => {
    // Simulate a real PDF-extracted text (~15K chars)
    const sections = Array.from({ length: 15 }, (_, i) =>
      `Section ${i + 1}: ${'This is detailed business information that a client would include in their knowledge document. '.repeat(10)}`
    )
    const content = sections.join('\n\n')
    assert.ok(content.length > 10_000, `Setup: doc should be >10K chars, got ${content.length}`)

    const buffer = Buffer.from(content, 'utf-8')
    const raw = await extractText(buffer, 'big-doc.txt', 'text/plain')
    const { text, truncated } = truncateText(raw)
    const chunks = splitIntoChunks(text)

    assert.equal(truncated, false, '15K doc should NOT be truncated')
    assert.equal(text.length, content.length, 'Full content should be preserved')
    assert.ok(chunks.length >= 10, `15 sections should produce 10+ chunks, got ${chunks.length}`)
    // Verify last section is included (would have been cut at 4K)
    assert.ok(
      chunks.some(c => c.includes('Section 15')),
      'Section 15 should be in chunks (was lost with old 4K limit)',
    )
  })
})
