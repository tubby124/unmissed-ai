# Overview + Calls & Leads — Descriptive Surface Map

> Date: 2026-06-01
> Scope: `/dashboard` (non-admin client home → ClientHomeV2 → UnifiedHomeSectionV2) and `/dashboard/calls`.
> Status: read-only descriptive map. No keep/remove/score recommendations.
> Anchors: `docs/architecture/control-plane-mutation-contract.md` Section 2 (mutation classes), Section 3 (flow diagram); `src/lib/settings-schema.ts` FIELD_REGISTRY; `src/app/api/dashboard/settings/route.ts`; `CALLINGAGENTS/00-Inbox/overview-drift-audit-2026-04-30.md` (D442 Phase 1).

---

## Overview tab — surfaces

### 1. LiveCallBanner (active calls strip)
- **File:** `src/components/dashboard/LiveCallBanner.tsx`
- **Section of page:** Topmost element of ClientHomeV2 (above the tab segmented control). Only renders when `liveCalls.length > 0`.
- **What you see:** Green throbbing dot + "Active Call" / "N Active Calls" header. For each live call: dark-green gradient card with business name (admin only), `formatPhone(caller_phone)`, live HH:MM:SS duration timer (LiveDuration), animated waveform bars, and a "Transferring to owner…" inline pill when `transfer_status==='transferring'`. Three action buttons on the right: red "End", blue "Take this call" (hidden during in-flight transfer), green "Just listen".
- **What you can do:** "End" → `fetch('/api/dashboard/calls/{ultravox_call_id}/whisper', { method: 'DELETE' })`. "Take this call" → `fetch('/api/dashboard/calls/{ultravox_call_id}/transfer-now', { method: 'POST' })` (sets `transfer_status='transferring'` via realtime). "Just listen" → `Link` to `/dashboard/calls/{ultravox_call_id}`.
- **Columns it reads from `call_logs`:** `id`, `ultravox_call_id`, `caller_phone`, `started_at`, `transfer_status`. (Source: ClientHomeV2 realtime subscription scoped to `client_id=eq.${clientId}` plus initial fetch in `/api/dashboard/home`.)
- **Columns it writes:** none directly. Transfer/whisper routes mutate `call_logs.transfer_status` server-side.
- **API endpoints used:** `DELETE /api/dashboard/calls/[id]/whisper`, `POST /api/dashboard/calls/[id]/transfer-now`. Realtime: `postgres_changes` on `call_logs`.
- **Sync side-effect on save:** N/A (per-call runtime; no clients-table mutation).
- **Where else this column appears (cross-surface trace):** `LiveCallBanner` is also embedded inside `src/components/dashboard/CallsList.tsx` (calls page) and the admin Command Center (`src/app/dashboard/page.tsx`). The same component instance is reused on Overview, Calls page, and Admin dashboard.
- **Plan gates:** none.
- **Visible-to:** both (admin + non-admin).
- **Conditional rendering:** only when there are rows in `call_logs` with `call_status='live'` for the current client.
- **Known issues:** D378 (End button wiring) is marked DONE 2026-04-15. No open D-items.

### 2. Upgrade success banner
- **File:** `src/components/dashboard/ClientHomeV2.tsx` (inline block, lines ~386–402).
- **Section of page:** Between LiveCallBanner and TrialWelcomeBanner.
- **What you see:** Green-tinted card with checkmark icon, copy "You're upgraded — welcome to the team", subline pushing to Go Live, "Open Go Live →" link.
- **What you can do:** "Open Go Live →" → `<a href="/dashboard/go-live">`.
- **Columns read/written:** none — reads URL `?upgraded=true`.
- **Sync side-effect on save:** N/A.
- **Where else this column appears:** N/A (URL param only).
- **Visible-to:** non-admin.
- **Conditional rendering:** `searchParams.get('upgraded') === 'true'`.

### 3. TrialWelcomeBanner
- **File:** `src/components/dashboard/home/TrialWelcomeBanner.tsx`
- **Section of page:** Above the tab control, dismissable.
- **What you see:** Phone icon + agent-name heading ("{agentName} is ready to test" / "is being set up" / "Your agent is being provisioned" depending on `provisioningState`). Days-left pill (amber "N days left" or red "Last day"). X dismiss button.
- **What you can do:** Dismiss → writes `localStorage['trial_welcome_dismissed']='true'` and `trackEvent('trial_welcome_banner_dismissed')`. No actionable CTAs.
- **Columns it reads from `clients` (via /api/dashboard/home):** `agent_name`, `subscription_status`, `trial_expires_at`, derived `trialWelcome.provisioningState` (from `twilio_number`, `ultravox_agent_id` presence — see `lib/build-trial-welcome-view-model.ts`).
- **Columns it writes:** none.
- **Sync side-effect on save:** N/A.
- **Where else this column appears:** `agent_name` is rendered by 16+ files (see Appendix). `subscription_status` is consumed by AgentIdentityCardCompact (trial caption), plan card footer, billing page, capability flags.
- **Visible-to:** non-admin only.
- **Conditional rendering:** `isTrialActive && !welcomeDismissed`. `isTrialActive = trialPhase !== 'expired' && trialPhase !== 'paid_or_non_trial'`.

### 4. Tab segmented control (Overview / Activity)
- **File:** `src/components/dashboard/ClientHomeV2.tsx` (inline lines ~416–445).
- **Section of page:** Above the active-tab body.
- **What you see:** Pill bar with two tabs — "Overview" (default) and "Activity". Selected tab has surface background + shadow.
- **What you can do:** Click "Overview" → URL `?` (clears tab + section). Click "Activity" → `?tab=activity`.
- **Columns read/written:** none — URL state only via `parseDashboardTab`.
- **Visible-to:** non-admin only.

### 5. TrialExpiredSection
- **File:** `src/components/dashboard/home/TrialExpiredSection.tsx` (out of detailed scope, but rendered conditionally here).
- **Section of page:** Overview tab body, when `homePhase==='trial_expired'`.
- **What you can do:** "Upgrade" → `openUpgradeModal('trial_expired_hero', clientId)`.
- **Columns it reads:** `subscription_status`, `trial_expires_at` (derived via `deriveTrialPhase`).
- **Visible-to:** non-admin, expired trial only.
- **Conditional rendering:** `homePhase==='trial_expired'`.

