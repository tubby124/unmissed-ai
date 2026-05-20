# Zara Demo Agent v14 Design

Date: 2026-05-20
Owner: Hasan / unmissed.ai
Scope: `unmissed-demo` only

## Goal

Make Zara sound closer to the dialed Hasan and Urban Vibe agents while still proving the product during the call.

The demo should feel like a real sales conversation, not a scripted IVR. Zara should answer questions, show the SMS capability mid-call, use the knowledge base for evolving product truth, book demos through the connected calendar when appropriate, and route strong prospects toward signup or Hasan.

## Current Runtime Truth

- Browser demo and call-me demo fetch `clients.system_prompt` for `unmissed-demo` from Supabase.
- `clients/unmissed-demo/SYSTEM_PROMPT.txt` currently matches Supabase v13.
- The persistent Ultravox agent for direct inbound demo calls is drifted from Supabase and should be synced after the prompt update.
- `unmissed-demo` has `booking_enabled=true`.
- `unmissed-demo` has `calendar_auth_status=connected`.
- The connected calendar is `hasan.sharif.realtor@gmail.com`.
- Booking works through the stage flow: triage agent calls `transitionToBookingStage`; the booking stage exposes `checkCalendarAvailability` and `bookAppointment`.
- Booking creates a Google Calendar event and sends a booking confirmation SMS when SMS is enabled and the caller has a real phone number.
- Post-call owner email is enabled for `admin@unmissed.ai`.
- Telegram owner alert is not reliable for this demo row right now because `telegram_chat_id` exists but `telegram_bot_token` is missing.
- `knowledge_backend='pgvector'` and approved knowledge chunks exist, but the public demo tool builder does not currently inject `queryKnowledge` into browser/call-me demo calls.

## Product Truth

Pricing Zara should use:

- Pro plan: `$119/month`, includes `250 minutes`.
- Trial plan: `$29/month`, includes `50 minutes`.
- Trial positioning: a low-friction way to test the system and mess around with it before committing.
- Do not mention the old `$20/month` beta price.
- Do not mention stale `$29 founding / $49 regular` pricing from old knowledge unless the knowledge chunks are updated first.

## Design Direction

Use a "small stable prompt, living knowledge base" model.

The prompt should contain only:

- identity and opening
- core GLM/Ultravox safety rules
- voice style
- high-level conversation flow
- tool usage rules
- pricing anchor
- close paths

The knowledge base should contain:

- detailed feature explanations
- customer/niche examples
- competitor comparisons
- new product features
- use cases by business type
- objections and suggested answers
- lessons learned from future calls

This keeps the agent easier to improve. Product truth changes should usually update knowledge chunks, not the core prompt.

## Prompt Shape

Rewrite `clients/unmissed-demo/SYSTEM_PROMPT.txt` as Zara v14.

Target length: 6,000 to 7,500 chars.

Hard constraints:

- Keep the mandatory GLM rules:
  - Never repeat any sentence already said in this call.
  - After opening, wait silently for the caller.
  - Do not output reasoning.
  - Reason and respond in English only.
  - Keep turns under 25 words unless asked for detail.
- Keep prompt-injection defense.
- Keep emergency override.
- Keep one-question-at-a-time.
- Keep natural speech instructions, but reduce canned phrases.

Flow:

1. Open naturally.
2. Answer the caller's first question directly.
3. Ask one context question about their business or missed-call pain.
4. Use `queryKnowledge` for detailed product, niche, competitor, or feature questions.
5. Show the SMS feature early when phone + SMS tool are available.
6. If they want a demo call booked, collect name/service context and call `transitionToBookingStage`.
7. If they are ready, text setup link and offer Hasan transfer.
8. If they are browsing, text the link and keep the door open.

Tone:

- relaxed, confident, lightly salesy
- no corporate cliches
- no fake-human claims
- no overexplaining that "this is a demo" unless the caller reacts to the voice or asks what is happening
- vary backchannels instead of forcing one on every response

