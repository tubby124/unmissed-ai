/**
 * Send Aman the Rogers-specific voicemail removal + conditional CF setup steps.
 * Sequel to send-aman-welcome.ts after Hasan confirmed Aman is on Rogers.
 *
 * Carrier SOP source of truth: ~/.claude/projects/-Users-owner/memory/unmissed-carrier-voicemail-removal.md
 * Validated 2026-04-29 (Rogers 403-808-9705) + 2026-05-05 (Telus).
 *
 * Run:
 *   npx tsx scripts/send-aman-rogers-codes.ts             # dryrun
 *   npx tsx scripts/send-aman-rogers-codes.ts --send      # actually send
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { sendBrandedEmail } from '../src/lib/email/send'

const SEND = process.argv.includes('--send')

const TO = 'amanwalia.realtor@gmail.com'
const SUBJECT = "Rogers steps — voicemail removal + forwarding to Riley"
const CLIENT_ID = 'd0b9ccba-edc2-4f49-bf99-c3518ab30dda'
const REPLY_TO = 'hasan.sharif.realtor@gmail.com'

const AI_DID_DISPLAY = '+1 (587) 872-8187'
const AI_DID_E164 = '15878728187'

const HTML = `
<style>
  .ev-h1 { font-size: 22px; font-weight: 700; margin: 0 0 16px; letter-spacing: -0.01em; color: #0F172A; }
  .ev-lead { font-size: 15.5px; line-height: 1.65; color: #1F2937; margin: 0 0 20px; }
  .ev-section { margin: 24px 0 0; padding: 20px 22px; background: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 10px; }
  .ev-step-badge { display: inline-block; background: #0F172A; color: white; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; margin-bottom: 10px; }
  .ev-step-title { font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 8px; }
  .ev-step-body { font-size: 14.5px; line-height: 1.6; color: #374151; margin: 0; }
  .ev-step-body p { margin: 8px 0; }
  .ev-step-body ul { margin: 8px 0 0; padding-left: 20px; }
  .ev-step-body li { margin: 4px 0; }
  .ev-script-box { background: white; border: 1px solid #CBD5E1; border-radius: 8px; padding: 14px 16px; margin: 12px 0; font-size: 14.5px; line-height: 1.6; color: #0F172A; font-style: italic; }
  .ev-script-box strong { font-style: normal; color: #0F172A; }
  .ev-code-block { background: #0F172A; color: #E5E7EB; padding: 16px 18px; border-radius: 8px; font-family: SF Mono, Menlo, Consolas, monospace; font-size: 15px; line-height: 1.8; margin: 12px 0; }
  .ev-code-block .ev-code-line { display: block; }
  .ev-code-block .ev-code-comment { color: #94A3B8; font-size: 13px; margin-left: 12px; }
  .ev-warn { background: #FEF2F2; border-left: 3px solid #DC2626; padding: 12px 16px; margin: 12px 0; font-size: 14px; color: #7F1D1D; border-radius: 4px; }
  .ev-warn strong { color: #991B1B; }
  .ev-tip { background: #EFF6FF; border-left: 3px solid #2563EB; padding: 12px 16px; margin: 12px 0; font-size: 14px; color: #1E3A8A; border-radius: 4px; }
  .ev-divider { height: 1px; background: #E5E7EB; margin: 28px 0; border: none; }
  .ev-sig { margin-top: 28px; font-size: 15px; color: #1F2937; }
  .ev-phone-pill { display: inline-block; background: #0F172A; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-family: SF Mono, Menlo, Consolas, monospace; font-size: 14px; }
</style>

<p class="ev-h1">Rogers steps — voicemail removal + forwarding to Riley.</p>

<p class="ev-lead">
Since you're on Rogers, here's the exact 4-step playbook to get your missed personal calls landing on Riley. This usually takes 10 minutes — about 5 of those is the Rogers hold time. Do them in order. Don't skip step 1, it breaks everything else.
</p>

<div class="ev-section">
  <span class="ev-step-badge">Step 1</span>
  <p class="ev-step-title">Call Rogers and FULLY REMOVE voicemail from your line.</p>
  <div class="ev-step-body">
    <p>Call Rogers from any phone:</p>
    <p style="margin: 10px 0;"><span class="ev-phone-pill">1-800-764-3771</span> &nbsp;(or dial <strong>*611</strong> from your Rogers phone)</p>
    <p>When you get an agent, read them this exact ask — don't paraphrase, the wording matters:</p>
    <div class="ev-script-box">
      "Hi — please <strong>fully remove</strong> voicemail from my line. Not reset, not pause — I need the voicemail box <strong>deleted from my line profile</strong>. I'm using a third-party answering service and the carrier voicemail is blocking my conditional call forwarding. If I have Visual Voicemail, please remove that as well."
    </div>
    <p>Wait for the agent to say "<strong>voicemail has been removed</strong>" before hanging up. If you have an iPhone, also confirm: "and Visual Voicemail service is removed from the line too."</p>
    <div class="ev-warn">
      <strong>Critical — don't accept "reset" or "deactivated".</strong> Reset clears messages, not the box. The carrier voicemail and conditional call forwarding share the same slot on the network — voicemail wins until it's fully removed. If Rogers tries to push back, ask for tier 2 or back-office mobility provisioning. They can do it.
    </div>
  </div>
</div>

<div class="ev-section">
  <span class="ev-step-badge">Step 2</span>
  <p class="ev-step-title">Confirm voicemail is gone — test it once.</p>
  <div class="ev-step-body">
    <p>Have someone call your cell and let it ring out without picking up. Two possible outcomes:</p>
    <ul>
      <li>✅ <strong>Phone rings and rings, then disconnects (no greeting)</strong> — voicemail is removed. Move to step 3.</li>
      <li>❌ <strong>You still hear "leave a message after the beep" or a Rogers greeting</strong> — voicemail is still active. Call Rogers back, escalate to tier 2, repeat step 1.</li>
    </ul>
  </div>
</div>

<div class="ev-section">
  <span class="ev-step-badge">Step 3</span>
  <p class="ev-step-title">Forward your missed calls to Riley.</p>
  <div class="ev-step-body">
    <p>Once voicemail is fully removed, dial these three codes from your Rogers phone — one at a time. Press call after each. Each one should say "<strong>Setting Activation Succeeded</strong>" or beep twice.</p>
    <div class="ev-code-block">
      <span class="ev-code-line">*61*${AI_DID_E164}#<span class="ev-code-comment">forwards when you don't pick up</span></span>
      <span class="ev-code-line">*67*${AI_DID_E164}#<span class="ev-code-comment">forwards when your line is busy</span></span>
      <span class="ev-code-line">*62*${AI_DID_E164}#<span class="ev-code-comment">forwards when your phone is off / no signal</span></span>
    </div>
    <div class="ev-tip">
      That's <strong>${AI_DID_DISPLAY}</strong> with the leading +1 baked in (no plus sign, just "1"). All three codes use the same number.
    </div>
  </div>
</div>

<div class="ev-section">
  <span class="ev-step-badge">Step 4</span>
  <p class="ev-step-title">Real-world test.</p>
  <div class="ev-step-body">
    <p>Now actually test it end-to-end:</p>
    <ul>
      <li>Have a friend (or your other phone) call your <strong>personal cell number</strong></li>
      <li>Don't pick up — let it ring out</li>
      <li>After 4–5 rings the call should forward → Riley picks up and introduces herself</li>
    </ul>
    <p style="margin-top: 12px;">If Riley answers — you're fully live. Forwarding is working. Reply to this email and let me know it's done so I can flip your alerts to your combo from yesterday's email.</p>
    <p style="margin-top: 8px;">If the call goes nowhere or to a "this number can't be reached" message — that's a slot collision (voicemail still hiding somewhere). Reply and tell me what happened, I'll diagnose.</p>
  </div>
</div>

<hr class="ev-divider" />

<p class="ev-step-title" style="margin-top: 0;">How to undo forwarding (if you ever need to).</p>
<p class="ev-step-body" style="color: #374151;">
If you want your personal cell to stop forwarding to Riley (you're traveling, switching numbers, etc.), dial these three to cancel:
</p>
<div class="ev-code-block" style="margin-top: 14px;">
  <span class="ev-code-line">##61#<span class="ev-code-comment">cancel no-answer forwarding</span></span>
  <span class="ev-code-line">##67#<span class="ev-code-comment">cancel busy forwarding</span></span>
  <span class="ev-code-line">##62#<span class="ev-code-comment">cancel unreachable forwarding</span></span>
</div>
<p class="ev-step-body" style="margin-top: 14px; color: #374151;">
Riley's own line (${AI_DID_DISPLAY}) keeps working independently — only your personal cell stops forwarding.
</p>

<p class="ev-sig">Hasan</p>
`.trim()

async function main() {
  if (!SEND) {
    console.log('=== DRYRUN ===')
    console.log(`to: ${TO}`)
    console.log(`subject: ${SUBJECT}`)
    console.log(`html length: ${HTML.length} chars`)
    console.log('')
    console.log('Run with --send to actually send via Resend.')
    return
  }

  console.log('=== SENDING via Resend (sendBrandedEmail) ===')
  console.log(`to: ${TO}`)
  console.log(`subject: ${SUBJECT}`)

  const result = await sendBrandedEmail({
    to: TO,
    subject: SUBJECT,
    html: HTML,
    purpose: 'support',
    replyTo: REPLY_TO,
    tag: 'concierge_carrier_steps',
    clientId: CLIENT_ID,
    clientSlug: 'walia-family',
    recipientEmail: TO,
    reason: "You're receiving this because Hasan onboarded Walia Family Real Estate to End Voicemail as your AI receptionist.",
  })

  console.log('=== RESULT ===')
  console.log(JSON.stringify(result, null, 2))

  if (!result.ok) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