### 6. AgentIdentityCardCompact (top hero — avatar + 10 chips)
- **File:** `src/components/dashboard/home/AgentIdentityCardCompact.tsx`
- **Section of page:** Top of UnifiedHomeSectionV2, full-width card. Optional "● Synced" timestamp strip above it.
- **What you see:** Two-column card. Left: circular violet avatar showing first letter of `agentName` (edit pencil overlay on hover), title `{agentName} · {businessName}`, subtitle showing a violet voice pill (`{voiceName} voice` resolved by GET `/api/dashboard/voices`), middot, mono-font Twilio number formatted as +1 (XXX) XXX-XXXX, then "change" link in primary color. Right column: 10 rounded full-width chips in a 2-col mobile / 3-col tablet / 4-col desktop grid — Greeting, SMS, Telegram, IVR, Voicemail, Booking, Transfer, Website, Google profile, "Today: {first 22 chars of injected_note}…" / "Today: empty". Each chip has a 1.5px dot (green if `on`, white-18% if off). Above the chip grid, a 10pt caption appears when `(isTrial || !hasForwarding) && twilioNumber` — trial-clarity copy explaining the number is a preview.
- **What you can do:** Click avatar → `openModal('identity')`. Click title line → `openModal('identity')`. Click voice/phone subline → `openModal('voice')`. Each chip → `openModal(chip.modal)`: Greeting → `greeting`, SMS → `aftercall`, Telegram → `telegram`, IVR → `ivr`, Voicemail → `voicemail`, Booking → `calendar`, Transfer → `transfer`, Website → `knowledge`, Google profile → `gbp`, Today → `today`.
- **Columns it reads from `clients` (via /api/dashboard/home):** `agent_name`, `business_name`, `agent_voice_id`, `voice_style_preset`, `twilio_number`, `sms_enabled`, `telegram_chat_id` + `telegram_bot_token` (folded into `onboarding.telegramConnected`), `ivr_enabled`, `voicemail_greeting_text`, `booking_enabled` + `calendar_auth_status` (folded into `capabilities.hasBooking`), `forwarding_number` (capabilities.hasTransfer), `website_url` + `website_scrape_status` (capabilities.hasWebsite), `gbp_place_id` (gbpData.placeId), `injected_note`, `last_agent_sync_at`/`last_agent_sync_status` (syncedLabel).
- **Columns it writes:** none directly — every chip delegates to a modal in InlineModalsV2.
- **API endpoints used:** GET `/api/dashboard/voices` (to resolve voiceId → name).
- **Sync side-effect on save:** None on the card itself. Each chip's modal triggers its own PATCH (see modal entries below).
- **Where else this column appears (cross-surface trace):**
  - `agent_name`: 16+ surfaces — `AgentTab.tsx`, `AgentOverviewCard.tsx`, `PromptEditorCard.tsx`, `home/sheets/IdentitySheet.tsx`, `go-live/GreetingFields.tsx`, `app/dashboard/welcome/page.tsx`, `app/dashboard/agent/AgentPageView.tsx`, `app/dashboard/billing/page.tsx`, `app/dashboard/lab/page.tsx`, `app/dashboard/knowledge/KnowledgePageView.tsx`, `app/dashboard/actions/ActionsPageView.tsx`, `app/dashboard/settings/SettingsView.tsx`, plus AgentKnowsCard summary line.
  - `business_name`: 40+ surfaces — header, CallRow, ClientHealthBar, ClientSelector, every Calls-related component, Live banner, IntakeTable, AdminDropdown, ScopedClientLabel, settings, billing, etc.
  - `agent_voice_id`: AgentIdentityCardCompact, InlineModalsV2 VoiceModal, `home/AgentIdentityCard.tsx` (v1), `home/UnifiedHomeSection.tsx` (v1), `settings/VoicePicker.tsx`, `settings/VoiceTab.tsx`, `settings/AgentConfigCard.tsx`, `go-live/GoLiveVoicePicker.tsx`, `go-live/VoicePickerCompact.tsx`, `app/dashboard/voices/page.tsx`, `app/dashboard/agent/AgentPageView.tsx`, ClientHomeV2.
  - `injected_note`: AgentIdentityCardCompact chip, InlineModalsV2 TodayModal, `home/AgentIdentityCard.tsx` (v1), `settings/AgentTab.tsx`, `settings/QuickInject.tsx`.
  - `forwarding_number`: AgentIdentityCardCompact (hasForwarding gate), ForwardingModal, `home/QuickConfigStrip.tsx`, `home/sheets/ForwardingSheet.tsx`, `settings/AgentTab.tsx`, `settings/AgentOverviewCard.tsx`, `settings/PromptEditorCard.tsx`, `settings/SetupCard.tsx`, `settings/SetupProgressRing.tsx`, `AgentConfigCard.tsx`, `ActionItems.tsx`, `actions/TransferSettingsSection.tsx`.
  - `sms_enabled`: see Appendix; ~20 files including all the SMS-touching cards plus the QuickConfigStrip and Notifications surfaces.
  - `voicemail_greeting_text`: AgentIdentityCardCompact chip, VoicemailModal, `home/IvrVoicemailTile.tsx`, `home/QuickConfigStrip.tsx`, `settings/AgentTab.tsx`, `settings/VoicemailGreetingCard.tsx`, `AgentConfigCard.tsx`, `go-live/GreetingFields.tsx`, `go-live/NotificationsBlock.tsx`.
  - `ivr_enabled`: AgentIdentityCardCompact, IvrModal, `home/IvrVoicemailTile.tsx`, `home/QuickConfigStrip.tsx`, `settings/AgentTab.tsx`, `settings/IvrMenuCard.tsx`, `AgentConfigCard.tsx`.
- **Plan gates:** None on the card itself. Individual modals apply `planSupportsBooking`/`planSupportsTransfer` (see modal entries).
- **Visible-to:** non-admin (and admin in scoped-preview mode). Whole block gated by `data.clientId && onboarding.hasAgent`.
- **Conditional rendering:** rendered when client has an Ultravox agent provisioned.
- **Known issues from architecture docs:** **D442 / D443 fake-control on Greeting chip** — `PROMPT_VARIABLE_REGISTRY[GREETING_LINE].editable=false`, but the chip shows an Edit affordance and PATCH does not enforce `editable`. On the 4 legacy-monolithic clients (`hasan-sharif`, `exp-realty`, `urban-vibe`, `windshield-hub`), saving via GreetingModal hits `regenerateSlots()` which returns `success:false, warning:'Old-format prompt without section markers — use patchers instead of regeneration'`; DB row updates `niche_custom_variables.GREETING_LINE`, but the live `system_prompt` never changes. UI toast says "Greeting saved." This is the canonical fake-control class. **D278 / D290** — this whole card is the post-D286 evolution of the AgentSpeaksCard merge.

### 7. Inline toast strip (trial expiry / minutes warning / sync error)
- **File:** `src/components/dashboard/home/UnifiedHomeSectionV2.tsx` (inline IIFE at lines 100–178).
- **Section of page:** Right below AgentIdentityCardCompact.
- **What you see:** Wraps to multiple slim pills. Each pill: 12px triangle/exclamation icon + text + tinted CTA. Trial-expiry pill: red, "Trial expires in Nd" / "Trial expires today" + "Upgrade" button. Minutes-warning pill: amber at 75%+, red at 90%+, "X% minutes used" + "Buy more" button. Sync-error pill: red, "Agent sync failed" + "Fix" link to `/dashboard/settings?tab=general`, with an X to dismiss.
- **What you can do:** Trial-expiry "Upgrade" → `openUpgradeModal('trial_expiry_banner', clientId, daysRemaining, selectedPlan)`. Minutes "Buy more" → `openUpgradeModal('minutes_warning_banner', clientId, undefined, selectedPlan)`. Sync-error "Fix" → href `/dashboard/settings?tab=general`. Sync-error dismiss → local state `setSyncDismissed(true)`.
- **Columns it reads from `clients`:** `subscription_status` + `trial_expires_at` (via deriveTrialPhase), `seconds_used_this_month` + `monthly_minute_limit` + `bonus_minutes` (via usage), `last_agent_sync_status`.
- **Columns it writes:** none.
- **Sync side-effect on save:** N/A.
- **Where else this column appears:** `last_agent_sync_at`/`last_agent_sync_status` also drives `AgentSyncBadge` (bottom of overview), syncedLabel pill on AgentIdentityCardCompact, syncedHint on every InlineModalsV2 modal footer.
- **Visible-to:** non-admin.
- **Conditional rendering:** trial pill when `isTrial && daysRemaining <= 3`; minutes pill when `!isTrial && totalAvailable > 0 && pct >= 75`; sync pill when `!syncDismissed && last_agent_sync_status==='error'`.

### 8. Weekly ROI inline strip
- **File:** UnifiedHomeSectionV2.tsx inline block, lines ~184–201.
- **Section of page:** Layer 2 of overview, between toast strip and ActivationTile.
- **What you see:** Indigo-tinted slim pill row: "THIS WEEK · N calls · {hotLeadsCaptured} HOT (linked) · ~{hoursSaved}h saved · Month: M calls".
- **What you can do:** "HOT" → `Link href="/dashboard/calls?status=HOT"`.
- **Columns it reads:** `weeklyStats.callsAnswered` / `hotLeadsCaptured` / `hoursSaved` / `monthCallsAnswered` (computed in `/api/dashboard/home` from `call_logs` aggregations over weekStart/monthStart).
- **Sync side-effect on save:** N/A.
- **Visible-to:** non-admin.
- **Conditional rendering:** `weeklyStats && weeklyStats.callsAnswered > 0`.

### 9. ActivationTile (paid-awaiting only)
- **File:** `src/components/dashboard/home/ActivationTile.tsx`
- **Section of page:** Layer 3, only when `isPaidAwaiting`.
- **What you see:** Amber-bordered card with warning icon, headline "Activation required", three numbered steps: 1) Phone number (green check / amber "1"), 2) Forwarding number, 3) Live on calls. "Refresh status" link beside step 1 when phone not ready. "Set now →" link beside step 2 when phone ready but forwarding missing. Bottom: "Complete setup →" button to `/dashboard/go-live` when `state==='awaiting_number'`.
- **What you can do:** Refresh status → `onRefreshClick` = the parent's `fetchData` (re-GETs `/api/dashboard/home`). "Set now →" → `inlineEdit.openModal('transfer')` (Forwarding modal). "Complete setup" → href `/dashboard/go-live`.
- **Columns it reads from `clients`:** `twilio_number` (`activation.twilio_number_present`), `forwarding_number` (`state==='ready'`), `setup_complete`. Derived via `deriveActivationState()` in `/api/dashboard/home`.
- **Columns it writes:** none directly (forwarding modal handles writes).
- **Sync side-effect on save:** N/A on the tile.
- **Where else this column appears:** `twilio_number` — AgentIdentityCardCompact (phone display), V2CallList empty state, settings God Mode, every call surface. `forwarding_number` — see chip 6 above.
- **Visible-to:** non-admin.
- **Conditional rendering:** `isPaidAwaiting && data.activation`. `isPaidAwaiting = homePhase === 'paid_awaiting'`.

