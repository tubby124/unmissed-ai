# Inbound Voice Agent — Client Intake Form

> **Version:** 1.0 — Feb 24, 2026
> **Purpose:** Collect everything needed to fill out `PROMPT_TEMPLATE_INBOUND.md` and deploy a new inbound AI voice agent
> **Time to complete:** 15-20 minutes with the client
> **Output:** Completed prompt ready to paste into Google Sheets → System Prompt A2

---

## How to Use This Form

1. **Start with Section 0 (Goal Alignment) — do not skip.** Getting the goal wrong means the agent collects the wrong data or routes calls incorrectly.
2. Fill in Sections 1-5 with the client on an onboarding call (or send as a Google Form)
3. Map each answer to the `{{VARIABLE}}` in `PROMPT_TEMPLATE_INBOUND.md`
4. Replace all `{{VARIABLES}}` in the template
5. Update the PRODUCT KNOWLEDGE BASE section with client-specific Q&A
6. Paste the completed prompt into Google Sheets → System Prompt A2
7. Test one real call before production launch

---

## SECTION 0 — Goal Alignment (DO THIS FIRST)

> **Why this section exists:** A client says "I need an AI receptionist" but means different things. Some want to book appointments directly, others just want to capture lead info for a callback, others want to handle FAQs so staff don't get bothered. Getting this wrong means the agent does the wrong thing on every single call.

**Q0a. What is the ONE thing the AI must accomplish on each inbound call?**
> Common answers:
> - **Capture info for callback** → collect vehicle/service/contact info so the owner can call back to quote and schedule
> - **Direct booking** → AI books the appointment directly using a calendar tool
> - **FAQ handler** → answer common questions, quote hours/location, let humans handle bookings
> - **Mixed** → clarify primary vs secondary

Primary goal: _______________
Secondary goal (if any): _______________

**Q0b. What information MUST the agent collect before hanging up?**
> This becomes the COMPLETION CHECK gate — the agent will NOT hang up until all fields are collected.
> Standard inbound fields: vehicle info (auto glass) / system info (HVAC) / patient type (dental) / preferred timing
> Keep to 3-5 fields max — more than 5 and collection rates drop sharply.

Required fields (list them): _______________
> Maps to: `{{COMPLETION_FIELDS}}`

**Q0c. What does the caller receive after the call?**
> E.g., "SMS with our callback number", "Confirmation they're in the queue", "Nothing — they wait for our call"

Caller receives: _______________

**Q0d. What does the CLIENT (you) receive after each call?**
> E.g., "Telegram notification with caller info", "Email summary", "Sheets row", "All three"

Client receives: _______________

**Q0e. What does the AI NEVER say on this call?**
> Critical guardrails. E.g., "Never quote prices", "Never promise a specific time slot", "Never give the owner's personal cell"

Never say/do: _______________

---

## SECTION 1 — Business Basics

**Q1. Full business name:**
> Example: "Windshield Hub Auto Glass"
> Maps to: `{{BUSINESS_NAME}}`

Answer: _______________

---

**Q2. City or service area:**
> Example: "Saskatoon" / "North Calgary" / "downtown Edmonton"
> Maps to: `{{CITY}}`

Answer: _______________

---

**Q3. Agent name:**
> This is what the AI calls itself. Pick something real-sounding and first-name only.
> Default suggestion: "Mark" (neutral, works for any service business)
> Maps to: `{{AGENT_NAME}}`

Answer: _______________ (or leave blank for default "Mark")

---

**Q4. What industry are you in? (2-3 words):**
> Used in the wrong-number filter: "sorry, you got the wrong number — this is a {{INDUSTRY}}"
> Examples: "auto glass shop" / "HVAC company" / "dental office" / "plumbing company" / "law firm"
> Maps to: `{{INDUSTRY}}`

Answer: _______________

---

**Q5. Weekday business hours:**
> Example: "Monday to Friday, 9 AM to 5 PM" / "Monday to Saturday, 8 AM to 6 PM"
> Maps to: `{{HOURS_WEEKDAY}}`

Answer: _______________

---

## SECTION 2 — Insurance & Billing

**Q6. Do you accept insurance claims directly?**
> Pick the option that matches — this is what the agent says when a caller asks about insurance.

