/**
 * Fast Phase D drift check — for pre-push hook.
 *
 * Regenerates the 2 Golden Dataset prompt fixtures (voicemail-generic + auto-glass)
 * and compares char counts against the committed Phase D baselines in
 * tests/reference/post-phase-d-baseline/. Fails with exit 1 if either:
 *
 *   - Generator errors out (Phase D slot composition broken)
 *   - Char count drifted > 15% from the baseline
 *
 * NO OpenRouter/Anthropic API calls. Runs in <2 seconds. Safe for pre-push.
 *
 * The full LLM-as-judge test:prompts suite runs manually or in CI — not on
 * every push, because it costs money and is slow.
 */

import { buildPromptFromIntake } from '../../../src/lib/prompt-builder'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DRIFT_TOLERANCE_PCT = 15

const fixtures: Array<{ slug: string; intake: Record<string, unknown> }> = [
  {
    slug: 'voicemail-generic',
    intake: {
      niche: 'voicemail',
      business_name: 'Mountain View Dental',
      agent_name: 'Sam',
      owner_name: 'Dr. Patel',
      city: 'Calgary',
      call_handling_mode: 'message_only',
      agent_mode: 'lead_capture',
      callback_phone: '(403) 555-0188',
      hours_weekday: 'Mon-Fri 8am-5pm',
      hours_weekend: 'Closed Sat/Sun',
      voice_style_preset: 'casual_friendly',
      niche_messageRecipient: 'owner',
      niche_voicemailBehavior: 'message_only',
    },
  },
  {
    slug: 'auto-glass',
    intake: {
      niche: 'auto_glass',
      business_name: 'Windshield Hub',
      agent_name: 'Mark',
      owner_name: 'Sabbir',
      city: 'Calgary',
      call_handling_mode: 'triage',
      agent_mode: 'lead_capture',
      callback_phone: '(403) 555-0419',
      hours_weekday: 'Mon-Fri 8am-6pm',
      hours_weekend: 'Sat 9am-3pm, Sun by appointment',
      services_offered:
        'windshield repair, windshield replacement, ADAS calibration, side glass, back glass',
      voice_style_preset: 'casual_friendly',
      close_person: 'Sabbir',
      niche_custom_variables: { CLOSE_PERSON: 'Sabbir' },
    },
  },
]

const baselineDir = join(__dirname, '..', '..', 'reference', 'post-phase-d-baseline')
let fail = 0

console.log('Phase D drift check (no API calls, offline)')

for (const { slug, intake } of fixtures) {
  const baselinePath = join(baselineDir, `${slug}.txt`)
  if (!existsSync(baselinePath)) {
    console.log(`  ${slug}: no baseline at ${baselinePath} — run export-phase-d-baseline.ts first`)
    fail += 1
    continue
  }
  const baselineChars = readFileSync(baselinePath, 'utf-8').length
  try {
    const generated = buildPromptFromIntake(intake)
    const generatedChars = generated.length
    const driftPct = ((generatedChars - baselineChars) / baselineChars) * 100
    const within = Math.abs(driftPct) <= DRIFT_TOLERANCE_PCT
    const sign = driftPct >= 0 ? '+' : ''
    console.log(
      `  ${slug.padEnd(22)} baseline ${baselineChars} → now ${generatedChars} (${sign}${driftPct.toFixed(1)}%) ${within ? '✅' : `❌ > ±${DRIFT_TOLERANCE_PCT}%`}`,
    )
    if (!within) fail += 1
  } catch (err) {
    console.log(`  ${slug.padEnd(22)} GENERATOR ERROR: ${(err as Error).message.slice(0, 200)}`)
    fail += 1
  }
}

if (fail > 0) {
  console.log(`\n❌ ${fail} fixture(s) drifted or broke. Review Phase D baselines or update them deliberately.`)
  process.exit(1)
}
console.log('\n✅ All Phase D fixtures within tolerance.')