### 10. "Forward your existing number" slim link
- **File:** UnifiedHomeSectionV2.tsx inline block, lines ~221–233.
- **Section of page:** Layer 3, between ActivationTile and Hero grid.
- **What you see:** Indigo-tinted thin link card: "Forward your existing number to your agent" + "Open Go Live →".
- **What you can do:** Whole card is a `Link` to `/dashboard/go-live`.
- **Columns it reads:** `twilio_number` (must exist), `stats.totalCalls` (must be 0).
- **Visible-to:** non-admin, paid only.
- **Conditional rendering:** `!isTrial && !!twilioNumber && stats.totalCalls === 0`.

### 11. TestCallCard (the orb)
- **File:** `src/components/dashboard/settings/TestCallCard.tsx` (rendered with `compact` prop).
- **Section of page:** TIER 1 hero, left half of the 2-col `md:grid-cols-2` block.
- **What you see (compact mode):** Centered card with title "Talk to your agent", subline "Test the live prompt right now", then `AgentVoiceTest` rendered with `idleVariant='button'` (so it shows a "Start test call" button rather than the full orb). When the call connects, AgentVoiceTest mounts the WebRTC orb UI.
- **What you can do:** "Start test call" → `AgentVoiceTest` opens a WebRTC session via `POST /api/dashboard/agent-test` (using `callViaAgent` → Agents API path; medium=WebRTC) per `per-call-context-contract.md` §1.7. After hang-up, the parent's `onCallEnded` = `fetchData` reruns the overview query. Internally the orb writes `call_logs` rows with `call_status='test'`.
- **Columns it reads from `clients`:** `ultravox_agent_id`, `agent_voice_id`, `system_prompt`, `tools` (used as `overrideTools`), niche, business_facts, extra_qa, context_data, hours/after-hours fields (all assembled by `buildAgentContext()` at the agent-test route).
- **Columns it writes:** none on the client row. Writes a `call_logs` row with `call_status='test'`, `caller_phone='webrtc-test'`.
- **API endpoints used:** `POST /api/dashboard/agent-test`. GET `/api/dashboard/voices/[id]/preview` for voice previews inside the VoiceModal (separate flow).
- **Sync side-effect on save:** N/A.
- **Where else this card appears:** also rendered on the Knowledge page (D309) as the central orb, on the Calls & Leads page (per refactor-phase-tracker.md 2026-04-01 entry), on the Settings non-admin overview section, and on the Go Live tab Section 5 (with `size='xl'`).
- **Plan gates:** Trial agents capped at 180s maxDuration (`createAgent` `maxDuration: '180s'` for `subscription_status='trialing'`).
- **Visible-to:** non-admin and admin.
- **Conditional rendering:** rendered when `onboarding.hasAgent && data.clientId`.

### 12. V2CallList (Recent calls)
- **File:** `src/components/dashboard/home/V2CallList.tsx`
- **Section of page:** TIER 1 hero, right half of the 2-col grid.
- **What you see:** Rounded card with "RECENT CALLS" header (uppercase, 11pt) and "View all →" link. Body: up to 5 rows. Each row: status badge pill (Live green / HOT red / WARM amber / COLD blue / JUNK zinc / MISSED red / Test indigo / Processing yellow / Voicemail purple), then `formatPhone(caller_phone) — {ai_summary[0..60]}…` (or "Browser test call" for test), right-aligned `timeAgo(started_at)`. Loading spinner when initial fetch hasn't returned. Empty state: "No calls yet — share your number to start receiving them" + a "Copy +1 (xxx) xxx-xxxx" button when `hasTwilioNumber`.
- **What you can do:** Click row → `onRowClick(snapshot)` which calls `inlineEdit.openModal('call', snapshot)` → InlineModalsV2 CallDetailModal opens. "View all →" → `Link` to `/dashboard/calls`. Empty-state "Copy" → `navigator.clipboard.writeText(twilioNumber)`.
- **Columns it reads from `call_logs` (via `useCallLog` hook):** `id`, `ultravox_call_id`, `caller_phone`, `call_status`, `duration_seconds`, `started_at`, `ai_summary`, `sentiment`.
- **Columns it writes:** none.
- **API endpoints used:** internal `useCallLog` hook subscribes to Supabase realtime on `call_logs` (filter `client_id=eq.${clientId}`).
- **Sync side-effect on save:** N/A.
- **Where else this surface appears:** `useCallLog` hook is the shared call-log primitive (D266 — "Recent calls parity, Overview vs Calls page use same component/query"). `CallRow` (calls page) is the heavier sibling. CallDetailModal in InlineModalsV2 is the modal version. `LiveCallBanner` reads the same table for live status.
- **Plan gates:** none.
- **Visible-to:** non-admin.
- **Conditional rendering:** inside the hero grid that renders only when `onboarding.hasAgent && data.clientId`.

### 13. AgentKnowsCard (What your agent knows)
- **File:** `src/components/dashboard/home/AgentKnowsCard.tsx`
- **Section of page:** Below the TIER 1 hero grid, full-width.
- **What you see:** Heavily populated card. Header: cube icon + "WHAT YOUR AGENT KNOWS" + "View knowledge →" link. Six count-pills in a 2-col mobile / 6-col desktop grid: Google (1/0), Facts (count of `\n`-split factsText), FAQ (`faqCount`), Services (`servicesCount`), Hours (1/0), KB (`approvedChunkCount` + "chunk(s)" unit). Three info rectangles below: "Business identity — {agentName} answers as {businessName}" + Edit link; "Searchable sources — {websiteChunks} website · {docChunks} docs · {manualChunks} manual" + Review link; "Answer boundary" with policy copy and optional `Hours: {hoursSummary}`. Optional "Google Business Profile" block when `googleProfileSummary`. Optional "⚠ Gaps (N)" inline-collapsible section showing 5 unanswered queries with `×count` prefix and "Review N more →" link. Empty state (binary switch): cube icon + "Add your Google Business Profile, website, hours, or business facts so your agent can answer questions" + "Connect website →".
- **What you can do:** "View knowledge →" / pills → various `/dashboard/knowledge…` deep links (and `/dashboard/settings?tab=services` for the Services pill, `/dashboard/settings?tab=general` for Hours). "Edit business info →" → `/dashboard/agent`. "Review answers →" → `/dashboard/knowledge`. Gaps toggle button → expands inline list. "Review N more →" → `/dashboard/knowledge#gaps`.
- **Columns it reads from `clients`:** `business_facts` (factCount), `extra_qa` (faqCount via parent), `gbp_place_id` + `gbp_summary` (hasGoogleProfile, googleProfileSummary), `business_hours_weekday` (hasHours/hoursSummary), `agent_name`, `business_name`. From `knowledge_chunks` (via API): `approved_chunk_count`, `pending_review_count`, `source_counts` (split into website_scrape, knowledge_doc, manual+compiled+call_snippet). From `client_services` table: `activeServicesCount`.
- **Columns it writes:** none.
- **API endpoints used:** GET `/api/dashboard/knowledge/gaps?days=30` (for the Gaps section).
- **Sync side-effect on save:** N/A.
- **Where else this column appears:** `business_facts` — see Appendix; ~17 surfaces (settings cards, knowledge sheet, AdvancedContextCard, etc.). `extra_qa` — ~22 surfaces. `gbp_place_id` — InlineModalsV2 GbpModal, AgentIdentityCardCompact chip, knowledge page. `business_hours_weekday` — InlineModalsV2 HoursModal, settings HoursCard, GoLiveView HoursFields, go-live/HoursSheet, AgentConfigCard, ~12 files.
- **Plan gates:** none on this card.
- **Visible-to:** non-admin.
- **Conditional rendering:** rendered when hero grid renders (`onboarding.hasAgent && data.clientId`).
- **Known issues:** D290 (DONE 2026-04-24) consolidated three legacy tiles into this card.

### 14. Agent readiness band (6-row checklist)
- **File:** UnifiedHomeSectionV2.tsx inline IIFE, lines ~288–408.
- **Section of page:** Below AgentKnowsCard.
- **What you see:** "AGENT READINESS — N of 6 ready" header on left, % on right. Indigo→amber→green progress bar (indigo <50%, amber 50–80%, green ≥80%). Two-column grid (collapses to 1-col mobile) of 6 rows: Hours, Services, FAQs, Booking, Knowledge, "{N} unanswered questions this week" / "No unanswered questions". Each row: emoji prefix (`✅` done, `⚠️` urgent, `⚪` empty), label, meta (e.g., "12 active", "— add your hours", "Calendar connected", "3 pages pending review"), and a right-aligned "view →" (done) or "fix →" (todo) link in primary color.
- **What you can do:** Click each row → `inlineEdit.openModal(modalId)` where modalIds are: `hours`, `services`, `faqs`, `calendar`, `knowledge`, `gaps`.
- **Columns it reads:** `business_hours_weekday`, `activeServicesCount`, `extra_qa` (faqCount), `calendar_auth_status` (`calendarConnected`), `knowledge.approved_chunk_count`, `knowledge.pending_review_count`, `insights.openGaps`.
- **Columns it writes:** none directly; each modal handles its own.
- **Sync side-effect on save:** depends on which modal opens.
- **Where else this column appears:** see Appendix.
- **Plan gates:** Booking row opens CalendarModal which is plan-gated (`planSupportsBooking`).
- **Visible-to:** non-admin.