☐ **Private pay only** → maps to: `private pay right now` / `happy to give ya a receipt for your claim`

☐ **SGI approved (Saskatchewan)** → maps to: `SGI approved` / `we can bill SGI directly — just bring your claim number`

☐ **All major insurance** → maps to: `set up with most insurance providers` / `just let us know who you're with and we'll handle the billing`

☐ **Pending approval** → maps to: `private pay for now` / `we're working on getting set up with insurance — happy to give ya a receipt`

☐ **Not applicable** (e.g., dental with own billing) → describe: _______________

☐ **Other** → describe: _______________

Selected: `{{INSURANCE_STATUS}}` = _______________ | `{{INSURANCE_DETAIL}}` = _______________

---

## SECTION 3 — Services & Call Routing

**Q7. What is the main reason people call you?**
> This is the primary service trigger — when the caller says this, the agent goes into triage mode.
> Example: "windshield repair or replacement" / "heating or cooling issue" / "tooth pain or dental appointment"
> Maps to: `{{PRIMARY_CALL_REASON}}`

Answer: _______________

---

**Q8. Describe the triage questions the agent should ask when a caller wants your main service:**
> These are the 2-4 questions that help the agent understand the specific service need BEFORE collecting info.
> Think: what do your staff ask on the phone right now to figure out what the customer needs?
>
> Auto glass example:
> - "Is it a chip (usually repairable) or a crack / full break (usually replacement)?"
> - "Do they have a lane assist camera (ADAS calibration needed)?"
>
> HVAC example:
> - "Heating or cooling problem?"
> - "Not running at all, or running but not effective?"
>
> Dental example:
> - "Emergency/pain or routine appointment?"
> - "New or existing patient?"

Your triage questions: _______________
> Maps to: `{{TRIAGE_SCRIPT}}`

---

**Q9. What is the first question you always ask to start collecting customer info?**
> After triage, what's the first thing you need from every caller?
> Example: "what year, make, and model is it?" / "what's your address?" / "what's your name?"
> Maps to: `{{FIRST_INFO_QUESTION}}`

Answer: _______________

---

**Q10. What info must be collected from every caller? (full list):**
> Everything needed for your team to call back and take action.
> Example (auto glass): year, make, model, ADAS camera yes/no, preferred timing
> Example (HVAC): type of system, what's happening, how old is the unit, preferred timing
> Example (dental): new or existing patient, what they need, preferred day
> Maps to: `{{INFO_TO_COLLECT}}`

Answer: _______________

---

**Q11. What do you call this information? (2-3 words):**
> Used in filter routing: "lemme grab your {{INFO_LABEL}} quick..."
> Example: "vehicle info" / "system info" / "patient info" / "job details"
> Maps to: `{{INFO_LABEL}}`

Answer: _______________

---

**Q12. Are there any services you do NOT offer?**
> When callers ask for these, the agent says "we don't handle that one but I can have {{CLOSE_PERSON}} call ya back to point ya in the right direction."
> Leave blank if you handle everything in your category.
> Maps to: `{{SERVICES_NOT_OFFERED}}`

Answer: _______________ (or leave blank)

---

**Q13. Do you come to the customer, or does the customer come to you?**
> Maps to: `{{MOBILE_POLICY}}`

☐ Customer always comes to us → "you'd bring it to us" / "you'd come in to us"
☐ We always go to the customer → "we come to you"
☐ Depends on the job → describe: _______________

Answer: _______________

---

## SECTION 4 — Scheduling & Follow-up

**Q14. How do you want the call to end? What phrase describes what happens next?**
> This is the call to action: what does the agent tell the caller will happen after the call?
> Example: "call ya back with a quote and to confirm your slot" / "have our technician call to schedule" / "our front desk will call to book your appointment"
> Maps to: `{{CLOSE_ACTION}}`

Answer: _______________

---

**Q15. Who follows up with the caller?**
> Used naturally throughout the call: "i'll have {{CLOSE_PERSON}} call ya back"
> Example: "the boss" / "our technician" / "our front desk team" / "one of our staff"
> Maps to: `{{CLOSE_PERSON}}`

Answer: _______________

---

