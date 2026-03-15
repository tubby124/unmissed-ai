# Outbound ISA Agent — Client Intake Form

> **Version:** 1.1 — Feb 24, 2026 (updated from Manzil v1.1 — generalized for any outbound ISA client)
> **Purpose:** Collect all information needed to fill out `PROMPT_TEMPLATE_ISA.md` and deploy a new outbound ISA agent
> **Time to complete:** 20-25 minutes with the client
> **Output:** Completed prompt ready to paste into Google Sheets → System Prompt A2

---

## How to Use This Form

1. **Start with Section 0 (Goal Alignment) — do not skip.** Getting the goal wrong means the agent does the wrong thing on every call. This happened in the first Manzil test where Fatima pushed booking when the lead expected data collection.
2. Fill in Sections 1-5 with the client on an onboarding call (or send as a Google Form)
3. Map each answer to the `{{VARIABLE}}` in `PROMPT_TEMPLATE_ISA.md`
4. Replace all `{{VARIABLES}}` in the template
5. Update the PRODUCT KNOWLEDGE BASE section with client-specific Q&A
6. Remove all [OPTIONAL — CULTURAL] sections if the campaign is NOT targeting a specific cultural/religious community
7. Paste completed prompt into Google Sheets → System Prompt A2
8. Test one live call before production launch

---

## SECTION 0 — Goal Alignment (DO THIS FIRST)

> **Why this section exists:** In the first Manzil live test, the agent pushed meeting bookings. The lead said: "I don't wanna meet them — I thought you needed some information from me." 3 wasted calls before the goal mismatch was caught. This section prevents that.

**Q0a. What is the ONE thing the AI must accomplish on each outbound call?**
> Common answers:
> - **Data collection ISA** → collect email, timeline, budget, qualification data so the team can act
> - **Booking ISA** → get the lead on a calendar with a human consultant/agent
> - **Qualification ISA** → find out if they're HOT/WARM/COLD so the human team can prioritize
> - **Event registration** → commit them to attending an upcoming event or webinar
> - **Mixed** → clarify primary vs secondary (which is non-negotiable before hangUp?)

Primary goal: _______________
Secondary goal (if any): _______________

**Q0b. What information MUST the agent collect on EVERY call before closing?**
> These become the COMPLETION CHECK gate — agent will not close until ALL are collected.
> Standard ISA fields: email, purchasing timeline, price range, down payment amount/percent
> Keep to 4-6 fields max — more than 6 and completion rates drop sharply.

Required fields (list them): _______________
> Maps to: `{{REQUIRED_FIELDS}}`

**Q0c. What is the ONE sentence describing what the AI must accomplish on each call?**
> Be specific. E.g., "Collect the lead's email, timeline, price range, and down payment" (data ISA)
> Or: "Book a 30-minute call between the lead and [Contact Name]" (booking ISA)
> Or: "Qualify the lead as HOT/WARM/COLD and collect their email" (qualification ISA)

Primary goal sentence: _______________
> Maps to: `{{ISA_PRIMARY_GOAL}}`

**Q0d. After the call, what does the LEAD receive?**
> E.g., "SMS with contact info", "Email confirmation", "Calendar invite", "Nothing — team calls them back"

Lead receives: _______________

**Q0e. After the call, what does the CLIENT receive?**
> E.g., "Telegram notification with collected data", "Email with call summary", "Google Sheets update", "All three"

Client receives: _______________

**Q0f. What does the AI NEVER say on this call?**
> Critical guardrails. E.g., "Never give out URLs or form links", "Never quote rates or fees", "Never promise callback timing"

Never say/do: _______________

**Q0g. Is this campaign targeting a specific cultural or religious community?**
> This determines whether the CULTURAL CONTEXT sections get included in the prompt.
> If YES: fill Section 5 (Cultural Context). If NO: skip Section 5 and remove all [OPTIONAL — CULTURAL] blocks from the template.

YES / NO

---

## SECTION 1 — Agent & Team Setup

**Q1. What should the AI agent be named?**
> First name only. Choose something that fits the campaign's community and tone.
> Real estate/mortgage examples: Fatima, Sara, Layla, James, Alex, Jamie
> Maps to: `{{AGENT_NAME}}`

Agent name: _______________

---

**Q2. Primary contact's full name:**
> The main person leads will connect with after the call.
> Maps to: `{{CONTACT_1_NAME}}`