### 15. AgentSyncBadge
- **File:** `src/components/dashboard/AgentSyncBadge.tsx`
- **Section of page:** Below the readiness band, left-aligned, very subtle.
- **What you see:** Rounded pill: emerald "● Synced {timeAgo}" / red "● Sync failed {timeAgo}" / zinc "● Never synced". Title attribute shows full timestamp.
- **What you can do:** When `lastSyncStatus==='error'` the badge becomes a `Link` to `/dashboard/settings?tab=general`. Otherwise it's a static `<span>`.
- **Columns it reads from `clients`:** `last_agent_sync_at`, `last_agent_sync_status`.
- **Columns it writes:** none.
- **Sync side-effect on save:** N/A. These columns are written by `syncToUltravox()` in `src/app/api/dashboard/settings/route.ts` (success / error branches at lines 109–113 and 146–150).
- **Where else this column appears:** AgentIdentityCardCompact `syncedLabel`, InlineModalsV2 `syncedHint(data)` footer on every modal, sync-error toast pill.
- **Visible-to:** non-admin.
- **Conditional rendering:** `data.clientId && data.agentSync`.
- **Known issues from D442 audit:** On 3 of 5 audited clients (`hasan-sharif`, `exp-realty`, `windshield-hub`), `last_agent_sync_at`/`status` are NULL despite recent prompt edits — the variables-PATCH path on legacy-monolithic clients never writes them because `regenerateSlots` returns `success: false` and the post-sync recorder is bypassed. Badge will show "Never synced" instead of surfacing the actual failure.

### 16. Plan + "When you're ready to go live" footer (2-col)
- **File:** UnifiedHomeSectionV2.tsx inline block, lines ~422–463.
- **Section of page:** Bottom of Overview, 2-col on desktop.
- **What you see:** Left card — "PLAN" header, "Trial · Nd left" or `AI Receptionist · $119/mo` / `Solo`, subline "{totalCalls} calls this month · {minutesUsed} / {totalAvailable} minutes used · Manage billing →". Right card (trial only) — indigo-tinted, "WHEN YOU'RE READY TO GO LIVE" + "Pick a plan to keep your number live" + violet "See plans →" pseudo-button.
- **What you can do:** Left card is a `Link` to `/dashboard/billing`. Right card → `openUpgradeModal('unified_upgrade_cta', clientId, daysRemaining, selectedPlan)`.
- **Columns it reads from `clients`:** `subscription_status` (isTrial), `selected_plan`, `seconds_used_this_month`/`monthly_minute_limit`/`bonus_minutes` (usage), `stats.totalCalls` (from call_logs aggregate).
- **Columns it writes:** none.
- **Visible-to:** non-admin.
- **Conditional rendering:** right card only when `isTrial`.

### 17. InlineModalsV2 — modal router host
- **File:** `src/components/dashboard/home/InlineModalsV2.tsx`
- **Section of page:** Modal overlay (`InlineEditModal`), single-instance, centered. Below are the 21 modal IDs (`useInlineEdit` ModalId type) — there is no `aftercall` / `booking` mismatch left (router maps both `booking` and `calendar` to `CalendarModal`, both `website` and `knowledge` to `KnowledgeModal`).

The router (`InlineModalsV2`) consumes `useInlineEdit().openModalId` and renders one of the modals below. Each modal hits one of two PATCH paths: `PATCH /api/dashboard/settings` (via `usePatchSettings`) or `PATCH /api/dashboard/variables`.

#### 17a. GreetingModal
- **What you see:** "Greeting" title + subtitle "The first thing your agent says when someone calls." Single textarea pre-populated from `GET /api/dashboard/variables` → `variables.GREETING_LINE.value`. Save / Cancel actions + sync hint footer.
- **What you can do:** Save → `patchVariable({ variableKey: 'GREETING_LINE', value })` → `PATCH /api/dashboard/variables`.
- **Columns it reads:** `niche_custom_variables.GREETING_LINE` (via variables route).
- **Columns it writes:** `niche_custom_variables.GREETING_LINE` (JSON column merge).
- **API endpoints used:** GET + PATCH `/api/dashboard/variables`.
- **Sync side-effect on save:** Variables PATCH calls `regenerateSlots()`. On slot-pipeline clients, this regenerates `conversation_flow` + dependents, writes new `system_prompt`, fires `updateAgent()` on Ultravox. **On legacy-monolithic clients (hasan-sharif, exp-realty, urban-vibe, windshield-hub), `regenerateSlots` returns `{ promptChanged: false, warning: 'Old-format prompt without section markers — use patchers instead of regeneration' }`; DB `niche_custom_variables.GREETING_LINE` is updated, but `system_prompt` is unchanged and no Ultravox sync fires.** This is the D442 fake-control class.
- **Where else this column appears:** `niche_custom_variables` is written by `app/dashboard/settings/page.tsx` (via PATCH /api/dashboard/settings), read by `home/AgentRoutesOnCard.tsx`, `home/QuickConfigStrip.tsx`, `settings/CallRoutingCard.tsx`, `settings/PmConfigCard.tsx`, `settings/PmSetupChecklist.tsx`, `settings/PromptVariablesCard.tsx`. GREETING_LINE specifically referenced by GreetingFields in go-live.
- **Plan gates:** none.
- **Visible-to:** non-admin (and admin via `client_id` body).
- **Known issues:** **D442/D443 fake-control** — registry `editable=false`, but the chip on AgentIdentityCardCompact shows Edit and PATCH does not enforce. **D278** is the parent redesign D-item. **No-op on 4 of 5 active clients.**

#### 17b. AfterCallModal (SMS chip → "aftercall")
- **What you see:** Optional amber warning if `!twilio_number_present`. Checkbox "Send after-call SMS" + textarea "Template (caller name + business auto-injected)".
- **What you can do:** Save → `patch({ sms_enabled, sms_template })` → `PATCH /api/dashboard/settings`.
- **Columns it reads:** `sms_enabled`, `sms_template`, `twilio_number` (gating).
- **Columns it writes:** `clients.sms_enabled`, `clients.sms_template`.
- **API endpoints used:** PATCH `/api/dashboard/settings`.
- **Sync side-effect on save:** `sms_enabled` is in FIELD_REGISTRY as `DB_PLUS_TOOLS`, `triggersSync: true`, `triggersPatch: 'sms'`. Routes through `applyPromptPatches` (SMS prompt block) AND `needsAgentSync` is true → `syncToUltravox()` fires → `updateAgent()` rebuilds `selectedTools` including `sendTextMessage` only if `sms_enabled && twilio_number && plan.smsEnabled && slug`. `clients.tools` is rewritten via `buildAgentTools(agentFlags)`. `sms_template` is `DB_ONLY` — no sync.
- **Where else this column appears:** `sms_enabled` — `settings/AgentTab.tsx`, `settings/SmsTab.tsx`, `settings/PromptEditorCard.tsx`, `settings/AgentOverviewCard.tsx`, `settings/SetupProgressRing.tsx`, `home/sheets/NotificationsSheet.tsx`, `home/QuickConfigStrip.tsx`, `home/AgentIdentityCard.tsx` (v1), `AgentConfigCard.tsx`, `actions/MessagingSettingsSection.tsx`, `go-live/GreetingFields.tsx`, `go-live/NotificationsBlock.tsx`, plus settings/billing/knowledge pages.
- **Plan gates:** `plan.smsEnabled` is checked inside `buildAgentTools()` at sync time.
- **Visible-to:** non-admin.

#### 17c. TelegramModal
- **What you see:** Either "Telegram is connected" copy or "Click below to open Telegram and link your account" copy. Single button "Open Telegram → @unmissedaibot".
- **What you can do:** Click → `POST /api/dashboard/telegram-link` with `{ clientId }`. Response either returns `alreadyConnected: true` (fetchData refresh) or `deepLink` to open the bot.
- **Columns it reads:** `telegram_chat_id` + `telegram_bot_token` (folded into `onboarding.telegramConnected`), `telegram_bot_url`.
- **Columns it writes:** Indirectly — `/api/webhook/telegram` writes `telegram_chat_id` when the user completes the deep-link `/start TOKEN` flow.
- **Sync side-effect on save:** None — telegram_* fields are `DB_ONLY` admin-only via settings.
- **Where else this column appears:** `telegram_notifications_enabled` — `settings/AgentTab.tsx`, NotificationsBlock, NotificationsSheet, notifications config section.
- **Plan gates:** none.
- **Visible-to:** non-admin.
- **Known issues:** D225 in tracker — `/api/dashboard/telegram-link` wiring to the setup card.

