# Prompt Changelog — exp-realty (Omar Sharif / Fatema)

## v4 — 2026-03-14
**Change:** AI disclosure in greeting, business identity Omar Sharif (not eXp Realty), grammar-breaking patterns, personal/family caller handling, inline examples, voicemail framing
**Chars:** 13,464 | **Hash:** 83144b7cae70451e
**Supabase version_id:** 3b3b5d89-b5c7-4b3a-8e4e-b9b59ce1ffdd
**Key additions:**
- Greeting: "Hey! This is Fatema, Omar's AI assistant..." (AI disclosed upfront)
- Role: "Omar's AI assistant — he doesn't do voicemail, so he has you instead"
- Business identity: "Omar Sharif" throughout (dropped eXp Realty)
- Added 11 FORBIDDEN rules (was 8), including Rule 11 (never apologize for being AI)
- Added GRAMMAR AND SPEECH PATTERNS section (gonna, kinda, sentence fragments)
- Added PERSONAL/FAMILY CALLER handling
- Added 9 INLINE EXAMPLES (A through I)
- Added single-word acknowledgment guard ("okay" alone is NOT goodbye)
- Added NON-ENGLISH CALLER handling
- Tightened spam handling (added "Google business profile" trigger)

## v5 — 2026-03-18 08:06 UTC
**Change:** Add GLM-4.6 anti-repetition CONVERSATION RULES block
**Chars:** 13866 | **Hash:** 51fee88b84074c3c
**Supabase version_id:** c2b96a08-2615-4962-9c64-d0b7c80198f7
**Ultravox revision:** 68baa51a-e800-4aa2-8001-41afb6464e16

## v6 — 2026-03-19 12:56 UTC
**Change:** v6: lean prompt framework — transfer enabled, Manzil halal mortgage knowledge, emergency override, returning caller handling
**Chars:** 7726 | **Hash:** 1219196b7017f810
**Supabase version_id:** b649eb6a-df9f-411d-b08d-102bd44f3e68
**Ultravox revision:** 80708678-aa7d-4ad9-8f57-c553621ef27e

## v7 — 2026-03-19 13:01 UTC
**Change:** strengthen MESSAGE FLOW close gate — add property type/situation to forbidden follow-ups
**Chars:** 7800 | **Hash:** 9194ec97623bf0aa
**Supabase version_id:** c5bd1279-4f06-487e-8152-41e93b584887
**Ultravox revision:** cbc22dfc-cdf3-4402-913c-c18d876369c2

## v8 — 2026-03-19 13:03 UTC
**Change:** v8: professional tone + Manzil referral clarification (not mortgage provider)
**Chars:** 7783 | **Hash:** 4f5a8a882826599a
**Supabase version_id:** e25c5eb1-c84f-4227-b549-362f1f44b263
**Ultravox revision:** c4522ada-54e8-46ba-8803-dc689c9b4fe4

## v9 — 2026-03-19 22:14 UTC
**Change:** enable calendar booking tools (booking_enabled=true)
**Chars:** 7783 | **Hash:** 4f5a8a882826599a
**Supabase version_id:** 8fbc578c-b6f0-4b64-98a8-070ddd6183b0
**Ultravox revision:** 9c8cb4bb-7c3a-4fd9-89e5-2f348ecc2e1c

## v10 — 2026-03-19 22:42 UTC
**Change:** add CALENDAR BOOKING FLOW block (booking_enabled=true)
**Chars:** 7783 | **Hash:** 4f5a8a882826599a
**Supabase version_id:** c6dfb04e-e5c2-4a10-8da7-1aee4c1168b3
**Ultravox revision:** 0db3f2ae-ceb6-4a9a-b7ac-f137a1d2678a

## v11 — 2026-03-19 22:43 UTC
**Change:** add CALENDAR BOOKING FLOW block (booking_enabled=true)
**Chars:** 9221 | **Hash:** e040c7a93304cbad
**Supabase version_id:** 713f131c-4764-4a2f-a7f7-02065ceaca46
**Ultravox revision:** f0804a7d-e9a9-46a3-8b67-134418d4bbcb

