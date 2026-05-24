# EndVoicemail Demo Flow, Owner Alerts, Onboarding, and Conversion Plan

## Product/pricing decisions

- No setup fee.
- AI Receptionist founding price: $119/month CAD with 250 included minutes.
- First month to prove it works: use the 30-day money-back guarantee language.
- Approved wording: “No setup fee. Your first month is yours to prove it works — if it doesn’t, cancel and we refund it under the 30-day money-back guarantee.”
- Do **not** say `$25 setup fee`.
- Do **not** call it an unlimited free month unless billing/Stripe are explicitly changed to support that.

## What we learned from Hasan’s demo test

The voice quality is strong. The weakness is conversation control: the agent lets the caller talk, but it does not consistently steer toward a useful next step.

The demo agent should not become pushy. It should lead gently:

- let the prospect talk freely;
- keep one current stage objective;
- ask one next-best question at a time;
- avoid interrogating;
- avoid assuming the caller is ready to buy;
- after answering, regain the wheel with a soft next step.

Good steering lines:

- “Want the quick version or the deeper setup version?”
- “Want me to show you what the owner alert would look like?”
- “If you wanted to get this running, the next step is pretty simple…”

## Call stages recommendation

Use Ultravox call stages to make the demo feel like a founder-led sales call instead of a generic AI chat.

### Stage 0 — pre-call context

Not spoken. Load caller phone, referral/source, page context, and whether SMS/Telegram tools are available.

### Stage 1 — opener

Goal: identify what the caller wants without over-pitching.

- If caller is curious: explain simply.
- If caller is skeptical: answer objection.
- If caller wants demo: run simulation.
- If caller is ready: send onboarding link or book setup.

### Stage 2 — problem discovery

Goal: find their missed-call pain.

Ask at most 1–2 questions:

- “What kind of business do you run?”
- “Are calls going to voicemail, or just not getting answered?”
- “When you miss a call, what usually happens?”

### Stage 3 — product explanation

Goal: explain EndVoicemail in one clean spine.

- Caller already has a business number.
- They forward missed/busy/after-hours calls to the AI number.
- The AI answers, qualifies, and captures the lead.
- Owner gets the lead summary instantly by Telegram/SMS/email.
- First month proves whether it earns its keep.

### Stage 4 — live simulation / money shot

Goal: show the owner-alert moment.

The agent should offer: “Want me to show you what the owner alert would look like after a real customer call?”

Then generate a demo lead summary and, when tools exist, send the owner/demo alert to the configured Telegram target.

### Stage 5 — close path

Branch by intent:

- Hot: send onboarding link + offer setup walkthrough.
- Warm: collect email/phone + send recap.
- Skeptical: answer objection and offer demo alert proof.
- Not ready: send link, no pressure.

## Owner alert requirement

Demo calls and test calls should create owner-visible alerts, not disappear into logs.

Expected behavior:

- When someone tests the demo agent, send a concise Telegram alert to the configured owner bot/channel, similar to how Aisha/Anders calls notify Hasan.
- Include caller phone if available, detected intent, lead score, pain point, summary, and recommended next action.
- Mark test/demo calls clearly so the owner knows it was a demo interaction.

## Conversion tracking requirement

We cannot honestly claim “customers are converting” without tracking demo → onboarding → checkout → activation.

Needed funnel events:

- demo_call_started
- demo_call_completed
- sms_sent
- owner_alert_sent
- onboarding_started
- checkout_started
- checkout_completed
- agent_activated
- first_forwarded_call_completed

Core question to answer later: of people who talk to Zara, how many start onboarding and how many activate a paid agent?