#### 17d. IvrModal
- **What you see:** Checkbox "Enable IVR pre-filter" + textarea "IVR prompt" with hint "Phone calls only — WebRTC has no DTMF."
- **What you can do:** Save → `patch({ ivr_enabled, ivr_prompt })` → PATCH /api/dashboard/settings.
- **Columns it reads/writes:** `clients.ivr_enabled`, `clients.ivr_prompt`.
- **Sync side-effect on save:** Both fields are `DB_ONLY` per FIELD_REGISTRY → **no Ultravox sync**. Inbound webhook reads `ivr_enabled` at call time and may serve `<Gather>` TwiML before the agent.
- **Where else this column appears:** `home/IvrVoicemailTile.tsx`, `home/QuickConfigStrip.tsx`, `settings/IvrMenuCard.tsx`, `settings/AgentTab.tsx`, `AgentConfigCard.tsx`.
- **Plan gates:** none.
- **Visible-to:** non-admin.

#### 17e. VoicemailModal
- **What you see:** Single textarea "Greeting text" + caption "Audio file upload coming soon — for now, the greeting is text-to-speech".
- **What you can do:** Save → `patch({ voicemail_greeting_text })`.
- **Columns it reads/writes:** `clients.voicemail_greeting_text` (`DB_ONLY`).
- **Sync side-effect:** None. Used by the voicemail fallback TwiML and IVR-digit-1 flow.
- **Where else this column appears:** `home/IvrVoicemailTile.tsx`, `home/QuickConfigStrip.tsx`, `settings/VoicemailGreetingCard.tsx`, AgentConfigCard, `go-live/GreetingFields.tsx`, `go-live/NotificationsBlock.tsx`.

#### 17f. GbpModal
- **What you see:** "✓ Imported from Google" pill + a 5-row name-value table (business name, weekday hours, weekend hours, website, rating), optional summary block, footer caption "Auto-imported via Google Places at onboarding." If not connected: prompt to `/dashboard/knowledge?source=gbp`.
- **What you can do:** Read-only display. Disconnected → `Link` to `/dashboard/knowledge?source=gbp`.
- **Columns it reads:** `gbp_place_id`, `gbp_summary`, `gbp_rating`, `gbp_review_count`, `gbp_photo_url`, `business_name`, `business_hours_weekday`, `business_hours_weekend`, `website_url`.
- **Columns it writes:** none.
- **Sync side-effect:** N/A — read-only.
- **Where else this column appears:** AgentKnowsCard Google pill, AgentIdentityCardCompact GBP chip, knowledge page GBP source filter.

#### 17g. TodayModal
- **What you see:** Textarea "What should the agent know about today?" + Auto-clear select (today/tomorrow/week/never).
- **What you can do:** Save → `patch({ injected_note })`. Backend auto-sets `injected_note_expires_at` to `Date.now() + 24h` (the autoClear select is currently advisory — see code comment).
- **Columns it reads/writes:** `clients.injected_note`, `clients.injected_note_expires_at`.
- **Sync side-effect:** `injected_note` is `PER_CALL_CONTEXT_ONLY` per FIELD_REGISTRY → no Ultravox sync. Injected fresh each call via `buildAgentContext()` as `RIGHT NOW: {note}`.
- **Where else this column appears:** AgentIdentityCardCompact chip, `home/AgentIdentityCard.tsx` (v1), `settings/QuickInject.tsx`, `settings/AgentTab.tsx`.
- **Known issues:** D442 noted Hasan's `injected_note='Im in mountains this weekend leave my assistant a message'` reads like a voicemail greeting; the label is misleading but the behavior is correct.

#### 17h. HoursModal
- **What you see:** Weekday hours input + Weekend hours input + after-hours behavior select (`take_message` / `route_emergency`) + conditional emergency phone input.
- **What you can do:** Save → `patch({ business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone })`.
- **Columns it reads/writes:** all four.
- **Sync side-effect:** `business_hours_weekday` is uniquely `DB_PLUS_PROMPT` (not `PER_CALL_CONTEXT_ONLY`) per FIELD_REGISTRY — because `{{HOURS_WEEKDAY}}` is substituted into the static prompt at provision; settings PATCH runs through `applyPromptPatches` and the prompt change triggers `computeNeedsSync` → `updateAgent()`. The other three are `PER_CALL_CONTEXT_ONLY` → no Ultravox sync; injected at call time via `callerContextBlock`. **NB:** the contract doc lists weekday as `PER_CALL_CONTEXT_ONLY`, but the active FIELD_REGISTRY reclassifies it as `DB_PLUS_PROMPT` with the explanatory comment in `settings-schema.ts` lines 75–79.
- **Where else this column appears:** AgentKnowsCard hoursSummary, AgentIdentityCardCompact (no — not displayed there), `settings/HoursCard.tsx`, `settings/AgentTab.tsx`, `settings/AgentKnowledgeCard.tsx`, `home/sheets/HoursSheet.tsx`, `go-live/HoursFields.tsx`, `AgentConfigCard.tsx`, readiness band.
- **Plan gates:** none.

#### 17i. ForwardingModal (Transfer chip → 'transfer')
- **What you see:** Plan-gated copy + "See plans →" if `!planSupportsTransfer`. Else checkbox "Enable live transfer" + caption "Phone calls only — WebRTC has no Twilio Call SID" + tel input.
- **What you can do:** Save → `patch({ forwarding_number: enabled ? number : null })`.
- **Columns it reads/writes:** `clients.forwarding_number`.
- **Sync side-effect:** `DB_PLUS_TOOLS`, `triggersSync: true`. `needsAgentSync` fires → `updateAgent()` rebuilds tools; `buildTransferTools()` adds `transferCall` HTTP tool when forwarding_number set. `clients.tools` also rebuilt.
- **Where else this column appears:** AgentIdentityCardCompact `hasForwarding` gate, `home/QuickConfigStrip.tsx`, `home/sheets/ForwardingSheet.tsx`, `settings/AgentTab.tsx`, `settings/SetupCard.tsx`, `settings/SetupProgressRing.tsx`, ActionItems, AgentConfigCard, actions/TransferSettingsSection, ActivationTile step 2.
- **Plan gates:** `planSupportsTransfer = isTrial || selectedPlan === 'core' || selectedPlan === 'pro'`.

#### 17j. CalendarModal (Booking chip + Calendar readiness row both → CalendarModal)
- **What you see:** Three branches. (1) Plan-gated → "See plans". (2) Connected → "✓ Google Calendar connected" + Manage link. (3) Disconnected → "Connect Google Calendar →" OAuth link.
- **What you can do:** OAuth → `/api/auth/google` (non-admin) or `/api/auth/google?client_id=…` (admin). Manage → `/dashboard/calendar`.
- **Columns it reads:** `calendar_auth_status` (`calendarConnected`), `booking_enabled`.
- **Columns it writes:** none directly. OAuth callback writes `calendar_auth_status='connected'`. (Note: this modal does NOT write `booking_enabled` itself — that toggle is on `settings/BookingCard.tsx` for now.)
- **Sync side-effect:** N/A in this modal. `booking_enabled` is `DB_PLUS_PROMPT_PLUS_TOOLS`, `triggersSync: true`, `triggersPatch: 'calendar'`. When toggled elsewhere, `patchCalendarBlock()` rewrites the `# CALENDAR BOOKING FLOW` section of the prompt and `buildAgentTools()` adds `checkCalendarAvailability` + `bookAppointment` tools. Also triggers `regenerateSlots` for `conversation_flow` + `goal` slots (D276).
- **Where else this column appears:** `booking_enabled` — `settings/BookingCard.tsx`, `settings/AgentTab.tsx`, `settings/AgentOverviewCard.tsx`, `settings/PromptEditorCard.tsx`, `settings/AgentKnowledgeCard.tsx`, `settings/SetupProgressRing.tsx`, `agent/AgentPageView.tsx`, `home/QuickConfigStrip.tsx`, ActionItems, actions/BookingSettingsSection, AgentIdentityCardCompact `hasBooking` chip, readiness band Booking row.
- **Plan gates:** `planSupportsBooking`.