Name: _______________

---

**Q3. Primary contact's phone number (raw + spoken format):**
> Maps to: `{{CONTACT_1_PHONE_SPOKEN}}`

Raw (e.g., 306-850-7687): _______________
Spoken (e.g., three-oh-six, eight-five-oh, seven-six-eight-seven): _______________

---

**Q4. Primary contact's email:**
> Maps to: `{{CONTACT_1_EMAIL}}`

Email: _______________

---

**Q5. Secondary contact's full name (leave blank if solo):**
> Maps to: `{{CONTACT_2_NAME}}`

Name: _______________

---

**Q6. Secondary contact's phone (raw + spoken):**
> Maps to: `{{CONTACT_2_PHONE_SPOKEN}}`

Raw: _______________
Spoken: _______________

---

**Q7. Secondary contact's email:**
> Maps to: `{{CONTACT_2_EMAIL}}`

Email: _______________

---

**Q8. Main callback number for voicemail (spoken format):**
> Usually same as Contact 1. This is what the voicemail script says.
> Maps to: `{{CALLBACK_PHONE_SPOKEN}}`

Spoken: _______________

---

## SECTION 2 — Company & Product

**Q9. Company or team name:**
> What leads will recognize. E.g., "Manzil Realty", "ABC Mortgage Group", "Sun Life Financial"
> Maps to: `{{COMPANY_NAME}}`

Company name: _______________

---

**Q10. Parent company or brokerage (if different from company name):**
> E.g., "eXp Realty", "Royal LePage", "Desjardins", "Edward Jones" — or leave blank
> Maps to: `{{BROKERAGE}}`

Brokerage: _______________ (or leave blank)

---

**Q11. Primary city and province/state:**
> Maps to: `{{CITY}}` + `{{PROVINCE}}`

City: _______________
Province/State: _______________

---

**Q12. Product or service name (how you say it conversationally):**
> Keep it natural for a phone conversation. E.g., "halal home financing", "renewable energy plans", "life insurance review"
> Maps to: `{{PRODUCT_NAME}}`

Product name: _______________

---

**Q13. Product website (for legitimacy questions — agent does NOT share this with leads):**
> Maps to: `{{PRODUCT_WEBSITE}}`

Website: _______________

---

**Q14. Where did leads originally sign up?**
> Used in opener: "You signed up on ___ about ___"
> E.g., "the Manzil website", "our website", "a Facebook ad last year"
> Maps to: `{{SIGNUP_SOURCE}}`

Signup source: _______________

---

**Q15. Current status / launch phrase:**
> Used in opener: "{{COMPANY_NAME}} is ___"
> E.g., "now fully live in Saskatchewan", "now accepting applications in Alberta", "officially launching in your area"
> Maps to: `{{PROVINCE_STATUS}}`

Status phrase: _______________

---

## SECTION 3 — Product Requirements

**Q16. Minimum requirement for this product (spoken):**
> What the lead must have/meet to qualify. E.g., "twenty percent down payment", "a valid driver's license", "at least eighteen years old"
> Maps to: `{{MIN_REQUIREMENT_NAME}}`

Minimum requirement: _______________

---

**Q17. Maximum offering (spoken) — leave blank if not applicable:**
> E.g., "one-point-five million", "up to two hundred thousand dollars"
> Maps to: `{{MAX_OFFERING}}`

Maximum: _______________ (or N/A)

---

**Q18. Business hours for calendar bookings:**
> E.g., "Monday to Saturday, ten AM to eight PM Saskatchewan time"
> Maps to: `{{BUSINESS_HOURS}}`

Business hours: _______________

---

