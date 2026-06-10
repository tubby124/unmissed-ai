// P3 — Fleet snapshot + Bug 3 presence audit.
// For each non-Brian active client on the slot pipeline:
//   1. Pull live system_prompt
//   2. Save to tests/promptfoo/snapshots/<slug>-current-2026-06-02.txt
//   3. Report char count + Bug 3 line presence + hand_tuned flag
//
// Bug 3 line = the buggy "Reference their last topic briefly from the prior call summary"
// instruction inside buildReturningCaller(). If present in deployed prompt, this client is
// affected. If absent, they have an older/different returning-caller wording (still worth
// inspecting).
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

const SLUGS = ['hasan-sharif', 'exp-realty', 'urban-vibe', 'velly-remodeling']

const BUG3_LINE_LEGACY = 'Reference their last topic briefly'           // pre-fix wording
const BUG3_LINE_FIXED = 'Never presume the topic from the prior call summary' // post-fix wording

async function main(): Promise<void> {
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const outDir = 'tests/promptfoo/snapshots'
  fs.mkdirSync(outDir, { recursive: true })

  console.log('slug             | niche             | chars  | hand_tuned | Bug3-legacy | Bug3-fixed | returning_caller_section')
  console.log('-'.repeat(120))

  for (const slug of SLUGS) {
    const { data: client, error } = await svc
      .from('clients')
      .select('id, slug, niche, system_prompt, hand_tuned, ultravox_agent_id')
      .eq('slug', slug)
      .single()
    if (error || !client) {
      console.log(`${slug.padEnd(16)} | LOOKUP FAILED: ${error?.message ?? 'not found'}`)
      continue
    }

    const prompt = client.system_prompt as string ?? ''
    const hasLegacy = prompt.includes(BUG3_LINE_LEGACY)
    const hasFixed = prompt.includes(BUG3_LINE_FIXED)

    // Best-effort: find the RETURNING CALLER block boundaries to confirm there IS one
    const rcMatch = prompt.match(/RETURNING CALLER[\s\S]{0,400}/i)
    const rcSnippet = rcMatch ? rcMatch[0].slice(0, 80).replace(/\n/g, ' ') + '…' : '(no RETURNING CALLER section found)'

    const outFile = path.join(outDir, `${slug}-current-2026-06-02.txt`)
    fs.writeFileSync(outFile, prompt)

    console.log(
      `${slug.padEnd(16)} | ${(client.niche ?? '').padEnd(17)} | ${String(prompt.length).padStart(6)} | ${String(client.hand_tuned).padEnd(10)} | ${hasLegacy ? 'YES' : ' no'}         | ${hasFixed ? 'YES' : ' no'}        | ${rcSnippet}`
    )
  }

  console.log('')
  console.log('Snapshots written to', outDir)
  console.log('')
  console.log('Interpretation:')
  console.log('  Bug3-legacy=YES → client has the buggy instruction in deployed prompt; needs regenerateSlot to fix.')
  console.log('  Bug3-legacy=no AND Bug3-fixed=no → returning-caller wording diverged (older prompt or hand-tuned override).')
  console.log('  Bug3-fixed=YES → client already inherited the fix (shouldn\'t happen yet — no commits/regen runs).')
  console.log('  hand_tuned=true → standing no-redeploy rule applies; regenerateSlot needs explicit go per client.')
}

main().catch(e => { console.error(e); process.exit(1) })