#### 17k. VoiceModal
- **What you see:** Search input + scrollable list (up to ~44vh) of voice cards. Each card: voice name + (Provider · description) + `▶ Play` / `◼ Playing` pill. Selected voice shows "SELECTED" badge.
- **What you can do:** Click row → `patch({ agent_voice_id: v.voiceId })` (selectVoice). Click Play → audio from `/api/dashboard/voices/{voiceId}/preview`.
- **Columns it reads/writes:** `clients.agent_voice_id`.
- **API endpoints used:** GET `/api/dashboard/voices`, GET `/api/dashboard/voices/{id}/preview`, PATCH `/api/dashboard/settings`.
- **Sync side-effect:** `agent_voice_id` is `DB_PLUS_TOOLS`, `triggersSync: true` → `updateAgent({ voice })` PATCHes Ultravox.
- **Where else this column appears:** see Appendix; ~20 surfaces including `settings/VoicePicker.tsx`, `settings/VoiceTab.tsx`, `settings/AgentConfigCard.tsx`, `go-live/GoLiveVoicePicker.tsx`, `go-live/VoicePickerCompact.tsx`, `app/dashboard/voices/page.tsx`, both v1 + v2 home identity cards.

#### 17l. IdentityModal
- **What you see:** "Agent's name" input (max 40) + "Business name" input (max 80) + caption "Saving rewrites both names everywhere the agent speaks them".
- **What you can do:** Save → `patch({ agent_name, business_name })`.
- **Columns it reads/writes:** `clients.agent_name`, `clients.business_name`.
- **Sync side-effect:** Both are `DB_PLUS_PROMPT`. `agent_name` has `triggersSync:false` but `triggersPatch:'agent_name'` — patchAgentName rewrites system_prompt word-boundary, prompt change triggers sync indirectly. Same for `business_name` → `patchBusinessName` (D282).
- **Where else this column appears:**
  - `agent_name`: ~16 surfaces (see grep results above + Appendix).
  - `business_name`: ~50 surfaces — every component that renders the business name (dashboard header, billing, calls page, intake, admin views).
- **Plan gates:** none.

#### 17m. CallbackModal
- **What you see:** Two inputs: "Person who calls back" (single first name) + "Callback phone" (when CALLBACK_PHONE variable exists). Warning when input is multi-word.
- **What you can do:** Save → two parallel `patchVariable({ variableKey: 'CLOSE_PERSON' | 'CALLBACK_PHONE', value })`.
- **Columns it reads/writes:** `niche_custom_variables.CLOSE_PERSON`, `niche_custom_variables.CALLBACK_PHONE`.
- **Sync side-effect:** Same as GreetingModal — slot regen on slot-pipeline clients, silent no-op on legacy-monolithic.
- **Where else this column appears:** PromptVariablesCard, prompt-slots resolver, settings page variables surface.
- **Known issues:** Same D442 fake-control class as Greeting.

#### 17n. ServicesModal
- **What you see:** Empty-state warning when `activeServicesCount === 0` ("agent currently can't describe what you sell") or "{N} active services configured" copy + "Manage services →" link.
- **What you can do:** Link to `/dashboard/knowledge?tab=services`.
- **Columns it reads:** `activeServicesCount` (from `client_services` table count).
- **Columns it writes:** none — display-only, services are edited on the Knowledge tab.
- **Sync side-effect:** N/A from this modal.
- **Where else this column appears:** AgentKnowsCard Services pill, readiness band Services row, knowledge page.

#### 17o. FaqsModal
- **What you see:** Accordion list of existing Q/A entries (click row to expand, edit answer textarea, Remove button) + "Add new FAQ" dashed box with Question + Answer inputs and a + Add FAQ button.
- **What you can do:** Save → `patch({ extra_qa: faqs })`.
- **Columns it reads/writes:** `clients.extra_qa`.
- **Sync side-effect:** `extra_qa` is `DB_PLUS_KNOWLEDGE_PIPELINE`. Settings PATCH triggers `reseedKnowledgeFromSettings()` (fire-and-forget) when `knowledge_backend='pgvector'`; sets `knowledgeReseeded=true` which feeds `computeNeedsSync` → `updateAgent()` re-registers `queryKnowledge` tool. Per-call injection happens via `businessFacts` templateContext (KnowledgeSummary). `extra_qa` itself is NOT in system_prompt.
- **Where else this column appears:** 22 surfaces — see Appendix. AdvancedContextCard, AgentKnowledgeCard, KnowledgeEngineCard, knowledge sheet, QuickAddFaq, GapAnswerSection, CallGapReview, InlineFaqEditor, PromptEditorCard, AgentTab.

#### 17p. KnowledgeModal (Website chip + Knowledge readiness row → KnowledgeModal)
- **What you see:** Source filter pills ("All (N)", "🔗 Website", "📄 PDF", "⭐ Manual", "🤖 AI Compiled") + total summary copy + "Open Knowledge →" CTA.
- **What you can do:** Source pills filter the deep-link destination. CTA → `/dashboard/knowledge` (with `?source=…` when filtered).
- **Columns it reads from `clients`:** `knowledge_backend`, `website_url`, `website_scrape_status` (capabilities.hasWebsite). From `knowledge_chunks`: `approved_chunk_count`, `pending_review_count`, `source_counts`.
- **Columns it writes:** none.
- **Where else this column appears:** AgentKnowsCard KB pill, knowledge page, settings KnowledgeEngineCard.

#### 17q. GapsModal
- **What you see:** Accordion list of top unanswered queries from `insights.topGaps` (`knowledge_query_log` with `result_count=0` + `resolved_at IS NULL`). Each gap shows query text + caller count. Expanding shows "Answer the agent will give next time" textarea + "Promote to FAQ + sync to agent" button.
- **What you can do:** Promote → `patch({ extra_qa: [...currentFaqs, { q: gap.query_text, a: answer }] })`.
- **Columns it reads:** `knowledge_query_log` rows (via `/api/dashboard/home`).
- **Columns it writes:** `clients.extra_qa` (full re-write, append pattern).
- **Sync side-effect:** Same as FaqsModal — knowledge reseed + Ultravox sync.

#### 17r. CallDetailModal (Recent calls row → 'call')
- **What you see:** Status emoji + label ("🔥 Classified HOT" / "🔴 Live now" / "🧪 Test call" / etc.), formatted phone or "Browser test call", time-ago, duration. AI summary block. "View full transcript →" link.
- **What you can do:** Transcript link → `/dashboard/calls/{ultravox_call_id}`.
- **Columns it reads:** snapshot of the call_logs row passed in via `useInlineEdit` payload (`call_status`, `caller_phone`, `started_at`, `duration_seconds`, `ai_summary`, `sentiment`, `ultravox_call_id`).
- **Columns it writes:** none.

### Modal IDs that exist in `useInlineEdit.ModalId` but aren't mapped on the v2 Overview
- `aftercall` (mapped — SMS chip), `booking` (mapped via CalendarModal in router but no surface opens it; chip uses `calendar`), `website` (mapped via KnowledgeModal but no surface opens it; chip uses `knowledge`). These exist in the ModalId union because the router supports both keys.

---

## Calls & Leads tab — surfaces

### 18. Page header
- **File:** `src/app/dashboard/calls/page.tsx` (inline block lines 124–128).
- **Section of page:** Top of page.
- **What you see:** "Calls & Leads" h1 + caption "Inbound activity and outbound follow-up".
- **What you can do:** Static.
- **Visible-to:** both.

### 19. CallsList (left, 2/3 grid)
- **File:** `src/components/dashboard/CallsList.tsx`
- **Section of page:** Left 2-col of the page grid.
- **What you see:** Inside CallsList — LiveCallBanner at top (same as Overview chip 1), optional "Setup incomplete" amber card (non-admin only when `clientStatus==='setup'`), MinuteUsage (unless hideMinuteUsage). Then the call log: rounded outer card with admin client selector (admin only), header row (uppercase "CALL LOG" + ScopedClientLabel + count + date-filter chip + optional "Dial" button), filter chips (`All / HOT / WARM / COLD / JUNK / Unclassified / MISSED / Outbound`), search input, optional processing banner ("Classifying N calls…"), and the body — date-grouped CallRow rows (or NoCalls empty state). View mode toggle list/kanban (KanbanBoard when active). Export CSV button. (Note: page passes `hideAnalytics` and `hideMinuteUsage`, so StatsGrid + OutcomeCharts + RevenueAtRisk + ClientHealthBar + MinuteUsage are suppressed on the calls page.)
- **What you can do:**
  - Filter chip → updates local filter state.
  - Search → filters by phone (any user) or business name (admin only).
  - Date filter chip dismiss → clears `dateFilter`.
  - Admin "ClientSelector" → sets `clientFilter` + AdminClientContext.
  - "Dial" → opens `DialModal` (admin) or DialModal with prefilled slug (non-admin).
  - Export CSV → `exportCsv()` triggers a blob download.
  - CallRow click → expands inline (see chip 21 below).
  - LiveCallBanner buttons → same as Overview chip 1.