**Q19. Any times to avoid when booking? (religious, lunch, etc.):**
> E.g., "Friday twelve to one-thirty PM" (Jumu'ah) — leave blank if none
> Maps to: `{{AVOID_TIME}}`

Avoid: _______________ (or N/A)

---

**Q20. Track record / social proof (one spoken sentence):**
> Used when leads ask "is this legit?" or "who are you?"
> E.g., "over one hundred million dollars in halal mortgages across Canada — licensed in five provinces"
> Maps to: `{{TRACK_RECORD}}`

Track record: _______________

---

**Q21. Form or URL the agent must NEVER mention aloud:**
> E.g., "forms.manzilrealty.ca" — the pre-approval form that should never be read aloud in conversation
> Maps to: `{{FORM_URL_NEVER_MENTION}}`

URL to never mention: _______________

---

**Q22. What should the agent say when a lead asks about the "already in process" / "already a customer" check?**
> The agent asks if the lead is already working with the team.
> Question to ask: E.g., "are you already in the Manzil approval process, or would this be your first time?"
> Maps to: `{{PROCESS_CHECK_QUESTION}}`

Process check question: _______________

---

**Q23. What should the agent say if the lead IS already a customer?**
> E.g., "you're ahead of the curve! I'll make sure [Contact 1] and [Contact 2] have the full picture. Is there anything you're waiting on from them?"
> Maps to: `{{PROCESS_ALREADY_IN_RESPONSE}}`

Already-in-process response: _______________

---

**Q24. What should the agent say if a lead doesn't meet the minimum requirement?**
> E.g., "{{COMPANY_NAME}} actually has savings accounts to help build toward it — not a blocker, just needs a plan"
> Maps to: `{{SHORT_ON_REQUIREMENT_RESPONSE}}`

Short-on-requirement response: _______________

---

**Q25. What phrase to use after confirming a booking?**
> For neutral campaigns: "you're all set" / "you're confirmed"
> For Muslim-community campaigns: "you're all set, inshallah"
> Maps to: `{{BOOKING_CLOSE_PHRASE}}`

Booking close phrase: _______________

---

## SECTION 4 — Event (Skip if no event)

**Q26. Is there an upcoming event the agent should invite leads to?**

YES / NO

**Q27. Event name:**
> E.g., "Manzil Halal Mortgage Information Session", "Free Solar Energy Workshop"
> Maps to: `{{EVENT_DESC}}`

Event name: _______________

---

**Q28. Event date (spoken):**
> E.g., "April 13th", "March 5th"
> Maps to: `{{EVENT_DATE_SPOKEN}}`

Event date: _______________

---

**Q29. Event day of week:**
> Maps to: `{{EVENT_DAY_OF_WEEK}}`

Day: _______________

---

**Q30. Event hours (spoken):**
> E.g., "five to nine PM", "six to eight PM"
> Maps to: `{{EVENT_TIME}}`

Event time: _______________

---

**Q31. Event location — short (for conversation):**
> E.g., "the IAS gymnasium in Saskatoon", "our downtown office"
> Maps to: `{{EVENT_LOCATION_SHORT}}`

Short location: _______________

---

**Q32. Event location — full address:**
> E.g., "IAS Gymnasium, 222 Copland Crescent, Saskatoon SK"
> Maps to: `{{EVENT_LOCATION_FULL}}`

Full address: _______________

---

## SECTION 5 — Cultural Context (Skip if Q0g = NO)

> Skip this entire section and remove all [OPTIONAL — CULTURAL] blocks from the prompt template if this campaign is not targeting a specific cultural community.

**Q33. What cultural or religious community does this campaign target?**
> E.g., "Muslim community in Saskatchewan", "South Asian immigrant families", "Hindi-speaking community"

Community: _______________

---

**Q34. Are there seasonal religious dates to be aware of?**
> E.g., Ramadan, Eid, Diwali, Navratri, etc.
> This affects the opening greeting and call strategy.

Seasonal dates: _______________
> Maps to: `{{RAMADAN_START_DATE}}`, `{{RAMADAN_END_DATE}}`, `{{EID_DATE}}`

---

**Q35. Are there specific languages the community uses that the team should know about?**
> The AI agent speaks English only, but the contacts can connect in other languages.
> E.g., "Contacts speak Urdu, Punjabi, and Arabic"

Languages contacts can use: _______________

---

## SECTION 6 — Verification Checklist

Before launching any campaign:

**Prompt setup:**
- [ ] All variables in Section 0-5 filled out (or confirmed N/A)
- [ ] All `{{VARIABLES}}` in PROMPT_TEMPLATE_ISA.md replaced — zero left behind
- [ ] PRODUCT KNOWLEDGE BASE section replaced with client-specific Q&A (8-12 entries)
- [ ] [OPTIONAL — CULTURAL] sections removed if Q0g = NO
- [ ] Prompt pasted into Google Sheets → System Prompt → A2

**Technical setup:**
- [ ] Google Sheets: `Leads` tab + `Call Log` tab + `System Prompt` tab (prompt in A2)
- [ ] Ultravox `maxDuration` set to `"600s"` or `"900s"` (NEVER leave as default 3600s = 1 hour)
- [ ] Ultravox `selectedTools` uses `{ toolName: "hangUp" }` — NOT `builtinTool` (doesn't exist)
- [ ] Calendar booking webhooks configured: `/webhook/[client]-check-availability` + `/webhook/[client]-book-appointment`
- [ ] Voice ID set in n8n workflow (Nour voice for Manzil: `d766b9e3-69df-4727-b62f-cd0b6772c2ad`)
- [ ] All n8n credentials authorized (Google Sheets, Gmail, Twilio, Ultravox)
- [ ] Error handler workflow wired

**Testing:**
- [ ] Test lead configured with your own phone number
- [ ] Test webhook fired: `POST https://[n8n-host]/webhook/[client]-isa-test-trigger`
- [ ] All fields collected correctly on test call
- [ ] Google Sheets row updated
- [ ] Telegram/Gmail notification received by client
- [ ] DNCL scrub completed before any real outbound campaign (Canada: lnnte-dncl.gc.ca)

---

## Quick Variable Mapping Reference

| Form Question | Variable in Template |
|---------------|---------------------|
| Q0b Required fields | `{{REQUIRED_FIELDS}}` |
| Q0c Primary goal sentence | `{{ISA_PRIMARY_GOAL}}` |
| Q1 Agent name | `{{AGENT_NAME}}` |
| Q2 Contact 1 name | `{{CONTACT_1_NAME}}` |
| Q3 Contact 1 phone (spoken) | `{{CONTACT_1_PHONE_SPOKEN}}` |
| Q4 Contact 1 email | `{{CONTACT_1_EMAIL}}` |
| Q5 Contact 2 name | `{{CONTACT_2_NAME}}` |
| Q6 Contact 2 phone (spoken) | `{{CONTACT_2_PHONE_SPOKEN}}` |
| Q7 Contact 2 email | `{{CONTACT_2_EMAIL}}` |
| Q8 Callback phone | `{{CALLBACK_PHONE_SPOKEN}}` |
| Q9 Company name | `{{COMPANY_NAME}}` |
| Q10 Brokerage | `{{BROKERAGE}}` |
| Q11 City + Province | `{{CITY}}` + `{{PROVINCE}}` |
| Q12 Product name | `{{PRODUCT_NAME}}` |
| Q13 Product website | `{{PRODUCT_WEBSITE}}` |
| Q14 Signup source | `{{SIGNUP_SOURCE}}` |
| Q15 Status phrase | `{{PROVINCE_STATUS}}` |
| Q16 Min requirement | `{{MIN_REQUIREMENT_NAME}}` |
| Q17 Max offering | `{{MAX_OFFERING}}` |
| Q18 Business hours | `{{BUSINESS_HOURS}}` |
| Q19 Avoid time | `{{AVOID_TIME}}` |
| Q20 Track record | `{{TRACK_RECORD}}` |
| Q21 URL to never mention | `{{FORM_URL_NEVER_MENTION}}` |
| Q22 Process check question | `{{PROCESS_CHECK_QUESTION}}` |
| Q23 Already-in-process response | `{{PROCESS_ALREADY_IN_RESPONSE}}` |
| Q24 Short-on-requirement response | `{{SHORT_ON_REQUIREMENT_RESPONSE}}` |
| Q25 Booking close phrase | `{{BOOKING_CLOSE_PHRASE}}` |
| Q27 Event name | `{{EVENT_DESC}}` |
| Q28 Event date | `{{EVENT_DATE_SPOKEN}}` |
| Q29 Event day | `{{EVENT_DAY_OF_WEEK}}` |
| Q30 Event time | `{{EVENT_TIME}}` |
| Q31 Event location short | `{{EVENT_LOCATION_SHORT}}` |
| Q32 Event location full | `{{EVENT_LOCATION_FULL}}` |
| Q34 Seasonal dates | `{{RAMADAN_START_DATE}}` + `{{RAMADAN_END_DATE}}` + `{{EID_DATE}}` |

---

## Completed Example — Manzil Realty ISA (Fatima)

| Question | Answer |
|----------|--------|
| Q0b Required fields | email address, purchasing timeline, purchase price range, and down payment percentage |
| Q0c Primary goal | Collect the lead's email, timeline, price range, and down payment so the team can qualify them |
| Q0g Cultural campaign? | YES — Muslim community in Saskatchewan |
| Q1 Agent name | Fatima |
| Q2 Contact 1 | Hasan Sharif |
| Q3 Contact 1 phone | three-oh-six, eight-five-oh, seven-six-eight-seven |
| Q4 Contact 1 email | hasan.sharif@exprealty.com |
| Q5 Contact 2 | Omar Sharif |
| Q6 Contact 2 phone | three-oh-six, seven-one-six, three-five-five-six |
| Q7 Contact 2 email | osharif@manzilrealty.com |
| Q9 Company | Manzil Realty |
| Q10 Brokerage | eXp Realty |
| Q11 City/Province | Saskatoon, Saskatchewan |
| Q12 Product | halal home financing |
| Q15 Status phrase | now fully live in Saskatchewan |
| Q16 Min requirement | twenty percent down payment |
| Q17 Max offering | one-point-five million |
| Q20 Track record | over one hundred million dollars in halal mortgages across Canada — licensed in five provinces |
| Q22 Process check Q | are you already in the Manzil approval process, or would this be your first time? |
| Q23 Already-in-process | you're ahead of the curve! I'll make sure Hasan and Omar have the full picture... |
| Q24 Short-on-requirement | Manzil actually has savings accounts to help build toward it — not a blocker, just needs a plan |
| Q25 Booking phrase | you're all set, inshallah |
| Q28 Event date | April 13th |
| Q34 Ramadan | February 18 → approximately March 20, Eid ~March 20 |

---

## Section 7 — Deployment Learnings

> Every new build adds learnings here. Apply all of these to every future outbound ISA deployment.

**L1. Goal Alignment BEFORE prompt writing (Call 1)**
If the client says "ISA" — ask: **data collection or booking?** The Manzil v4.2 build assumed booking, but the actual goal was data collection. This caused 3 wasted test calls. Section 0 now makes this the mandatory first step.

**L2. Ultravox tool schema: `toolName` not `builtinTool` (Call 2)**
The hangUp tool must use `{ toolName: "hangUp" }` in `selectedTools`. The field `builtinTool` does not exist in the Ultravox API and causes silent rejection of the entire call creation payload.

**L3. temporaryTool HTTP URLs must return 200**
If calendar tools (check_availability, book_appointment) are configured as temporaryTool, the n8n webhook must be active and return a valid response. A 405 from an inactive URL = agent freezes mid-call.

**L4. Explicit cultural injection is required (Calls 3-5)**
Injecting today's date is NOT enough for cultural greeting rules. The n8n workflow's Enhanced Call Setup Code node must inject an explicit "RAMADAN IS CURRENTLY ACTIVE" flag + community name list. Apply this pattern for any cultural greeting rule — date alone is insufficient.

**L5. "What do you need from me?" handler must cover early-call context (Call 4)**
When a lead asks this before any data collection, the model may fire closing language ("I'll pass your details") instead of beginning collection. The handler must explicitly show what to say at call START, not mid-call. Add as an inline example in the prompt.

**L6. COMPLETION CHECK gate before closing (Call 3)**
Without a hard gate, the model accepts any brush-off ("I gotta go") before completing data collection. The STATE 4 COMPLETION CHECK is the fix: check all {{REQUIRED_FIELDS}} before advancing.

**L7. FORBIDDEN ACTIONS in first 50 lines = highest model weight**
Rules buried after line 100 get ignored in turn 8+ of multi-turn calls (Llama 3.3 70B). The ABSOLUTE FORBIDDEN ACTIONS section must be in the first 50 lines of the prompt.

**L8. Gmail HTML field names must match the data source**
The Build Gmail HTML Code node must use the same field names as the Format Call Log node output. If Format Call Log uses spreadsheet column names (Name, Phone, Email), the Gmail builder must use `d['Name']`, `d['Phone']` — not camelCase versions. All-undefined email = wrong field names.

**L9. Inline few-shot examples > abstract rules for Llama 3.3 70B (Calls 4-5)**
8 concrete dialogue examples produced the single biggest improvement in live testing (0/4 fields → 4/4 fields). Always add 2-3 examples per critical behavior. Abstract rules like "collect all fields before closing" are consistently outperformed by specific dialogue patterns.

**[Add L10, L11... as new clients are built]**
