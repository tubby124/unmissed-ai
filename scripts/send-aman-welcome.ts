/**
 * Send Aman Walia's go-live welcome email via the app's branded Resend pipeline.
 *
 * Why this path (not raw resend.emails.send or gmail.py):
 *   - sendBrandedEmail() auto-injects List-Unsubscribe + List-Unsubscribe-Post
 *     headers (Gmail Feb 2024 bulk-sender compliance)
 *   - Auto-generates plain-text body from HTML (anti-spam signal)
 *   - Auto-appends branded footer with CASL mailing address
 *   - Auto-logs to notification_logs (audit trail; Resend webhook updates
 *     delivered/bounced status)
 *   - Single FROM brand identity (notifications@/hello@/support@ depending on purpose)
 *
 * Run:
 *   npx tsx scripts/send-aman-welcome.ts             # dryrun — prints HTML preview
 *   npx tsx scripts/send-aman-welcome.ts --send      # actually sends via Resend
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { sendBrandedEmail } from '../src/lib/email/send'

const SEND = process.argv.includes('--send')

const TO = 'amanwalia.realtor@gmail.com'
const SUBJECT = 'Your AI receptionist is live, Aman'
const CLIENT_ID = 'd0b9ccba-edc2-4f49-bf99-c3518ab30dda'
const RECIPIENT_NAME = 'Aman Walia'
const RECIPIENT_BUSINESS = 'Walia Family Real Estate'
const REPLY_TO = 'hasan.sharif.realtor@gmail.com' // Hasan owns the relationship — replies land in his Gmail

const TELEGRAM_DEEP_LINK =
  'https://t.me/hassitant_1bot?start=cfa314e0bea420edfbbfb65ed2a3d112'

const HTML = `
<style>
  .ev-h1 { font-size: 22px; font-weight: 700; margin: 0 0 16px; letter-spacing: -0.01em; color: #0F172A; }
  .ev-lead { font-size: 15.5px; line-height: 1.65; color: #1F2937; margin: 0 0 20px; }
  .ev-section { margin: 28px 0 0; padding: 20px 22px; background: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 10px; }
  .ev-step-badge { display: inline-block; background: #0F172A; color: white; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; margin-bottom: 10px; }
  .ev-step-title { font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 8px; }
  .ev-step-body { font-size: 14.5px; line-height: 1.6; color: #374151; margin: 0; }
  .ev-step-body p { margin: 8px 0; }
  .ev-step-body ul { margin: 8px 0 0; padding-left: 20px; }
  .ev-step-body li { margin: 4px 0; }
  .ev-reply-tag { display: inline-block; background: #FEF3C7; color: #92400E; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; padding: 3px 8px; border-radius: 4px; margin-left: 6px; vertical-align: middle; text-transform: uppercase; }
  .ev-telegram-cta { display: inline-block; background: #229ED9; color: white !important; text-decoration: none; padding: 13px 24px; border-radius: 8px; font-weight: 600; font-size: 14.5px; margin: 6px 0; }
  .ev-creds-box { background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px 16px; margin: 12px 0; font-size: 14px; }
  .ev-creds-box strong { color: #0F172A; }
  .ev-creds-box code { background: #F3F4F6; padding: 2px 6px; border-radius: 4px; font-family: SF Mono, Menlo, Consolas, monospace; font-size: 13px; color: #0F172A; }
  .ev-warn { background: #FEF2F2; border-left: 3px solid #DC2626; padding: 10px 14px; margin: 12px 0 0; font-size: 13.5px; color: #7F1D1D; border-radius: 4px; }
  .ev-warn strong { color: #991B1B; }
  .ev-recap { margin: 32px 0 8px; padding: 18px 22px; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 10px; }
  .ev-recap-title { font-size: 14px; font-weight: 700; color: #065F46; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px; }
  .ev-recap ol { margin: 0; padding-left: 22px; color: #064E3B; font-size: 14.5px; line-height: 1.7; }
  .ev-divider { height: 1px; background: #E5E7EB; margin: 28px 0; border: none; }
  .ev-sig { margin-top: 28px; font-size: 15px; color: #1F2937; }
  .ev-meta { margin-top: 22px; font-size: 13px; color: #6B7280; line-height: 1.6; }
  .ev-meta strong { color: #374151; }
</style>

<p class="ev-h1">Your AI receptionist is live, Aman.</p>

<p class="ev-lead">
You now have a 24/7 AI receptionist named <strong>Riley</strong> sitting on
<strong>+1 (587) 872-8187</strong>. Every call to that number gets picked up in 1–2 rings.
Riley introduces herself as your virtual assistant, takes messages, captures lead info
(name, area, budget, timeline), and flags hot leads to you the moment the call ends.
No voicemail. No missed buyers. Works while you're showing, sleeping, or in a meeting.
</p>

<p class="ev-lead" style="margin-top: 18px;">
I've laid this out as 5 steps. Two of them are quick questions I need you to reply with —
the rest you can do on your own.
</p>

<div class="ev-section">
  <span class="ev-step-badge">Step 1</span>
  <p class="ev-step-title">Test her right now.</p>
  <div class="ev-step-body">
    <p>Call <strong>+1 (587) 872-8187</strong> from your phone. She should pick up in 1–2 rings and introduce herself. Hang up whenever you've heard enough. No charge — you have 150 free minutes a month and this barely uses any.</p>
    <p>If she doesn't pick up, or sounds off, tell me — I'll fix it before you do anything else below.</p>
  </div>
</div>

<div class="ev-section">
  <span class="ev-step-badge">Step 2</span>
  <p class="ev-step-title">Connect Telegram for instant call alerts (30 seconds).</p>
  <div class="ev-step-body">
    <p>This is how Riley reaches you the second a call ends. Faster than email, richer than SMS — you get the caller's number, full transcript, and a one-line summary as a push notification.</p>
    <p style="margin-top: 14px;">
      <a href="${TELEGRAM_DEEP_LINK}" class="ev-telegram-cta">Connect Telegram alerts →</a>
    </p>
    <p style="margin-top: 14px;">It'll open Telegram (install it from the App Store if you don't have it — 1 minute). Hit the blue <strong>"Start"</strong> button at the bottom. That's the whole setup. Test by calling your number after — you should get a Telegram message within 30 seconds of hanging up.</p>
  </div>
</div>

<div class="ev-section">
  <span class="ev-step-badge">Step 3 <span class="ev-reply-tag">Reply</span></span>
  <p class="ev-step-title">Pick your alert combo.</p>
  <div class="ev-step-body">
    <p>You're getting email alerts by default. You can stack as many channels as you want — most realtors use 2 or 3 so they don't miss anything. Reply with which combo you want:</p>
    <ul>
      <li><strong>a)</strong> Telegram only (cleanest, fastest)</li>
      <li><strong>b)</strong> Telegram + SMS to your cell (instant + redundant)</li>
      <li><strong>c)</strong> Telegram + SMS + Email (belt and suspenders)</li>
      <li><strong>d)</strong> SMS + Email (skip Telegram)</li>
      <li><strong>e)</strong> Email only (the default)</li>
    </ul>
    <p style="margin-top: 12px;">If you're not sure — go with <strong>(c)</strong>. You can always turn channels off later from the dashboard. If you pick anything with SMS, also send me the cell number you want the texts to go to.</p>
  </div>
</div>

<div class="ev-section">
  <span class="ev-step-badge">Step 4 <span class="ev-reply-tag">Reply</span></span>
  <p class="ev-step-title">Tell me your carrier.</p>
  <div class="ev-step-body">
    <p>Once you've tested Riley, the next step is forwarding your personal cell to her so missed calls there also get answered. But before that, we have to remove the voicemail on your line. <strong>This is the #1 thing that breaks the whole setup.</strong> When your phone doesn't pick up, your carrier voicemail grabs the call before Riley can. Forwarding "succeeds" but never actually fires. You'll think it's working. It won't be.</p>
    <p>Different carriers handle voicemail removal differently, so I need to know who you're with first. Reply with one:</p>
    <ul>
      <li>Rogers / Fido</li>
      <li>Telus / Koodo</li>
      <li>Bell / Virgin</li>
      <li>Freedom Mobile</li>
      <li>Other (tell me which)</li>
    </ul>
    <p style="margin-top: 12px;">The second you reply, I'll send you a step-by-step (usually 2 minutes — sometimes a quick call to your carrier) plus the exact forwarding codes that work on your network.</p>
    <div class="ev-warn"><strong>Don't try to set up forwarding before that</strong> — you'll likely waste time on codes that look like they worked but didn't.</div>
  </div>
</div>

<div class="ev-section">
  <span class="ev-step-badge">Step 5</span>
  <p class="ev-step-title">Log into your dashboard.</p>
  <div class="ev-step-body">
    <p>This is your control panel. You see every call, read transcripts, listen to recordings, and customize Riley.</p>
    <div class="ev-creds-box">
      <p style="margin: 0 0 6px;"><strong>Login:</strong> <a href="https://endvoicemail.ai/login" style="color: #0F172A;">https://endvoicemail.ai/login</a></p>
      <p style="margin: 0 0 6px;"><strong>Email:</strong> <code>amanwalia.realtor@gmail.com</code></p>
      <p style="margin: 0;"><strong>Temp password:</strong> <code>MWiMpwoIxkRXNcA9!</code></p>
    </div>
    <p>Or just click <strong>"Sign in with Google"</strong> on the login page with that same Gmail — no password needed, faster.</p>
    <p style="margin-top: 14px;">You can change almost anything from there. Some things people commonly tweak on day one:</p>
    <ul>
      <li><strong>Rename her</strong> — "Riley" is a default. Want her called Maya, Sarah, Priya, Aisha, anything? Change it in Settings → Agent Identity.</li>
      <li><strong>Swap her voice</strong> — 20+ voice options (different accents, male/female, warm/professional). Settings → Voice.</li>
      <li><strong>Edit her greeting</strong> — change what she says when she picks up.</li>
      <li><strong>Add FAQs</strong> — anything you want her to know cold (commission structure, your typical response time, etc.)</li>
      <li><strong>Set business hours</strong> — if you want her to say "Aman's office hours are 9–6" outside that window.</li>
    </ul>
    <p style="margin-top: 10px;">You don't have to do any of this right away. The defaults are tuned for realtors and she works fine out of the box.</p>
  </div>
</div>

<hr class="ev-divider" />

<p class="ev-step-title" style="margin-top: 0;">What Riley knows + what she won't do.</p>
<p class="ev-step-body" style="color: #374151;">
She already knows you cover <strong>Calgary, Airdrie, Cochrane, Chestermere, Okotoks, Strathmore, and Bragg Creek</strong>. She knows you're a realtor and her job is to take messages, answer basic FAQs about your services, and triage urgent stuff.
</p>
<p class="ev-step-body" style="margin-top: 12px; color: #374151;">
She will <strong>NOT</strong> quote prices, commit to showings or times, or discuss commissions — those come back to you. Booking direct into your Google Calendar isn't on yet (that's a feature we'll switch on later if you want it). For now she captures the showing request and pings you so you can lock the time yourself.
</p>
<p class="ev-step-body" style="margin-top: 12px; color: #374151;">
<strong>150 free minutes / month. No card on file.</strong> After 60–90 days, if you're getting value, we'll talk about a paid plan ($15–20/month range). No pressure, no auto-charge.
</p>

<div class="ev-recap">
  <p class="ev-recap-title">To recap — reply with:</p>
  <ol>
    <li>Which alert combo (a, b, c, d, or e — plus your cell # if SMS)</li>
    <li>Your carrier (Rogers/Fido, Telus/Koodo, Bell/Virgin, Freedom, or Other)</li>
  </ol>
</div>

<p class="ev-step-body" style="margin-top: 20px;">
Once I have those two answers I'll wire up your alerts and send you the carrier-specific voicemail + forwarding steps. You'll be fully live in about 15 minutes of your time.
</p>

<p class="ev-step-body" style="margin-top: 14px;">
Anything sounds off — just hit reply or text me. I fix things same day.
</p>

<p class="ev-sig">Hasan</p>
`.trim()

async function main() {
  if (!SEND) {
    console.log('=== DRYRUN ===')
    console.log(`to: ${TO}`)
    console.log(`subject: ${SUBJECT}`)
    console.log(`purpose: support (replies → ${REPLY_TO})`)
    console.log(`html length: ${HTML.length} chars`)
    console.log(`telegram deep link: ${TELEGRAM_DEEP_LINK}`)
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
    tag: 'concierge_welcome',
    clientId: CLIENT_ID,
    clientSlug: 'walia-family',
    recipientEmail: TO,
    reason: `You're receiving this because Hasan onboarded ${RECIPIENT_BUSINESS} to ${RECIPIENT_NAME ? 'End Voicemail' : 'End Voicemail'} as your AI receptionist.`,
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