## Tool Behavior

### SMS

If `CALLER PHONE` exists and `sendTextMessage` is available:

- Zara should send a short live demo text once early in the call.
- She should frame it naturally, for example: "yeah, watch this - I just texted you the setup link."
- SMS body should include the setup link and pricing in plain language.
- Post-call SMS dedupe should prevent duplicate follow-up texts.

If SMS is unavailable:

- Do not offer to text.
- Offer to share the link verbally or use the call-me path.

### Booking

The main prompt should not mention `checkCalendarAvailability` or `bookAppointment`.

It should mention only `transitionToBookingStage`, because direct calendar tools are exposed inside the booking stage, not triage.

When the caller wants to book:

- collect caller name if missing
- capture the service/request, such as "demo call" or "setup walkthrough"
- include any date/time preference in `serviceType` if the caller volunteered one
- call `transitionToBookingStage`

The booking stage handles calendar availability, event creation, confirmation SMS, and hangup.

### Knowledge

Add `queryKnowledge` to demo runtime tools for browser and call-me when:

- demo client has `knowledge_backend='pgvector'`
- approved knowledge chunk count is greater than 0
- demo route has a real `clientSlug`

Use the existing `buildKnowledgeTools(slug)` helper.

Zara should call `queryKnowledge` for:

- specific features
- how different customer types use the app
- competitor comparisons
- detailed setup questions
- feature roadmap questions
- niche-specific pain points

Zara should not call `queryKnowledge` for:

- greetings
- emergency handling
- simple pricing
- basic "what is this?" answers
- booking actions
- caller personal data

Knowledge answers must not expose private customer data. Customer examples should be anonymized by industry unless a public/demo customer is explicitly approved for mention.

## Knowledge Content Refresh

Update demo knowledge so the chunks no longer teach stale pricing.

Initial knowledge updates:

- Pro plan: `$119/month`, `250 minutes`.
- Trial plan: `$29/month`, `50 minutes`.
- SMS during call.
- Google Calendar booking.
- Owner notifications by SMS/Telegram/email depending on setup.
- Knowledge base improvements.
- Learning loop: call gaps become future knowledge/prompt improvements.
- Customer examples by category, anonymized:
  - real estate agent
  - property manager
  - auto glass shop
  - service/trade business
  - restaurant or appointment-heavy business

Do not expose private customer names, phone numbers, transcripts, or internal client notes in demo knowledge.

## Improvement Loop

Create a small operating doc for Zara:

`clients/unmissed-demo/ZARA_IMPROVEMENT_LOOP.md`

It should explain:

- where to edit the prompt
- where to edit product knowledge
- how to add new approved demo knowledge
- how to log call faults
- when to update the vault
- how to deploy and test

Create a fault log:

`clients/unmissed-demo/ZARA_FAULT_LOG.md`

Each entry should capture:

- date
- call id or source
- symptom
- likely cause
- fix type: prompt, knowledge, tool/runtime, product truth, pricing, voice/VAD
- action taken
- verification result

Vault update rule:

- If a fault is specific to Zara, log it in the repo fault log.
- If it teaches a reusable unmissed.ai pattern, summarize it into the Obsidian unmissed knowledge area after the repo change is verified.
- Do not put secrets, private customer details, or raw transcripts in the vault.

## 1M MRR Demo Intelligence Layer

This project should not stop at "better prompt." A top-tier SaaS demo agent should turn every call into conversion signal, product learning, and proof of value.

### Demo Call Scorecard

Every completed Zara demo should produce a scorecard, either in the post-call analysis or a dedicated demo analysis step:

- clarity: did Zara explain what the product does in plain language?
- capability proof: did Zara send SMS when available?
- knowledge use: did Zara call `queryKnowledge` for detailed feature, customer-type, competitor, or roadmap questions?
- qualification: did Zara learn the caller's business type and missed-call pain?
- close quality: did Zara move toward trial, Pro, booking, or Hasan transfer when appropriate?
- objection handling: what objection came up and was it answered?
- fault detection: did she sound robotic, repeat herself, expose stale pricing, fake a tool, or miss a capability?

The scorecard should feed the fault log and future knowledge updates.

### Buyer Intent Capture

The system should capture structured sales intelligence from demo calls:

- business type
- rough business size or call volume if mentioned
- missed-call pain
- features they cared about: SMS, booking, transfer, knowledge, voicemail replacement, analytics
- objection or hesitation
- plan fit: trial, Pro, or not qualified
- next best action
- exact phrase that showed buying intent

This should be usable for the owner notification and later CRM/lead queue work.

### Demo-To-Onboarding Continuity

If a caller signs up after talking to Zara, onboarding should not start cold.

Preserve safe demo context where possible:

- business type
- feature interests
- pain points
- objections
- requested setup path
- whether they wanted a booking or human follow-up

Do not store or reuse sensitive personal details beyond what is already allowed in existing lead/call logging.

### Proof Mode

Zara should be able to demonstrate the owner-side value, not only caller-side SMS.

Target behavior:

- If the caller asks what the owner receives, Zara explains the owner gets a concise call summary with lead quality, reason, next step, transcript/recording when enabled, and booking details when applicable.
- When runtime supports it, send or show a demo owner-alert preview.
- Do not claim Telegram is live unless the demo row actually has the bot token configured.

This becomes a key conversion moment: the caller sees what their own business would receive after each missed call.

### Knowledge Gap Auto-Queue

When Zara cannot answer a question:

- log the question as a knowledge gap
- classify whether the fix belongs in prompt, knowledge, runtime/tooling, pricing/product truth, or docs
- if the answer is safe and reusable, create a suggested knowledge chunk
- if repeated across calls, promote it into product docs and the vault

The goal is that every unanswered demo question improves the next demo.

### Private Customer Example Rules

Zara may explain patterns by industry:

- "property managers use it for after-hours maintenance"
- "auto glass shops use it for quote calls while technicians are on jobs"
- "real estate agents use it for showings, buyer calls, and listing inquiries"

Zara must not expose private customer names, call details, tenant details, owner numbers, transcripts, or internal client performance. Use named examples only if they are public and approved.

### Pricing Drift Guard

Before deploying Zara, check that pricing agrees across:

- `clients/unmissed-demo/SYSTEM_PROMPT.txt`
- `clients/unmissed-demo/domain-knowledge.md`
- approved `knowledge_chunks`
- public pricing copy, if touched in the same phase
- Stripe/product config, if touched in the same phase
- promptfoo expectations

For this phase, the source of truth is Pro `$119/month` with `250 minutes`, and trial `$29/month` with `50 minutes`.

### Owner Notification Truth

Zara should describe owner alerts truthfully:

- confirmed today: owner email can be sent when email notifications are enabled
- confirmed today: caller SMS and booking confirmation SMS can be sent when SMS is enabled
- not confirmed today for `unmissed-demo`: Telegram owner alert, because `telegram_bot_token` is missing

Prompt language should say owners can receive SMS, email, or Telegram depending on setup. After implementation, verification must prove which channels actually fired for the demo row.

### Demo Analytics

Track and review:

- demo calls started
- calls completed
- SMS sent during call
- booking stage entered
- booking created
- `queryKnowledge` used
- hot/warm/cold classification
- owner alert sent
- top questions
- top objections
- knowledge misses
- conversion action taken: trial, Pro, booking, transfer, no action

This is how Zara improves toward revenue instead of vibes.

### Hot Lead Owner Alert

If a caller is hot, Zara should not only offer Hasan. The system should create a high-signal owner alert:

- hot lead
- business type
- what they asked
- pricing or buying intent
- requested next step
- caller phone/email if available

