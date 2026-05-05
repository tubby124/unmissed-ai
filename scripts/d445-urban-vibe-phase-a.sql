-- D445 Phase A — Urban Vibe data hygiene SQL
--
-- Ray's locked decisions (2026-04-30 PM):
--   1. Pro plan, concierge state — DO NOT touch subscription_status / selected_plan
--   2. SMS auto-followup YES — sms_enabled stays true (already true)
--   3. Transfer callback-only NOW — forwarding_number stays null (already null)
--   4. KEEP Ray's old greeting via GREETING_OVERRIDE
--   5. KEEP VIP_PROTOCOL slot (auto-renders from sms_enabled=true)
--
-- Apply via Supabase Management API or psql against project qwhvblomlgeapzhnuwlb.
-- DO NOT run in the Supabase web UI — leaves no audit trail.
-- DO NOT apply until PR #69 is on main (already done as of 2026-05-05) AND
-- system smoke gate has cleared per d445-snowflake-migration-playbook.md.
--
-- After applying these 4 statements, run scripts/deploy-urban-vibe.ts to
-- execute the live Phase D recompose. SQL alone does NOT touch the deployed
-- prompt — it only updates the source data that Phase D reads.

-- A.1 — Switch voice preset (eliminates 2 of 3 "gotcha" leak sites)
UPDATE clients
SET voice_style_preset = 'professional_warm'
WHERE slug = 'urban-vibe';

-- A.2 — niche_custom_variables: Ray's name + bans + Atco rules + GREETING_OVERRIDE (Ray's old greeting)
-- GREETING_OVERRIDE plumbing landed in PR #69 (D445 Phase B.0).
UPDATE clients
SET niche_custom_variables = '{
  "CLOSE_PERSON": "Ray",
  "FORBIDDEN_EXTRA": "NEVER use the word \"gotcha\" — use \"got it\" or \"sure\" instead. NEVER call yourself an \"AI assistant\" — say \"virtual assistant\" instead. For gas smell or carbon monoxide alarm: tell them to call Atco Emergency or 9-1-1 and get out of the unit, then take their name and unit for Ray to follow up.",
  "GREETING_OVERRIDE": "Thanks for calling Urban Vibe Properties — I''m Alisha, Ray''s virtual assistant. I can log maintenance requests, get Ray to call you back, or help with rental inquiries. What''s going on?"
}'::jsonb
WHERE slug = 'urban-vibe';

-- A.3 — business_facts: Calgary/Atco/Ray identity (per-call template injection)
-- NOTE: clients.business_facts is text[] (each entry becomes its own KB chunk via
-- reseedKnowledgeFromSettings() when knowledge_backend='pgvector').
UPDATE clients
SET business_facts = ARRAY[
  'Urban Vibe Properties is a Calgary, Alberta property management company.',
  'The property manager is Ray Kassam.',
  'For natural-gas leaks or CO alarms: callers should phone Atco Emergency or 9-1-1 immediately and evacuate. Atco is the Alberta natural gas utility — Calgary tenants know the brand.',
  'Property type: residential rentals only (no commercial). Service area: Calgary AB.'
]::text[]
WHERE slug = 'urban-vibe';

-- A.4 — Reformat hours to belt-and-suspenders the regex fix from B.0.1
UPDATE clients
SET
  business_hours_weekday = 'Monday to Friday, 8:30 AM to 5:00 PM',
  business_hours_weekend = 'Saturday and Sunday, 10:00 AM to 4:00 PM'
WHERE slug = 'urban-vibe';

-- A.5 — DO NOT TOUCH: subscription_status, selected_plan stay as-is per Ray decision #1.
-- Concierge state preserved.

-- Verification queries (run after the 4 UPDATEs above):
--
--   SELECT slug, voice_style_preset,
--          niche_custom_variables->>'GREETING_OVERRIDE' AS greeting_override,
--          niche_custom_variables->>'CLOSE_PERSON' AS close_person,
--          length(business_facts) AS business_facts_chars,
--          business_hours_weekday, business_hours_weekend,
--          subscription_status, selected_plan
--   FROM clients
--   WHERE slug = 'urban-vibe';