## v12 — 2026-03-20 06:37 UTC
**Change:** Wave 1: TOOL FAILURES section
**Chars:** 9501 | **Hash:** 63dc89c0b68786e6
**Supabase version_id:** 94e7ac46-6726-4049-b29c-70c3105c338a
**Ultravox revision:** 1aa76beb-84a7-4869-8f00-2b062da9b71a

## v13 — 2026-03-20 07:23 UTC
**Change:** Pattern A: _instruction tool response guidance line
**Chars:** 9606 | **Hash:** 68be815bf1122975
**Supabase version_id:** eddf9ee8-4526-486b-bf91-0f98201ee042
**Ultravox revision:** f4c70588-a186-4054-a327-6824343330db

## v14 — 2026-03-20 13:58 UTC
**Change:** pgvector queryKnowledge tool injection — 18 knowledge chunks seeded
**Chars:** 9606 | **Hash:** 68be815bf1122975
**Supabase version_id:** 9f098488-5d28-432c-90ac-336e92a51cfb
**Ultravox revision:** 21dac5bb-dac3-409b-93d3-659d20997fd9

## v15 — 2026-03-20 16:53 UTC
**Change:** tool resync: hangUp as temporaryTool with AGENT_REACTION_LISTENS (fixes greeting loop)
**Chars:** 9606 | **Hash:** 68be815bf1122975
**Supabase version_id:** 0ab94116-2347-4979-9ef9-6b72c75413a1
**Ultravox revision:** b0362211-fd8d-4849-ba04-3b87a77e54b4

## v16 — 2026-03-21 15:34 UTC
**Change:** S1b: tool-builder unification + VAD 0.3s sync
**Chars:** 9606 | **Hash:** 68be815bf1122975
**Supabase version_id:** 43cf1b67-c368-4f2c-9cbc-86859d476e5f
**Ultravox revision:** 431dec64-0589-4e38-979d-906d283536fb

## v17 — 2026-03-21 15:41 UTC
**Change:** S1b fix: coaching KNOWN_PARAM_CALL_ID + template placeholders
**Chars:** 9972 | **Hash:** 68be815bf1122975
**Supabase version_id:** efdeb1df-5776-4038-93ca-f806dc63647e
**Ultravox revision:** 910dbbc1-a694-4447-8de3-5660f8cb1dae

## v18 — 2026-03-22 15:09 UTC
**Change:** S16e: prompt injection defense rules
**Chars:** 10439 | **Hash:** 8b9551ffc193e4ae
**Supabase version_id:** 92a08fc5-5fdb-443f-bde0-03274839308f
**Ultravox revision:** c2869be8-054a-4ffa-9bb6-42340f469e82

## v19 — 2026-03-23 16:29 UTC
**Change:** Voicemail-style opening: go-ahead cue + leave your name and number framing to reduce early hangups from voicemail-trained callers
**Chars:** 10530 | **Hash:** 18700d34727aba55
**Supabase version_id:** 92dd92d8-42e9-47fd-8fe6-950873670e2d
**Ultravox revision:** da3edeb6-9631-4435-a9b3-a78c7db32af5

## v20 — 2026-03-31 02:08 UTC
**Change:** re-sync Ultravox drift + wow-first
**Chars:** 10994 | **Hash:** e8a3f5036710795e
**Supabase version_id:** dec6f7c9-b32f-4c3f-a95e-5a7b927df7e8
**Ultravox revision:** 272b0eeb-3844-484b-84e5-dff33d16d84d

## v21 — 2026-03-31 04:11 UTC
**Change:** Sync deploy
**Chars:** 10994 | **Hash:** e8a3f5036710795e
**Supabase version_id:** dcb978af-7e24-4b11-b944-a47dd9cd90c1
**Ultravox revision:** f5a18c88-84b3-49eb-9c43-f1be0099b2d0