- **Columns it reads from `call_logs`:** `id, ultravox_call_id, caller_phone, call_status, call_direction, ai_summary, service_type, duration_seconds, started_at, client_id, confidence, sentiment, key_topics, next_steps, quality_score, transfer_status, sms_outcome, clients(business_name, slug)` — initial fetch in the page's RSC, then realtime INSERT/UPDATE subscriptions in CallsList scoped by `client_id=eq.${clientId}` for non-admin or unscoped for admin. Polls live/processing rows every 6s.
- **Columns it writes:** none on `clients`. Stale `processing` rows >5min are auto-rewritten to `call_status='UNKNOWN'` via service-role client (page-level RSC code lines 109–120).
- **API endpoints used:** PATCH `/api/admin/recover` (auto-recover live calls >15min stale), DELETE/POST `/api/dashboard/calls/[id]/whisper`+`transfer-now` (via LiveCallBanner). Internal Supabase realtime channel `call_logs_realtime`.
- **Sync side-effect on save:** N/A (no clients-table writes).
- **Where else this surface appears:** CallsList is also referenced from `src/app/dashboard/page.tsx` (admin Command Center context — Activity feed reads same data via different aggregation). `LiveCallBanner` is shared with Overview. `MinuteUsage` also appears on the Overview activity tab implicitly via `data.usage`.
- **Plan gates:** none.
- **Visible-to:** both. Admin sees ClientSelector + cross-client view; non-admin scoped to their `client_id`.
- **Conditional rendering:** always rendered.
- **Known issues:** None open. D266 ("Recent calls parity") is a known goal — Overview's V2CallList uses `useCallLog`, Calls page uses `CallsList` with direct realtime; they both read the same table but through different code paths.

### 20. ContactsView (right, 1/3 grid — non-admin or scoped admin only)
- **File:** `src/components/dashboard/ContactsView.tsx`
- **Section of page:** Right 1/3 of the page grid (`lg:col-span-1`), only when `clientId` is non-null.
- **What you see:** "CONTACTS" uppercase header above a table. Each contact row: name (or formatted phone), VIP star, last-call status badge, call count, last-call time. Dialog on click shows: VIP panel, call history (paginated by `/api/dashboard/callers/history`), per-contact notes, tags.
- **What you can do:** Click row → opens contact `Dialog` (shadcn) showing call history, VIP panel, tags. VIP toggle → `PATCH /api/dashboard/callers/{id}` (sets `is_vip`, `vip_relationship`, etc.). Add note → POST.
- **Columns it reads:** from a `callers` (or equivalent) table: `id, phone, name, email, tags, notes, source, is_vip, vip_relationship, vip_notes, transfer_enabled, preferences, sms_opted_out, call_count, last_call_at, last_outcome, first_seen_at`. Call history pulled from `call_logs` via `/api/dashboard/callers/history?client_id=…&phone=…&limit=20`.
- **Columns it writes:** to `callers` table — `is_vip`, `vip_relationship`, `vip_notes`, `notes`, `tags` (via API).
- **API endpoints used:** GET `/api/dashboard/callers/history`, GET/PATCH `/api/dashboard/callers/[id]` (assumed).
- **Sync side-effect on save:** N/A — caller-level data, no Ultravox sync.
- **Where else this surface appears:** Standalone. Not embedded elsewhere.
- **Plan gates:** none.
- **Visible-to:** non-admin always; admin only when a client is scoped.
- **Conditional rendering:** `clientId !== null`.

### 21. CallRow (call list row primitive)
- **File:** `src/components/dashboard/CallRow.tsx`
- **Section of page:** Row primitive used inside CallsList.
- **What you see:** Each row has a left status stripe (3px border-left, color from STATUS_STRIPE — red/amber/blue/zinc/green/yellow). Row body: status pill (iMessage-blue bubble for HOT/WARM/live/processing, iMessage-green for COLD/JUNK/MISSED), formatPhone, ai_summary snippet, duration mm:ss, timeAgo, transfer-status badge (Transferring/Transferred/Recovered/No Answer/Busy/Failed/Canceled) when relevant, sms_outcome badge (Sent/Opted Out/SMS Failed/No Phone), short key_topics list. Expandable detail panel below.
- **What you can do:** Click row → expand. Expanding fetches `transcript, key_topics, next_steps, confidence, sentiment` from `call_logs`. Also probes recording availability via `GET /api/dashboard/calls/{ultravox_call_id}/recording` with `Range: bytes=0-0`. Inside the expanded panel (CallRowExpanded): listen to recording, view transcript, "Call back" button (when `onCallBack` wired).
- **Columns it reads from `call_logs`:** `id, ultravox_call_id, caller_phone, call_status, call_direction, ai_summary, service_type, duration_seconds, started_at, business_name (joined), confidence, sentiment, key_topics, next_steps, quality_score, transfer_status, sms_outcome, callback_preference, transcript`.
- **Columns it writes:** none.
- **API endpoints used:** GET `/api/dashboard/calls/{ultravox_call_id}/recording`.
- **Where else this surface appears:** CallRow itself is only used inside CallsList. The V2CallList component on Overview imports the `CallLog` type from CallRow but renders its own slim button rows (D266 is the unify-them roadmap item).
- **Plan gates:** none.
- **Visible-to:** both.

---

## Overview data flow — when you edit X here, Y also changes

### Edit `niche_custom_variables.GREETING_LINE` via GreetingModal
- **Also reflected on:** AgentIdentityCardCompact Greeting chip (refreshes on `fetchData`), prompt-slot-regenerated `system_prompt` → AgentSyncBadge + syncedLabel + InlineModalsV2 footer hint. On the Settings page, PromptVariablesCard / PromptEditorCard surfaces the prompt content.
- **Save effect on live agent:** Slot-pipeline clients → `regenerateSlots()` → rewrites system_prompt → `computeNeedsSync` true → `updateAgent()` → Ultravox callTemplate.systemPrompt updated. Knowledge tool re-registered if knowledge_backend changed (not the case here).
- **Known no-op cases:** Legacy-monolithic clients (`hasan-sharif`, `exp-realty`, `urban-vibe`, `windshield-hub`) — `regenerateSlots` returns `success:false, warning:'Old-format prompt…'`; DB `niche_custom_variables.GREETING_LINE` updates; system_prompt does not change; Ultravox not synced. UI toast still says "Greeting saved." (D442/D443/D278.)

### Edit `niche_custom_variables.CLOSE_PERSON` / `CALLBACK_PHONE` via CallbackModal
- **Same flow + same no-op surface as GREETING_LINE.** Also surfaces on PromptVariablesCard in Settings, and CLOSE_PERSON propagates into closing-line slot text on slot-pipeline clients only.

### Edit `clients.agent_name` via IdentityModal
- **Also reflected on:** AgentIdentityCardCompact title line + avatar initial, TrialWelcomeBanner heading, AgentKnowsCard "Business identity" block, AgentVoiceTest copy in TestCallCard, AgentTab/AgentOverviewCard/PromptEditorCard, every Settings + Knowledge + Lab + Billing + Welcome page header. ~16 component surfaces total.
- **Save effect on live agent:** `DB_PLUS_PROMPT`, `triggersSync:false` but `triggersPatch:'agent_name'`. `applyPromptPatches` → `patchAgentName()` word-boundary replaces old name throughout system_prompt → `computeNeedsSync` becomes true because `system_prompt` now in updates → `updateAgent()` fires.
- **Known no-op cases:** Per D442, the safety-net 5b block in the variables PATCH path handles NAME_FIELDS even on legacy clients, so renaming works there. But settings-PATCH path uses `patchAgentName` which relies on finding the OLD name in the prompt — if the prompt was manually edited, the patcher silently skips.