**Q16. Weekend policy — do you open on weekends?**
> The agent uses this phrase when a caller asks about Saturday/Sunday.
> Maps to: `{{WEEKEND_POLICY}}`

☐ Never → "sorry, we're weekdays only — monday to friday"
☐ Saturdays only → "yeah we're open saturdays too — [add hours]"
☐ Sometimes (urgent only) → "we can sometimes open up saturday or sunday if it's urgent"
☐ Custom: _______________

Answer: _______________

---

**Q17. What is the scheduling phrase callers hear?**
> How does the caller describe "coming in"? Use their language.
> Example: "bring it in" / "come in" / "schedule the service" / "book your appointment"
> Maps to: `{{SERVICE_TIMING_PHRASE}}`

Answer: _______________

---

**Q18. Callback phone number:**
> For the SMS follow-up and for the agent to give callers if they ask for a number.
> Should be the real shop number or owner's mobile — NOT the AI line.
> Maps to: `{{CALLBACK_PHONE}}`

Answer: _______________

---

## SECTION 5 — Notifications & Setup

**Q19. How does the owner want to receive call notifications?**

☐ Telegram (recommended — instant, free)
  → Need: Telegram username or phone number to set up bot

☐ Email (via daily summary or per-call)
  → Need: email address

☐ Both

Preferred contact: _______________

---

**Q20. What timezone are you in?**
> Used for cron summary timing and correct call timestamps.

☐ Saskatchewan (America/Regina) — UTC-6, no DST
☐ Alberta (America/Edmonton) — UTC-7/UTC-6 (has DST)
☐ British Columbia (America/Vancouver) — UTC-8/UTC-7 (has DST)
☐ Ontario/Quebec (America/Toronto) — UTC-5/UTC-4 (has DST)
☐ Other: _______________

---

**Q21. What time should the daily summary be sent?**
> Recommended: end of business day

Answer: _______________ (default: 6 PM local)

---

## SECTION 6 — Agent Personality (Optional)

**Q22. Any phrases or words the agent should always use or avoid?**
> Leave blank to use the default casual shop-person voice
> Example: "always say 'for sure' instead of 'no problem'" / "never say 'unfortunately'"

Answer: _______________

---

**Q23. Anything callers frequently ask that the agent should know?**
> E.g., parking, waiting room, specific intersection, "do you work on [unusual vehicle]"
> This gets added to the PRODUCT KNOWLEDGE BASE section of the prompt.

Answer: _______________

---

## Quick Variable Mapping Reference

| Variable | Intake Question |
|----------|----------------|
| `{{BUSINESS_NAME}}` | Q1 |
| `{{CITY}}` | Q2 |
| `{{AGENT_NAME}}` | Q3 |
| `{{INDUSTRY}}` | Q4 |
| `{{HOURS_WEEKDAY}}` | Q5 |
| `{{INSURANCE_STATUS}}` | Q6 — first part |
| `{{INSURANCE_DETAIL}}` | Q6 — second part |
| `{{PRIMARY_CALL_REASON}}` | Q7 |
| `{{TRIAGE_SCRIPT}}` | Q8 |
| `{{FIRST_INFO_QUESTION}}` | Q9 |
| `{{INFO_TO_COLLECT}}` | Q10 |
| `{{INFO_LABEL}}` | Q11 |
| `{{SERVICES_NOT_OFFERED}}` | Q12 |
| `{{MOBILE_POLICY}}` | Q13 |
| `{{CLOSE_ACTION}}` | Q14 |
| `{{CLOSE_PERSON}}` | Q15 |
| `{{WEEKEND_POLICY}}` | Q16 |
| `{{SERVICE_TIMING_PHRASE}}` | Q17 |
| `{{CALLBACK_PHONE}}` | Q18 |
| `{{COMPLETION_FIELDS}}` | Q0b |

---

## Deployment Checklist

**Business setup:**
- [ ] All intake questions answered (Q0-Q23)
- [ ] All `{{VARIABLES}}` in PROMPT_TEMPLATE_INBOUND.md replaced
- [ ] PRODUCT KNOWLEDGE BASE section written (8-12 Q&A entries)
- [ ] Prompt pasted into Google Sheets → System Prompt → A2

