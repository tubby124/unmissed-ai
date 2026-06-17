import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

type AnyRecord = Record<string, unknown>

interface YpLead {
  name: string
  phone: string
  city: string
  province: string
  detail_url: string
}

interface CampaignLead {
  business_name: string
  city: string
  province: string
  phone: string
  website_url: string
  email: string
  email_source_url: string
  google_place_url: string
  yp_detail_url: string
  rating: string
  review_count: string
  source_actor: string
  source_run_id: string
  scraped_at: string
  consent_basis: string
  no_solicit_detected: string
  status: string
  campaign_url: string
}

const ACTOR_ID = 'lukaskrivka~google-maps-with-contact-details'
const ACTOR_LABEL = 'google-maps-with-contact-details'
const DEFAULT_CAP = 20
const DEFAULT_REF = 'glass-email-1'
const APIFY_HOME = '/Users/owner/Downloads/Repos/Apify Scraping'
const YP_HTML = path.join(process.cwd(), 'public/leads/auto-glass-ab-sk.html')
const SEARCHES = [
  'auto glass Calgary AB',
  'windshield repair Calgary AB',
  'auto glass Edmonton AB',
  'windshield repair Edmonton AB',
  'auto glass Saskatoon SK',
  'windshield repair Saskatoon SK',
  'auto glass Regina SK',
  'windshield repair Regina SK',
]

const CHAIN_PATTERNS = [
  /\bspeedy\b/i,
  /\bdeco\b/i,
  /\bglassmasters?\b/i,
  /\bgo!?\s*glass\b/i,
  /\buniglass\b/i,
  /\bvanfax\b/i,
  /\bpgw\b/i,
  /\bnovus\b/i,
  /\bcrystal glass\b/i,
  /\bglass doctor\b/i,
  /\bduro\s?vitres?\b/i,
  /\bdocteur du pare-brise\b/i,
  /\bapple auto glass\b/i,
  /\bwindshield surgeons?\b/i,
]

function argValue(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (exact) return exact.slice(name.length + 3)
  const index = process.argv.indexOf(`--${name}`)
  if (index >= 0) return process.argv[index + 1]
  return undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {}
  const env: Record<string, string> = {}
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return env
}

function getApifyToken(): string {
  const localEnv = readEnvFile(path.join(process.cwd(), '.env.local'))
  const apifyEnv = readEnvFile(path.join(APIFY_HOME, '.env'))
  return process.env.APIFY_TOKEN || localEnv.APIFY_TOKEN || apifyEnv.APIFY_TOKEN || ''
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|ltd|limited|corp|corporation|co|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function stableLeadRef(name: string, city: string, phone: string): string {
  return crypto
    .createHash('sha1')
    .update(`${normalizeName(name)}|${city.toLowerCase()}|${normalizePhone(phone)}`)
    .digest('hex')
    .slice(0, 12)
}

function extractYpLeads(htmlPath: string): YpLead[] {
  const html = fs.readFileSync(htmlPath, 'utf8')
  const match = html.match(/const LEADS = (\[[\s\S]*?\]);/)
  if (!match) throw new Error(`Could not find LEADS array in ${htmlPath}`)
  return JSON.parse(match[1]) as YpLead[]
}

function flattenEmails(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
      const email = match[0].toLowerCase()
      if (!email.endsWith('.png') && !email.endsWith('.jpg')) out.add(email)
    }
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenEmails(item, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as AnyRecord)) flattenEmails(item, out)
  }
  return out
}