### Edit `clients.business_name` via IdentityModal
- **Also reflected on:** dashboard header business switcher, ScopedClientLabel, ClientHealthBar, LiveCallBanner (admin), AgentIdentityCardCompact title, AgentKnowsCard, Calls page (every CallRow's business_name column), Settings, Billing, etc. ~50 surfaces.
- **Save effect on live agent:** Same as agent_name — `patchBusinessName()` → prompt rewrites → updateAgent. D282 ✅.

### Toggle `clients.sms_enabled` (+ `sms_template`) via AfterCallModal
- **Also reflected on:** AgentIdentityCardCompact SMS chip dot color, capabilities.hasSms in V2 readiness, `home/QuickConfigStrip.tsx` (v1), `settings/SmsTab.tsx`, `settings/AgentTab.tsx`, `settings/AgentOverviewCard.tsx`, `settings/PromptEditorCard.tsx`, `settings/SetupProgressRing.tsx`, NotificationsSheet, NotificationsBlock, MessagingSettingsSection, AgentConfigCard, GreetingFields.
- **Save effect on live agent:** `DB_PLUS_TOOLS`, `triggersSync:true`, `triggersPatch:'sms'`. `applyPromptPatches` runs the SMS patcher block. `needsAgentSync` → `updateAgent` rebuilds `selectedTools` (`sendTextMessage` included iff `sms_enabled && twilio_number && plan.smsEnabled`). `clients.tools` rewritten via `buildAgentTools(agentFlags)` (lines 104–105 of route.ts).

### Toggle `clients.booking_enabled` (currently only writable from settings/BookingCard; CalendarModal here does not write it)
- **Also reflected on:** AgentIdentityCardCompact Booking chip, V2 readiness Booking row, capabilities matrix everywhere, BookingCard, AgentKnowledgeCard, AgentOverviewCard, PromptEditorCard, SetupProgressRing, AgentPageView, QuickConfigStrip, ActionItems, BookingSettingsSection.
- **Save effect on live agent:** `DB_PLUS_PROMPT_PLUS_TOOLS`, `triggersSync:true`, `triggersPatch:'calendar'`. Prompt: `patchCalendarBlock` appends/removes `# CALENDAR BOOKING FLOW` section. Tools: `buildAgentTools` adds/removes `checkCalendarAvailability` + `bookAppointment`. Also (block 8c) `regenerateSlots(['conversation_flow', 'goal'])` fires on slot-pipeline clients (D276). Post-enable verification fetches Ultravox agent to confirm calendar tools present; returns `ultravox_synced:false` with explicit error if missing.

### Edit `clients.forwarding_number` via ForwardingModal
- **Also reflected on:** AgentIdentityCardCompact Transfer chip + hasForwarding caption + trial caption, ActivationTile step 2 status, capabilities.hasTransfer (readiness row not present in v2 — was removed), QuickConfigStrip, ForwardingSheet (v1), TransferSettingsSection, AgentConfigCard, AgentTab, AgentOverviewCard, SetupCard, SetupProgressRing, ActionItems.
- **Save effect on live agent:** `DB_PLUS_TOOLS`, `triggersSync:true`. `buildTransferTools()` adds `transferCall` HTTP tool when non-null. `clients.tools` rewritten.

### Edit `clients.agent_voice_id` via VoiceModal
- **Also reflected on:** AgentIdentityCardCompact voice pill, AgentVoiceTest playback, VoiceTab, VoicePicker, AgentConfigCard, GoLiveVoicePicker, VoicePickerCompact, `/dashboard/voices/page.tsx`, ClientHomeV2, v1 home identity card.
- **Save effect on live agent:** `DB_PLUS_TOOLS`, `triggersSync:true`. `updateAgent({ voice })` → Ultravox callTemplate.voice updated. `clients.tools` rebuilt (no tool change, but rewritten).

### Edit `clients.injected_note` via TodayModal
- **Also reflected on:** AgentIdentityCardCompact "Today:" chip label, QuickInject (settings), AgentTab, v1 AgentIdentityCard. `injected_note_expires_at` is auto-set to +24h.
- **Save effect on live agent:** `PER_CALL_CONTEXT_ONLY`. No `updateAgent` call. Injected fresh each call as `RIGHT NOW: {note}` via `buildAgentContext()`.

### Edit `clients.business_hours_weekday` / `_weekend` / `after_hours_behavior` / `after_hours_emergency_phone` via HoursModal
- **Also reflected on:** AgentKnowsCard `hoursSummary` line + Hours pill, V2 readiness Hours row, HoursCard, HoursSheet, HoursFields, AgentTab, AgentKnowledgeCard, AgentConfigCard, QuickSetupStrip, SetupProgressRing, PromptEditorCard.
- **Save effect on live agent:** `business_hours_weekday` is `DB_PLUS_PROMPT` (settings-schema.ts line 79 — overrides contract doc) → `{{HOURS_WEEKDAY}}` substitution patch → `computeNeedsSync` true → `updateAgent`. Weekend + after-hours fields are `PER_CALL_CONTEXT_ONLY` — injected fresh each call via `callerContextBlock` `OFFICE STATUS`/`OFFICE HOURS`, no sync.

### Edit `clients.extra_qa` via FaqsModal (or GapsModal "Promote to FAQ")
- **Also reflected on:** AgentKnowsCard FAQ count pill, V2 readiness FAQs row, AdvancedContextCard, AgentKnowledgeCard, KnowledgeEngineCard, knowledge sheet/page, QuickAddFaq, CallGapReview, InlineFaqEditor, GapAnswerSection, PromptEditorCard, AgentTab. ~22 files.
- **Save effect on live agent:** `DB_PLUS_KNOWLEDGE_PIPELINE`. When `knowledge_backend='pgvector'`, `reseedKnowledgeFromSettings()` fires (block 8 of settings route) → embeds new chunks. `knowledgeReseeded=true` → `computeNeedsSync` true → `updateAgent` re-registers `queryKnowledge` tool. NOT inserted into `system_prompt` directly — injected per-call via `businessFacts` templateContext.

### Edit `clients.ivr_enabled` / `ivr_prompt` via IvrModal
- **Also reflected on:** AgentIdentityCardCompact IVR chip, IvrVoicemailTile (v1), QuickConfigStrip, IvrMenuCard, AgentTab, AgentConfigCard.
- **Save effect on live agent:** Both `DB_ONLY`. No Ultravox sync. Inbound webhook reads `ivr_enabled` at call time to decide whether to serve `<Gather>` TwiML before agent.

### Edit `clients.voicemail_greeting_text` via VoicemailModal
- **Also reflected on:** AgentIdentityCardCompact Voicemail chip, IvrVoicemailTile, QuickConfigStrip, VoicemailGreetingCard, AgentTab, AgentConfigCard, GreetingFields, NotificationsBlock.
- **Save effect on live agent:** `DB_ONLY`. Read at call time by the voicemail fallback TwiML / IVR-digit-1 flow only.

---

## Calls & Leads data flow

### Edit a `call_logs` row (via background webhook, not from UI)
The Calls page does not write `clients` columns. Stuck `processing` rows >5min are rewritten to `call_status='UNKNOWN'` (server-side service-role write in the page RSC). Stale `live` rows >15min trigger `POST /api/admin/recover` (fire-and-forget). `LiveCallBanner` mutations (whisper end, transfer-now) go through dedicated routes that update `call_logs.call_status` / `transfer_status`.

### Edit a `callers` row (VIP toggle, notes, tags) via ContactsView dialog
- **Affects:** the ContactsView dialog itself, prior call history (read-only), and the per-call context at runtime (`transfer_enabled`, `is_vip` are read by some prompts via `business_facts` / caller-name lookup; verify in `lib/agent-context.ts` if used). No `clients`-column writes.

---

## Appendix: cross-surface column index (Overview-relevant)

Verified via grep over `src/components/dashboard/` and `src/app/dashboard/`. Counts approximate; "files" = unique file paths that mention the column literal.

| Column | Mutation class | Files mentioning |
|---|---|---|
| `agent_name` | DB_PLUS_PROMPT (patch) | 16 |
| `business_name` | DB_PLUS_PROMPT (patch) | ~50 (every business-rendering surface) |
| `agent_voice_id` | DB_PLUS_TOOLS | 20 |
| `sms_enabled` | DB_PLUS_TOOLS | 19 |
| `forwarding_number` | DB_PLUS_TOOLS | 18 |
| `booking_enabled` | DB_PLUS_PROMPT_PLUS_TOOLS | 15 |
| `business_hours_weekday` | DB_PLUS_PROMPT | 21 |
| `extra_qa` | DB_PLUS_KNOWLEDGE_PIPELINE | 22 |
| `business_facts` | DB_PLUS_KNOWLEDGE_PIPELINE | 17 |
| `ivr_enabled` | DB_ONLY | 13 |
| `voicemail_greeting_text` | DB_ONLY | 13 |
| `injected_note` | PER_CALL_CONTEXT_ONLY | 10 |
| `niche_custom_variables` / `GREETING_LINE` | DB_PLUS_PROMPT (slot_regen) | 10 |

---

## Notes on legend used

- "Sync side-effect on save" classification follows `src/lib/settings-schema.ts` FIELD_REGISTRY exactly. The contract doc (Section 2) was the source for the FIELD_REGISTRY entries, but is older — when they diverge (`business_hours_weekday` = `PER_CALL_CONTEXT_ONLY` in contract vs `DB_PLUS_PROMPT` in registry), the registry is authoritative because it drives `computeNeedsSync` at runtime.
- "Silent no-op (D442)" refers specifically to the variables PATCH path on legacy-monolithic clients where `regenerateSlots()` returns `{ success:false, warning:'Old-format prompt…' }` — confirmed for 4 of 5 active production clients in the 2026-04-30 audit.