This can initially ride on the existing completed-call notification path, then later become a live in-call owner page/Telegram alert.

## Files To Change

Expected implementation files:

- `clients/unmissed-demo/SYSTEM_PROMPT.txt`
- `clients/unmissed-demo/SYSTEM_PROMPT_TEST.txt`
- `clients/unmissed-demo/domain-knowledge.md`
- `clients/unmissed-demo/ZARA_IMPROVEMENT_LOOP.md`
- `clients/unmissed-demo/ZARA_FAULT_LOG.md`
- `src/lib/demo-prompts.ts` or demo routes, only if needed for capability metadata
- `src/app/api/demo/start/route.ts`
- `src/app/api/demo/call-me/route.ts`
- `src/lib/ultravox.ts`
- `src/lib/__tests__/demo-capabilities.test.ts`
- `tests/promptfoo/unmissed-demo.yaml`

Avoid broad prompt architecture refactors in this phase.

## Verification

Run the narrow checks first:

- `npx tsx --test src/lib/__tests__/demo-capabilities.test.ts`
- `npx promptfoo eval -c tests/promptfoo/unmissed-demo.yaml`

Then deploy and verify:

- `python3 scripts/deploy_prompt.py unmissed-demo "Zara v14 compressed prompt + knowledge demo runtime"`
- `python3 scripts/prompt_status.py` will not cover `unmissed-demo` unless the script is updated, so manually verify local, Supabase, and Ultravox prompt hashes or add `unmissed-demo` to the status script in a separate small patch.
- Place one call-me demo.
- Confirm Zara sends the mid-call SMS.
- Confirm `queryKnowledge` can answer a feature/detail question.
- Confirm booking reaches the booking stage and creates a calendar event.
- Confirm caller receives booking confirmation SMS.
- Confirm owner email notification fires after the completed webhook.
- Confirm Telegram behavior separately after the missing bot token is fixed, or explicitly document it as unavailable for `unmissed-demo`.
- Confirm demo scorecard captures SMS, booking, knowledge, close quality, and faults.
- Confirm knowledge gaps are logged when Zara cannot answer a safe product question.
- Confirm hot demo leads produce an actionable owner summary.

## Non-Goals

- Do not rebuild the full prompt pipeline.
- Do not change pricing pages in this phase.
- Do not change Stripe plans in this phase.
- Do not expose real customer/private data in demo knowledge.
- Do not fix Telegram configuration unless explicitly included in the implementation plan.
- Do not deploy until prompt tests pass and the change is reviewed.
- Do not build a full CRM in this phase; only capture lead intelligence in existing demo/call analysis surfaces or a narrow new helper.

## Risks

- If stale pricing remains in approved knowledge chunks, `queryKnowledge` can still contradict the prompt.
- If `queryKnowledge` is added to demo tools without approved chunk gating, empty or irrelevant results can hurt the demo.
- If the prompt remains too long, GLM may keep sounding rigid or repeat itself.
- If Telegram config remains incomplete, owner notification claims should say email/SMS are confirmed and Telegram depends on setup.
- If demo scorecards are too broad, the implementation can become an analytics project. Keep the first version narrow and tied to Zara demo calls only.

## Success Criteria

- Zara sounds conversational and less robotic.
- Zara says `$119/month for 250 minutes` and `$29/month for 50 minutes` consistently.
- Zara sends a mid-call text in call-me/direct phone demos.
- Zara uses `queryKnowledge` for detailed product and niche questions.
- Zara books through the existing booking stage instead of referencing direct calendar tools.
- Prompt and knowledge are documented so future improvements are easy.
- New call faults have a clear place to be logged and converted into prompt/knowledge/runtime fixes.
- Demo calls produce structured scorecards and buyer-intent summaries.
- Knowledge gaps from demo calls can be turned into approved knowledge updates.
- Owner notification claims match what the demo row can actually send.