function pickString(item: AnyRecord, keys: string[]): string {
  for (const key of keys) {
    const value = item[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function pickNumber(item: AnyRecord, keys: string[]): string {
  for (const key of keys) {
    const value = item[key]
    if (typeof value === 'number') return String(value)
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return String(Number(value))
  }
  return ''
}

function inferCity(item: AnyRecord): string {
  const direct = pickString(item, ['city', 'municipality', 'locatedIn'])
  if (direct) return direct
  const search = pickString(item, ['searchString', 'searchQuery'])
  const matchedSearch = SEARCHES.find((term) => search.toLowerCase().includes(term.toLowerCase()))
  if (matchedSearch) return matchedSearch.split(' ').slice(-2, -1)[0]
  const address = pickString(item, ['address', 'street', 'fullAddress'])
  for (const city of ['Calgary', 'Edmonton', 'Saskatoon', 'Regina']) {
    if (address.toLowerCase().includes(city.toLowerCase())) return city
  }
  return ''
}

function inferProvince(item: AnyRecord, city: string): string {
  const direct = pickString(item, ['state', 'province', 'region'])
  if (/^(AB|Alberta)$/i.test(direct)) return 'AB'
  if (/^(SK|Saskatchewan)$/i.test(direct)) return 'SK'
  if (city === 'Saskatoon' || city === 'Regina') return 'SK'
  if (city === 'Calgary' || city === 'Edmonton') return 'AB'
  return ''
}

function likelyChain(name: string): boolean {
  return CHAIN_PATTERNS.some((pattern) => pattern.test(name))
}

function detectNoSolicit(item: AnyRecord): boolean {
  const text = JSON.stringify(item).toLowerCase()
  return /do not solicit|no solicitation|no soliciting|do not email|no marketing/.test(text)
}

function bestEmailSource(item: AnyRecord, website: string, googlePlaceUrl: string): string {
  const source = pickString(item, [
    'emailSourceUrl',
    'email_source_url',
    'contactPage',
    'contactUrl',
    'websiteUrl',
    'website',
  ])
  return source || website || googlePlaceUrl
}

function findYpMatch(item: AnyRecord, ypLeads: YpLead[]): YpLead | undefined {
  const name = pickString(item, ['title', 'name', 'businessName'])
  const phone = normalizePhone(pickString(item, ['phone', 'phoneUnformatted', 'phoneNumber']))
  const city = inferCity(item)
  if (phone) {
    const byPhone = ypLeads.find((lead) => normalizePhone(lead.phone) === phone)
    if (byPhone) return byPhone
  }
  const normalized = normalizeName(name)
  if (!normalized) return undefined
  return ypLeads.find((lead) => normalizeName(lead.name) === normalized && lead.city.toLowerCase() === city.toLowerCase())
}

function toCampaignLead(item: AnyRecord, ypLeads: YpLead[], runId: string, scrapedAt: string): CampaignLead {
  const businessName = pickString(item, ['title', 'name', 'businessName'])
  const phone = pickString(item, ['phone', 'phoneUnformatted', 'phoneNumber'])
  const website = pickString(item, ['website', 'websiteUrl', 'url'])
  const googlePlaceUrl = pickString(item, ['placeUrl', 'googlePlaceUrl', 'url'])
  const city = inferCity(item)
  const province = inferProvince(item, city)
  const email = Array.from(flattenEmails(item))[0] || ''
  const emailSourceUrl = email ? bestEmailSource(item, website, googlePlaceUrl) : ''
  const ypMatch = findYpMatch(item, ypLeads)
  const noSolicit = detectNoSolicit(item)
  const chain = likelyChain(businessName)
  const status = !email
    ? 'needs_email'
    : !emailSourceUrl
      ? 'needs_source_review'
      : noSolicit
        ? 'blocked_no_solicit'
        : chain
          ? 'needs_review_chain'
          : 'send_ready'
  const leadRef = stableLeadRef(businessName, city, phone)
  const campaignParams = new URLSearchParams({
    ref: DEFAULT_REF,
    lead: leadRef,
    shop: businessName,
    city,
  })

  return {
    business_name: businessName,
    city,
    province,
    phone,
    website_url: website,
    email,
    email_source_url: emailSourceUrl,
    google_place_url: googlePlaceUrl,
    yp_detail_url: ypMatch?.detail_url || '',
    rating: pickNumber(item, ['totalScore', 'rating', 'stars']),
    review_count: pickNumber(item, ['reviewsCount', 'reviewCount', 'reviews']),
    source_actor: ACTOR_LABEL,
    source_run_id: runId,
    scraped_at: scrapedAt,
    consent_basis: email ? 'public_business_email' : '',
    no_solicit_detected: noSolicit ? 'true' : 'false',
    status,
    campaign_url: `https://endvoicemail.ai/for-auto-glass?${campaignParams.toString()}`,
  }
}

function dedupeCampaignLeads(rows: CampaignLead[]): CampaignLead[] {
  const seen = new Set<string>()
  const deduped: CampaignLead[] = []
  for (const row of rows) {
    const key = [
      normalizePhone(row.phone) || '',
      domainOf(row.website_url) || '',
      normalizeName(row.business_name),
      row.city.toLowerCase(),
    ].filter(Boolean).join('|')
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(row)
  }
  return deduped
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function writeCsv(rows: CampaignLead[], filePath: string): void {
  const headers = [
    'business_name',
    'city',
    'province',
    'phone',
    'website_url',
    'email',
    'email_source_url',
    'google_place_url',
    'yp_detail_url',
    'rating',
    'review_count',
    'source_actor',
    'source_run_id',
    'scraped_at',
    'consent_basis',
    'no_solicit_detected',
    'status',
    'campaign_url',
  ] as const
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ]
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`)
}

async function apifyJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const separator = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${separator}token=${encodeURIComponent(token)}`, init)
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Apify request failed (${res.status}): ${text.slice(0, 500)}`)
  }
  return JSON.parse(text) as T
}

async function runActor(token: string, cap: number): Promise<{ runId: string; datasetId: string }> {
  const input = {
    searchStringsArray: SEARCHES,
    maxCrawledPlacesPerSearch: cap,
    language: 'en',
    countryCode: 'ca',
  }
  const response = await apifyJson<{ data: { id: string; defaultDatasetId: string } }>(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  )
  return { runId: response.data.id, datasetId: response.data.defaultDatasetId }
}

async function waitForRun(token: string, runId: string): Promise<void> {
  for (;;) {
    const response = await apifyJson<{ data: { status: string; statusMessage?: string } }>(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      token
    )
    const status = response.data.status
    console.log(`[apify] run ${runId} status=${status}`)
    if (status === 'SUCCEEDED') return
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify run ${runId} ended with ${status}: ${response.data.statusMessage || ''}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 15_000))
  }
}

async function downloadDataset(token: string, datasetId: string): Promise<AnyRecord[]> {
  const all: AnyRecord[] = []
  let offset = 0
  const limit = 1000
  for (;;) {
    const page = await apifyJson<AnyRecord[]>(
      `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&clean=true&limit=${limit}&offset=${offset}`,
      token
    )
    all.push(...page)
    if (page.length < limit) break
    offset += limit
  }
  return all
}

async function main() {
  const cap = Number(argValue('cap') || DEFAULT_CAP)
  const dryRun = hasFlag('dry-run')
  const datasetIdArg = argValue('dataset-id')
  const runIdArg = argValue('run-id')
  const outputDir = argValue('output-dir') || path.join(APIFY_HOME, 'leads')
  const runsDir = path.join(APIFY_HOME, 'runs')
  const scrapedAt = new Date().toISOString()
  const ypLeads = extractYpLeads(YP_HTML)

  console.log(`[auto-glass] YP seed leads loaded: ${ypLeads.length}`)
  console.log(`[auto-glass] Searches: ${SEARCHES.length}; cap per search: ${cap}; raw max before dedupe: ${SEARCHES.length * cap}`)

  if (dryRun) {
    console.log('[auto-glass] Dry run only. No Apify run started.')
    console.log(JSON.stringify({ actor: ACTOR_ID, searchStringsArray: SEARCHES, maxCrawledPlacesPerSearch: cap, countryCode: 'ca' }, null, 2))
    return
  }

  const token = getApifyToken()
  if (!token) {
    throw new Error('APIFY_TOKEN not found. Set APIFY_TOKEN or add it to /Users/owner/Downloads/Repos/Apify Scraping/.env.')
  }

  fs.mkdirSync(outputDir, { recursive: true })
  fs.mkdirSync(runsDir, { recursive: true })

  let runId = runIdArg || ''
  let datasetId = datasetIdArg || ''
  if (!datasetId) {
    const run = await runActor(token, cap)
    runId = run.runId
    datasetId = run.datasetId
    console.log(`[apify] Run started: ${runId}`)
    await waitForRun(token, runId)
  } else {
    console.log(`[apify] Reusing dataset: ${datasetId}`)
  }

  const raw = await downloadDataset(token, datasetId)
  const rawFile = path.join(runsDir, `${today()}_auto-glass-google-maps-email-pilot_raw.json`)
  fs.writeFileSync(rawFile, JSON.stringify(raw, null, 2))

  const normalized = raw.map((item) => toCampaignLead(item, ypLeads, runId, scrapedAt))
  const deduped = dedupeCampaignLeads(normalized)
  const csvFile = path.join(outputDir, `${today()}_auto-glass-email-pilot.csv`)
  const summaryFile = path.join(outputDir, `${today()}_auto-glass-email-pilot-summary.json`)
  writeCsv(deduped, csvFile)

  const summary = {
    actor: ACTOR_ID,
    run_id: runId,
    dataset_id: datasetId,
    raw_records: raw.length,
    deduped_records: deduped.length,
    send_ready: deduped.filter((row) => row.status === 'send_ready').length,
    with_email: deduped.filter((row) => row.email).length,
    needs_email: deduped.filter((row) => row.status === 'needs_email').length,
    needs_review_chain: deduped.filter((row) => row.status === 'needs_review_chain').length,
    output_csv: csvFile,
    raw_json: rawFile,
  }
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