**Technical setup:**
- [ ] Twilio number purchased (correct area code for client's city)
- [ ] Caller ID Lookup enabled on Twilio number
- [ ] Ultravox API key ready
- [ ] OpenRouter API key ready
- [ ] Google Sheets created: "Call Log" tab + "System Prompt" tab
- [ ] Telegram bot created + chat ID obtained (if using Telegram)
- [ ] n8n workflow cloned from `workflow_change15_cron.json`
- [ ] All webhook URLs, phone numbers, sheet IDs updated in n8n
- [ ] `callEndedWebhookUrl` set in Enhanced Call Setup → `https://n8n.srv728397.hstgr.cloud/webhook/{client}-completed` (REQUIRED — without this, Telegram/Sheets never fire after call ends)
- [ ] All credentials created and authorized in n8n UI
- [ ] Google Sheets OAuth authorized in n8n (manual step — cannot automate)
- [ ] Workflow activated

**Verification:**
- [ ] Test call placed — all n8n nodes green — `endReason = agent_hangup` confirmed via Ultravox API
- [ ] Google Sheets row created with correct data
- [ ] Telegram notification received
- [ ] SMS sent to caller with callback number
- [ ] Daily summary fires at correct time
- [ ] Client call forwarding configured on their carrier

---

## Completed Example — Windshield Hub Auto Glass (Saskatoon)

| Question | Answer |
|----------|--------|
| Q0b Completion fields | vehicle year, make, model, and preferred timing |
| Q1 Business name | Windshield Hub Auto Glass |
| Q2 City | Saskatoon |
| Q3 Agent name | Mark |
| Q4 Industry | auto glass shop |
| Q5 Hours | Monday to Friday, 9 AM to 5 PM |
| Q6 Insurance | Private pay — "private pay right now" / "happy to give ya a receipt for your claim" |
| Q7 Primary call reason | windshield repair or replacement |
| Q8 Triage | chip/crack assessment + ADAS camera check |
| Q9 First info question | what year, make, and model is it? |
| Q10 Info to collect | year, make, model, ADAS camera |
| Q11 Info label | vehicle info |
| Q12 Services not offered | (none) |
| Q13 Mobile policy | customer comes to us — "you'd bring it to us" |
| Q14 Close action | call ya back with a quote and to confirm your slot |
| Q15 Close person | the boss |
| Q16 Weekend | sometimes urgent — "we can sometimes open saturday if it's urgent" |
| Q17 Timing phrase | bring it in |
| Q18 Callback phone | (587) 355-1834 |
| Q19 Notifications | Telegram |
| Q20 Timezone | Saskatchewan (America/Regina) |
| Q21 Summary time | 6 PM |

---

## Section 7 — Deployment Learnings

> This section grows with every client build. Apply to all future inbound deployments.

**L1. Auto glass-specific: SGI language causes confusion outside Saskatchewan**
The original Windshield Hub prompt used SGI-specific language. Out-of-province callers don't know what SGI is. The `{{INSURANCE_STATUS}}` + `{{INSURANCE_DETAIL}}` variable pattern fixes this — pick the right option for the client's province/region.

**L2. Never promise a time slot**
The agent must NEVER say "that time is open" or "we have that available." Always route to `{{CLOSE_PERSON}}` for confirmation. Promising a slot that doesn't exist = angry caller + bad review.

**L3. TRIAGE_SCRIPT must match how YOUR staff actually talks**
The best triage script sounds like a real conversation. Ask the client: "What do you say when someone calls about [service]?" — then use their exact language. Generic triage language sounds robotic.

**L4. Test the ADAS/sensor check language carefully (auto glass)**
Callers don't know what "ADAS" means. The Windshield Hub prompt uses "that lane assist camera up by the mirror" — much more understandable than "ADAS camera calibration system."

**L5. COMPLETION_FIELDS is the most important intake answer**
This is the gate that determines whether the agent's job is "done." If you get this wrong, the agent either hangs up too early or drags on too long. Ask the client: "What do you need from every call before your team can act on it?"

**L6. The CLOSE_PERSON phrase sets caller expectations**
"the boss" works well for small owner-operated shops. "our front desk team" works better for larger practices. Match the language to the client's actual team structure. Mismatched phrasing sounds fake.

**[Add L7, L8... as new clients are built]**
