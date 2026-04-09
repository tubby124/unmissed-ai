/**
 * Export post-Phase-D immutable reference baselines.
 *
 * Writes one .txt file per standard niche to tests/reference/post-phase-d-baseline/.
 * These are the "known good" prompt outputs as of Phase D slot compression
 * (commit b048a69). Used as a regression anchor for Phase D.5 offline harness.
 *
 * Unlike src/lib/__tests__/snapshots/*.txt (which drift as tests evolve),
 * these files are NEVER regenerated once committed. If a future edit changes
 * the Phase D contract, that's a deliberate decision that should be tracked.
 *
 * Usage: npx tsx tests/promptfoo/scripts/export-phase-d-baseline.ts
 */

import { buildPromptFromIntake } from '../../../src/lib/prompt-builder'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// Standard intake per niche — must match the generator scripts for auto_glass
// and voicemail so the baseline aligns with what the Golden Dataset runs against.

const BASELINE_INTAKES: Array<{ slug: string; intake: Record<string, unknown> }> = [
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
  {
    slug: 'hvac',
    intake: {
      niche: 'hvac',
      business_name: 'Prairie HVAC',
      agent_name: 'Jess',
      owner_name: 'Ryan',
      city: 'Saskatoon',
      call_handling_mode: 'triage',
      agent_mode: 'lead_capture',
      callback_phone: '(306) 555-0199',
      hours_weekday: 'Mon-Fri 8am-5pm',
      hours_weekend: 'Emergency calls only',
      services_offered: 'furnace repair, AC install, ductwork, tune-ups',
      voice_style_preset: 'casual_friendly',
      close_person: 'Ryan',
    },
  },
  {
    slug: 'plumbing',
    intake: {
      niche: 'plumbing',
      business_name: 'Maple Leaf Plumbing',
      agent_name: 'Alex',
      owner_name: 'Dan',
      city: 'Calgary',
      call_handling_mode: 'triage',
      agent_mode: 'lead_capture',
      callback_phone: '(403) 555-0222',
      hours_weekday: 'Mon-Sat 7am-7pm',
      hours_weekend: '24/7 emergency',
      services_offered: 'leak repair, drain cleaning, water heater install, emergency plumbing',
      voice_style_preset: 'casual_friendly',
      close_person: 'Dan',
    },
  },
  {
    slug: 'real-estate',
    intake: {
      niche: 'outbound_isa_realtor',
      business_name: 'Sharif Commercial Calgary',
      agent_name: 'Ava',
      owner_name: 'Hasan',
      city: 'Calgary',
      call_handling_mode: 'triage',
      agent_mode: 'isa_qualifier',
      callback_phone: '(403) 555-0333',
      hours_weekday: 'Mon-Fri 9am-6pm',
      hours_weekend: 'By appointment',
      services_offered:
        'commercial real estate, multi-family, care homes, inter-provincial relocation',
      voice_style_preset: 'polished_professional',
      close_person: 'Hasan',
    },
  },
  {
    slug: 'property-management',
    intake: {
      niche: 'property_management',
      business_name: 'Urban Vibe Properties',
      agent_name: 'Riley',
      owner_name: 'Ray',
      city: 'Calgary',
      call_handling_mode: 'triage',
      agent_mode: 'lead_capture',
      callback_phone: '(403) 555-0411',
      hours_weekday: 'Mon-Fri 9am-5pm',
      hours_weekend: 'Emergency only',
      voice_style_preset: 'casual_friendly',
      close_person: 'Ray',
      niche_petPolicy: 'cats_only',
      niche_parkingPolicy: 'street_only',
      niche_packagePolicy: 'lobby_only',
    },
  },
]

const outDir = join(__dirname, '..', '..', 'reference', 'post-phase-d-baseline')
mkdirSync(outDir, { recursive: true })

const manifest: Array<{ slug: string; chars: number; valid: boolean }> = []

for (const { slug, intake } of BASELINE_INTAKES) {
  const prompt = buildPromptFromIntake(intake)
  const outPath = join(outDir, `${slug}.txt`)
  writeFileSync(outPath, prompt, 'utf-8')
  manifest.push({ slug, chars: prompt.length, valid: true })
  console.log(`  ${slug.padEnd(22)} ${prompt.length.toString().padStart(6)} chars → ${outPath}`)
}

// Manifest as markdown for easy diffing
const manifestPath = join(outDir, 'MANIFEST.md')
const manifestContent = `# Post-Phase-D Baseline Reference

**Created:** ${new Date().toISOString().slice(0, 10)}
**Phase D commit:** b048a69 — feat(prompt-slots): Phase D slot compression — 21,591 → 11,974 chars (−44.5%)

| Niche | Chars | Target (Hasan) | Notes |
|-------|------:|---------------:|-------|
${manifest
  .map((m) => {
    const status =
      m.chars <= 8500
        ? '✅ ideal'
        : m.chars <= 12000
          ? '✅ under ceiling'
          : m.chars <= 13500
            ? '⚠️  over ceiling'
            : '❌ bloated'
    return `| ${m.slug} | ${m.chars} | 8K ideal / 12K ceiling | ${status} |`
  })
  .join('\n')}

These files are **IMMUTABLE** — do not regenerate. They are the ground-truth
reference for post-Phase-D regression comparison. If a future edit changes
the Phase D contract, that's a deliberate decision that should be reviewed
case-by-case before updating these files.
`

writeFileSync(manifestPath, manifestContent, 'utf-8')
console.log(`\n  MANIFEST.md written (${manifest.length} niches)`)
