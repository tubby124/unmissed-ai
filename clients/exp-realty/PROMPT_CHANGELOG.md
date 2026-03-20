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
