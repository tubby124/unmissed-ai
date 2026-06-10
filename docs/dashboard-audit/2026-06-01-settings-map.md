# Settings surface map

> Read-only descriptive surface map for D442-class audit work. **No recommendations** — every card listed exactly as it ships today.
> Sources: code under `src/app/dashboard/settings/`, `src/components/dashboard/settings/`, `src/lib/settings-schema.ts`, `src/lib/settings-patchers.ts`, `src/app/api/dashboard/settings/route.ts`, plus `docs/architecture/control-plane-mutation-contract.md` for mutation classes.

## Top-level layout

The Settings entry is [src/app/dashboard/settings/page.tsx](src/app/dashboard/settings/page.tsx) → [src/app/dashboard/settings/SettingsView.tsx](src/app/dashboard/settings/SettingsView.tsx). The shell branches sharply on `isAdmin`. **Admin** sees a tab bar (`general` / `notifications` / `billing` — defined in [src/components/dashboard/settings/constants.ts](src/components/dashboard/settings/constants.ts) `TAB_DEFINITIONS`) with no hero. **Non-admin** sees a 3-column hero rendered above the (hidden) tab bar — `activeTab` is permanently pinned to `general` for non-admins (line 132), so the tabs never render and `notifications` / `billing` are effectively dead nav for them on this page (those live on `/dashboard/notifications` and `/dashboard/billing` instead).

The non-admin hero contains four surfaces in a `md:grid-cols-3` row: (1) `CapabilitiesCard` spanning two columns, (2) `TestCallCard` orb stacked above (3) an "Advanced — Prompt Editor" button that opens `PromptEditorModal`, and (4) the inline `NotificationsWidget` function defined at the bottom of `SettingsView.tsx` (lines 606–699). A `QuickSetupStrip` sits above the hero only when the user is non-admin, non-trial, and not all four setup tasks are complete (lines 253–352 — note: this is an inline 4-button strip distinct from the standalone `QuickSetupStrip.tsx` that `AgentTab` also renders inside `general`).

Two persistent banners can appear above the tab content: a Preview-mode amber banner when `previewMode` (from `AdminClientContext`) is on, and the legacy-prompt amber banner ("uses a legacy prompt format…") that renders whenever `client.system_prompt` lacks `<!-- unmissed:` markers (lines 454–462). The `general` tab renders [AgentTab.tsx](src/components/dashboard/settings/AgentTab.tsx) — the ~836-line grid surveyed below — plus an inline `VoiceTab` block when voices are loaded. The `notifications` tab stacks `AlertsTab` over `SmsTab`. The `billing` tab renders `BillingTab`. The Prompt Editor modal ([PromptEditorModal.tsx](src/components/dashboard/settings/PromptEditorModal.tsx)) is a full-screen overlay opened from the "Advanced" button in the hero. The right-side `SettingsPanel` drawer is mounted by `AgentTab` and currently only renders `HoursCard` inside it (activated when `activePanel === 'hours'`).

## Settings hero (non-admin only) — 4 surfaces

### CapabilitiesCard
**File:** [src/components/dashboard/CapabilitiesCard.tsx](src/components/dashboard/CapabilitiesCard.tsx)
**Visible-to:** both (rendered in non-admin hero AND inside `AgentTab` for admin via a second instance, lines 343–356)
**Conditional rendering:** always rendered
**What you see:** Pill grid summarising what the agent can do — "Booking active / Booking off", "SMS follow-up", "Transfer", "Knowledge", "Hours", "Facts", "FAQs", "Website", plus a voice-style label. Each row has either a green checkmark, an empty grey dot, or an amber padlock if the capability is plan-locked. No FieldSyncStatusChip on this card.
**What you can do:** Click any row → either a `<Link>` to the relevant settings deep link or `useUpgradeModal()` open if `upgradeRequired`. Pure navigation; no in-place editing.
**Columns it reads:** Reads derived `Capabilities` shape (`hasKnowledge`, `hasFacts`, `hasFaqs`, `hasHours`, `hasBooking`, `hasSms`, `hasTransfer`, `hasWebsite`) produced upstream by `buildCapabilityFlags()`. Inputs to that builder are `clients.business_facts`, `clients.extra_qa`, `clients.business_hours_weekday`, `clients.booking_enabled` + `clients.calendar_auth_status`, `clients.sms_enabled` + `clients.twilio_number`, `clients.forwarding_number`, `clients.knowledge_backend` + approved chunk count, `clients.website_scrape_status`. Also reads `agent_name`, `voice_style_preset`, `subscription_status`, `selected_plan`, `twilio_number`, `ivr_enabled`, `context_data` props directly.
**Columns it writes:** none
**API endpoints:** none directly — derived view only
**Mutation class (from contract):** READ_MODEL_ONLY (derived via `buildCapabilityFlags`)
**Sync side-effect on save:** N/A — never saves
**Where else these columns appear (cross-surface trace):** Overview `AgentIdentityCardCompact`, Overview `AgentKnowsCard`, Overview `Agent Readiness band`, Knowledge page (`KnowledgePageView`), every Settings card writing to the underlying columns. The component itself is also instantiated inside `AgentTab` for admin (so a single client view can render two `CapabilitiesCard` instances stacked).
**Known issues:** Capability/agent-tool divergence is the canonical fake-control class (mutation contract §7 Risk 1). `hasBooking` UI requires `calendar_auth_status='connected'` but `buildAgentTools` ignores that field — by-design but easy to mis-read. No per-row sync chip.

### TestCallCard (the orb)
**File:** [src/components/dashboard/settings/TestCallCard.tsx](src/components/dashboard/settings/TestCallCard.tsx)
**Visible-to:** both
**Conditional rendering:** always rendered in non-admin hero; also rendered inside `AgentTab` (line 359, both admin & non-admin)
**What you see:** Animated WebRTC orb labelled "Talk to your agent" (or "Start Test Call"). Optional "TRY ASKING" chips and "Or call me on my phone" expandable phone-number field. Shows live call state (idle / calling / done / error). Includes inline `AgentVoiceTest` component.
**What you can do:** (1) Click the orb to start a WebRTC test through `AgentVoiceTest` (uses Path G — Dashboard Agent Test Call, via `POST /api/dashboard/agent-test`). (2) Submit a phone number → outbound dial via `POST /api/dashboard/test-call` (Path D — Dashboard Test Call). (3) Click a "TRY ASKING" chip to scroll to a specific knowledge section via `onScrollTo`.
**Columns it reads:** `clients.ultravox_agent_id`, `clients.tools`, `agent_name`, `business_facts`, `extra_qa`, `business_hours_weekday`, `booking_enabled` + `calendar_auth_status`, `forwarding_number`, `sms_enabled` + `twilio_number`, `knowledge_backend`, `website_scrape_status` (via `knowledge` prop)
**Columns it writes:** none directly. Insert into `call_logs` (`call_status='test'`) happens server-side on agent-test path; demo path inserts into `demo_calls`.
**API endpoints:** `POST /api/dashboard/agent-test`, `POST /api/dashboard/test-call`, `POST /api/dashboard/browser-test-call`
**Mutation class (from contract):** READ_MODEL_ONLY (display + test call originator). The test call paths themselves are PER_CALL_CONTEXT_ONLY in terms of what they inject.
**Sync side-effect on save:** N/A — no DB writes
**Where else these columns appear (cross-surface trace):** This component is reused on Overview hero (compact mode), Knowledge page center column, Go Live page Section 5 (`size='xl'`), and inside `AgentTab` here. Same component, four mount points; client sees one orb on each page they visit.
**Known issues:** Path D & Path G (dashboard tests) have known plan-gate revalidation drift (call-path matrix §3 DR-6). Component itself is not flagged.

### Advanced — Prompt Editor button (opens PromptEditorModal)
**File:** [src/components/dashboard/settings/PromptEditorModal.tsx](src/components/dashboard/settings/PromptEditorModal.tsx) (button is inline in `SettingsView.tsx` lines 378–397)
**Visible-to:** non-admin (in hero); admin reaches the full prompt editor differently via `PromptEditorCard` lower in `AgentTab`
**Conditional rendering:** `!isAdmin` block; always rendered when on Settings
**What you see:** Card with "Advanced" label and amber "POWER USER" pill. Click to open a full overlay with 4 collapsible sections — Business facts, FAQs, Hours & availability, Custom instructions — and a system-prompt textarea.
**What you can do:** Edit `system_prompt`, `business_facts` (newline-separated), `extra_qa` array, `business_hours_weekday` & `_weekend`, `context_data`. Click Save → single PATCH bundling all six fields.
**Columns it reads:** `system_prompt`, `business_facts`, `extra_qa`, `business_hours_weekday`, `business_hours_weekend`, `context_data` (initial values from `SettingsView` state)
**Columns it writes:** `system_prompt` (direct), `business_facts` (string-array), `extra_qa`, `business_hours_weekday`, `business_hours_weekend`, `context_data`
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** DB_PLUS_PROMPT (system_prompt direct), DB_PLUS_KNOWLEDGE_PIPELINE (business_facts, extra_qa when knowledge_backend='pgvector'), DB_PLUS_PROMPT (business_hours_weekday via `patchHoursWeekday`), PER_CALL_CONTEXT_ONLY (business_hours_weekend, context_data)
**Sync side-effect on save:** Per [route.ts](src/app/api/dashboard/settings/route.ts): direct `system_prompt` write → `validatePrompt`, then `applyPromptPatches` runs (which is a no-op since `system_prompt` is already in `updates`), DB save, `computeNeedsSync` returns true via system_prompt path → `syncToUltravox` → `updateAgent` + `buildAgentTools` → `clients.tools` rewrite. Also `business_facts`/`extra_qa` change triggers `reseedKnowledgeFromSettings()` when `knowledge_backend='pgvector'`. `business_hours_weekday` change triggers `patchHoursWeekday` → if prompt changed, prompt write → sync. The modal does NOT use `usePatchSettings` — uses plain `fetch` (line 69) so it never populates the `field_sync_status` cache.
**Where else these columns appear (cross-surface trace):** Every column in this modal also has its own dedicated card lower in `AgentTab` (`PromptEditorCard`, `AdvancedContextCard`, `AgentKnowledgeCard`, `ServicesOfferedCard`, `HoursCard`). On Overview the same cols are written by `InlineModalsV2.GreetingModal` / `FaqsModal` / `HoursModal` / `ServicesModal` / `TodayUpdateModal`. So this modal is a 5th editing path for the same six columns.
**Known issues:** Bypasses `usePatchSettings` → no per-field FieldSyncStatusChip, no `recordFieldSyncStatusMap`, no shared serialization queue (could race against `AgentTab` saves on the same client).

### NotificationsWidget (inline function at bottom of SettingsView.tsx)
**File:** [src/app/dashboard/settings/SettingsView.tsx](src/app/dashboard/settings/SettingsView.tsx) lines 606–699 (inline function, not a separate file)
**Visible-to:** non-admin only (rendered inside the hero column)
**Conditional rendering:** always when non-admin
**What you see:** Three toggle rows — Telegram, Email, SMS follow-up — each with a coloured icon and a pill toggle. Below: a "All notification settings →" link to `/dashboard/notifications`.
**What you can do:** Toggle each row. Each toggle fires an immediate PATCH for that one field.
**Columns it reads:** `clients.telegram_notifications_enabled`, `clients.email_notifications_enabled`, `clients.sms_enabled` (via the `smsEnabled` state already in `SettingsView`)
**Columns it writes:** `telegram_notifications_enabled`, `email_notifications_enabled`, `sms_enabled`
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** DB_ONLY (telegram_notifications_enabled, email_notifications_enabled); DB_PLUS_TOOLS (sms_enabled)
**Sync side-effect on save:** Per FIELD_REGISTRY, `sms_enabled` is `triggersSync:true` AND `triggersPatch:'sms'`. So toggling SMS here calls `patchSmsBlock` in `applyPromptPatches` (which inserts/removes the SMS instruction block in the prompt) and then `syncToUltravox`. Toggling Telegram/Email is DB-only — no prompt patch, no agent sync. Uses `usePatchSettings` so it does record `field_sync_status` for sms_enabled, but renders no FieldSyncStatusChip itself.
**Where else these columns appear (cross-surface trace):** `sms_enabled` is also edited by `AgentOverviewCard` (admin only), `SmsTab` (notifications tab + dedicated `/dashboard/notifications` page), `InlineModalsV2.AfterCallModal` (Overview). `telegram_notifications_enabled` / `email_notifications_enabled` are also edited by `AlertsTab` (notifications tab + `/dashboard/notifications`).
**Known issues:** Triple SMS-toggle entry points (this widget + Overview AfterCallModal + SmsTab) with no shared optimistic state — toggling here updates the widget but the `SmsTab` instance in the same page (rendered when on notifications tab) only re-reads on `router.refresh()` debounce.

## Settings/general tab (AgentTab grid) — by section

The grid is `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` with a series of full-width section headers (`<p class="...uppercase t3">`) splitting it into logical groupings. Sections render conditionally on `isAdmin`, `niche`, and plan/capability flags.

### Section: PM Setup Checklist (PM niche only)

#### PmSetupChecklist
**File:** [src/components/dashboard/settings/PmSetupChecklist.tsx](src/components/dashboard/settings/PmSetupChecklist.tsx)
**Visible-to:** both
**Conditional rendering:** `niche === 'property_management'` (full-width above grid)
**What you see:** Checklist card with 5 rows — Agent active, Emergency forwarding number, Maintenance contacts, Tenant roster (counts loaded tenants from `context_data` line count), Telegram connected — each with a green check or amber dot. Header shows `n/5` complete pill.
**What you can do:** Click an unfinished row → anchor scroll to `#pm-config`, `#section-advanced-context`, or `#telegram-connect`.
**Columns it reads:** `clients.ultravox_agent_id`, `clients.after_hours_emergency_phone`, `clients.niche_custom_variables.niche_maintenanceContacts`, `clients.context_data`, `clients.telegram_chat_id`
**Columns it writes:** none — display only
**API endpoints:** none
**Mutation class (from contract):** READ_MODEL_ONLY
**Sync side-effect on save:** N/A
**Where else these columns appear (cross-surface trace):** `after_hours_emergency_phone` also in `HoursCard` and `PmConfigCard`; `niche_maintenanceContacts` only in `PmConfigCard`; `context_data` also in `AdvancedContextCard`, `ContextDataCard`; `telegram_chat_id` in `AlertsTab`, `GodModeCard`.
**Known issues:** None tracked.

### Section: Admin top row (SetupCard / PlanInfoCard / BillingCard)

#### SetupCard
**File:** [src/components/dashboard/settings/SetupCard.tsx](src/components/dashboard/settings/SetupCard.tsx)
**Visible-to:** admin
**Conditional rendering:** `isAdmin` only (top of grid)
**What you see:** Two states. (a) Compact "Setup complete · [phone]" with FieldSyncStatusChip for `forwarding_number` and `transfer_conditions`. (b) Full form with: Twilio number (read-only with copy), Call forwarding number input (with `forwarding_number` chip), Transfer conditions textarea (with `transfer_conditions` chip), and a 3-item checklist (AI phone, forwarding, setup_complete) → "Activate Agent" button when first two are met. Collapsible amber-bordered card "Start here — complete your setup".
**What you can do:** Edit `forwarding_number`, `transfer_conditions`, toggle `setup_complete`, "Mark as done"/"Reset" buttons. Copy Twilio number.
**Columns it reads:** `clients.twilio_number` (read-only), prop-passed `initialForwardingNumber`, `initialTransferConditions`, `initialSetupComplete`
**Columns it writes:** `forwarding_number`, `transfer_conditions`, `setup_complete`
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** DB_PLUS_TOOLS (forwarding_number, transfer_conditions); DB_ONLY (setup_complete)
**Sync side-effect on save:** `forwarding_number` change → `applyPromptPatches` runs `patchVipSection` (toggles VIP section in prompt) → if prompt changed, version stored; `computeNeedsSync` returns true via the `forwarding_number in updates` path → `syncToUltravox` → `buildAgentTools` adds/removes `transferCall` tool → `clients.tools` rewrite + `updateAgent`. `transfer_conditions` is in the sync trigger list → same sync path; also feeds into `transferCall` tool description.
**Where else these columns appear (cross-surface trace):** `forwarding_number` also in `AgentOverviewCard` (display, admin), `VIPContactsCard` (display + warning), `actions/TransferSettingsSection.tsx` (Actions page), `home/InlineModalsV2.TransferModal` (Overview), `ActionItems.tsx` (Overview tile). `transfer_conditions` same set plus this card and Actions/TransferModal. `setup_complete` is also driven by `AgentTab.handleMarkSetupComplete`.
**Known issues:** None tracked. The chip wiring is exemplary — uses `retryFieldSync` from `usePatchSettings` (D449).

#### PlanInfoCard
**File:** [src/components/dashboard/settings/PlanInfoCard.tsx](src/components/dashboard/settings/PlanInfoCard.tsx)
**Visible-to:** both (admin top row, non-admin bottom row "Plan & Billing" section)
**Conditional rendering:** always rendered for admin in top row; also rendered for non-admin in the "Settings/Plan & Billing" section
**What you see:** Plan badge (Trial/Lite/Core/Pro coloured), trial countdown if `subscription_status='trialing'`, minutes used progress bar with usage %, capability checklist (SMS/Knowledge/LearningLoop/LeadScoring/Booking/Transfer), Upgrade CTA button, optional minute-pack reload buttons.
**What you can do:** "Upgrade to [next plan]" button → `POST /api/billing/upgrade` → redirect to Stripe checkout. "Buy minutes" → `POST /api/billing/minute-pack` per pack.
**Columns it reads:** `selected_plan`, `subscription_status`, `seconds_used_this_month`, `monthly_minute_limit`, `bonus_minutes`, `trial_expires_at`, `trial_converted`, `stripe_customer_id`
**Columns it writes:** none directly — Stripe webhook is the writer
**API endpoints:** `POST /api/billing/upgrade`, `POST /api/billing/minute-pack`
**Mutation class (from contract):** READ_MODEL_ONLY for display; the upgrade flow is owned by the Stripe webhook (mutation contract Section 3 Branch: Stripe webhook).
**Sync side-effect on save:** Upgrade redirect → Stripe → webhook → `syncClientTools()` re-runs `buildAgentTools` against the new plan entitlements → updates `clients.tools` and `selected_plan`. The webhook is responsible for any agent re-sync.
**Where else these columns appear (cross-surface trace):** `BillingCard`, `BillingTab`, `UsageSummary`, Overview banners (`UnifiedHomeSectionV2` minutes-warn toast), Sidebar plan badge, `TrialUrgencyBanner` in dashboard layout.
**Known issues:** None tracked here; gating logic is centralized in `getPlanEntitlements`.

#### BillingCard
**File:** [src/components/dashboard/settings/BillingCard.tsx](src/components/dashboard/settings/BillingCard.tsx)
**Visible-to:** both (admin top row; non-admin bottom "Plan & Billing")
**Conditional rendering:** always
**What you see:** Active/PastDue/Canceled status, period end date, optional cancel-pending banner, "Manage Billing" portal button, minute reload buttons (only when `subscription_status` is active or past_due AND `twilio_number` exists), invoice history toggle.
**What you can do:** Open Stripe portal (`POST /api/billing/portal`), buy minute packs (`POST /api/billing/minute-pack`), view invoice list (`GET /api/billing/invoices`).
**Columns it reads:** `selected_plan`, `subscription_status`, `subscription_current_period_end`, `stripe_customer_id`, `stripe_discount_name`, `effective_monthly_rate`, `cancel_at`, `twilio_number`
**Columns it writes:** none directly — Stripe webhook
**API endpoints:** `POST /api/billing/portal`, `POST /api/billing/minute-pack`, `GET /api/billing/invoices`
**Mutation class (from contract):** READ_MODEL_ONLY
**Sync side-effect on save:** N/A (Stripe webhook owns sync)
**Where else these columns appear (cross-surface trace):** `PlanInfoCard`, `BillingTab`, `UsageSummary`, sidebar.
**Known issues:** None tracked.

### Section: Capabilities + Test Call

#### CapabilitiesCard (admin instance)
Same component as the hero version, rendered inside `AgentTab` lines 343–356 for admin. See hero entry above. Spans 2 columns.

#### TestCallCard (admin/general instance)
Same component as hero, rendered at lines 359–376. See hero entry above. Receives the assembled `knowledge` prop summarizing booleans for `hasFacts/hasFaqs/hasHours/hasBooking/hasTransfer/hasSms/hasKnowledge/hasWebsite`.

### Section: Quick Setup (non-admin)

#### QuickSetupStrip (standalone, distinct from the inline strip in SettingsView)
**File:** [src/components/dashboard/settings/QuickSetupStrip.tsx](src/components/dashboard/settings/QuickSetupStrip.tsx)
**Visible-to:** non-admin
**Conditional rendering:** `!isAdmin`; auto-hides when `doneCount === items.length`
**What you see:** Pill strip of 4 items — Voice / Alerts / Hours / Knowledge — each with a coloured icon and a check or empty dot. Progress bar + "n/4 done" counter.
**What you can do:** Click any item → `onScrollTo(scrollTarget)` — scrolls to `section-voice-style`, `section-notifications`, `section-hours`, or `section-knowledge`.
**Columns it reads:** `agent_voice_id`, `telegram_notifications_enabled`, `email_notifications_enabled`, `business_hours_weekday`, `knowledge_backend` + `approved_knowledge_chunk_count`, `website_scrape_status`
**Columns it writes:** none
**API endpoints:** none
**Mutation class (from contract):** READ_MODEL_ONLY
**Sync side-effect on save:** N/A
**Where else these columns appear (cross-surface trace):** Inline `Quick Setup` strip in `SettingsView` (different 4-item list, includes Alerts via href instead of scroll), `SetupProgressRing`, Overview readiness band.
**Known issues:** None tracked. Note: there are two "Quick Setup" strips on one page — the inline strip in SettingsView (lines 253–352) and this standalone one rendered inside AgentTab (line 381). They overlap on Voice/Hours/Knowledge but differ on Alerts (href vs scroll).

### Section: Identity & Voice

#### AgentOverviewCard
**File:** [src/components/dashboard/settings/AgentOverviewCard.tsx](src/components/dashboard/settings/AgentOverviewCard.tsx)
**Visible-to:** admin
**Conditional rendering:** `isAdmin` only; spans 2 columns
**What you see:** Hero card with agent identity header (`AgentIdentityHeader`), editable agent name + display name footer, status pill (active/paused), minutes-used progress bar, SMS chip toggle (top right), Calendar modal trigger, `QuickInject` widget for `injected_note`, and `FieldSyncStatusChip` for `sms_enabled`. Voice picker via `VoicePicker` sub-component.
**What you can do:** Edit `agent_name` and `display_name`, toggle `sms_enabled`, open Calendar modal, run `QuickInject` to update `injected_note`, toggle agent status via `onToggleStatus` callback (which patches `status`).
**Columns it reads:** `agent_name`, `display_name`, `business_name`, `agent_voice_id`, `injected_note`, `twilio_number`, `seconds_used_this_month`, `monthly_minute_limit`, `bonus_minutes`, `sms_enabled`, `forwarding_number`, `booking_enabled`, `calendar_auth_status`, `knowledge_backend`, `system_prompt` (via `promptLength` prop)
**Columns it writes:** `agent_name`, `display_name`, `sms_enabled`, `injected_note` (via QuickInject child)
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** `agent_name` = DB_PLUS_PROMPT (triggersPatch:'agent_name'); `display_name` = DB_PLUS_PROMPT (triggersSync:true, triggersPatch:'slot_regen'); `sms_enabled` = DB_PLUS_TOOLS (triggersPatch:'sms'); `injected_note` = PER_CALL_CONTEXT_ONLY
**Sync side-effect on save:** Saving `agent_name` → `patchAgentName` word-boundary replace on `system_prompt`, prompt validate, prompt versioned, `computeNeedsSync` true via `system_prompt` string write → `syncToUltravox`. Saving `display_name` → `triggersPatch:'slot_regen'` route step 8b triggers `regenerateSlots(SLOT_IDS)` against the slot prompt → if regen worked, prompt overwritten + Ultravox auto-synced. Saving `sms_enabled` → `patchSmsBlock` adds/removes SMS instruction block + needsAgentSync true → `updateAgent` + tools rebuild. Saving `injected_note` → DB-only; takes effect on next call via `callerContextBlock`.
**Where else these columns appear (cross-surface trace):** `agent_name` — `IdentityModal` (Overview InlineModalsV2), `AgentIdentityCardCompact` (Overview), `home/InlineModalsV2`, `PromptVariablesCard` (read-only AGENT_NAME row), `TestCallCard` knowledge prop, `IvrMenuCard` default prompt template. `display_name` — only this card. `sms_enabled` — `SmsTab`, `NotificationsWidget` (hero), `InlineModalsV2.AfterCallModal`. `injected_note` — `QuickInject` (here), `InlineModalsV2.TodayUpdateModal` (Overview), `AdvancedContextCard` preview line. `business_name` — Sidebar, all dashboard headers, `IdentityModal`.
**Known issues:** Patcher warnings can silently fire if old agent name not found in prompt (mutation contract §7 Risk 5).

#### CallHandlingModeCard
**File:** [src/components/dashboard/settings/CallHandlingModeCard.tsx](src/components/dashboard/settings/CallHandlingModeCard.tsx)
**Visible-to:** admin
**Conditional rendering:** `isAdmin` only
**What you see:** Three-option selector — Message Taking / AI Receptionist / Receptionist + Booking. The full_service option shows a "Pro plan" amber lock unless `selected_plan='pro'` or trialing. `FieldSyncStatusChip` for `call_handling_mode`.
**What you can do:** Click a mode → immediate PATCH.
**Columns it reads:** `call_handling_mode`, `selected_plan`, `subscription_status`
**Columns it writes:** `call_handling_mode`
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** DB_PLUS_PROMPT (triggersSync:true, triggersPatch:'call_handling_mode')
**Sync side-effect on save:** `applyPromptPatches` → `patchCallHandlingMode(prompt, effectiveMode, closePerson)` rewrites the CALL HANDLING MODE block in `system_prompt` (warns "Mode saved — but your agent's prompt doesn't have a CALL HANDLING MODE section" if missing). If `current sms_enabled=true`, also refreshes the SMS block to match the new mode. `computeNeedsSync` returns true → `syncToUltravox` → `updateAgent` + tools rebuild.
**Where else these columns appear (cross-surface trace):** `AgentModeCard` (non-admin alternative), `applyPromptPatches` ctx, `GodModeCard` (admin deep-mode-activation flow), `voicemailFullRebuild` (detects `message_only` → triggers full rebuild instead of patching).
**Known issues:** Patcher warning fires silently on legacy prompts without section markers (mutation contract §7 Risk 5).

#### AgentModeCard
**File:** [src/components/dashboard/settings/AgentModeCard.tsx](src/components/dashboard/settings/AgentModeCard.tsx)
**Visible-to:** non-admin
**Conditional rendering:** `!isAdmin`
**What you see:** Four mode buttons — Lead capture / Voicemail replacement / Info hub / Appointment booking. Each shows a tagline. Has a preview-then-deploy 2-step flow with full prompt diff comparison ("Preview Change" → reviewed → "Deploy"). Cooldown timer for rate-limit. Shows "saved_not_synced" state when DB saved but Ultravox sync failed.
**What you can do:** Select a mode → Preview (calls `POST /api/dashboard/regenerate-prompt/preview`) → Deploy (calls `POST /api/dashboard/regenerate-prompt`). Each deploy fully regenerates the slot prompt with the new `agent_mode` baked in.
**Columns it reads:** `agent_mode`, `call_handling_mode`
**Columns it writes:** `agent_mode` (via regenerate-prompt route, which also rewrites `system_prompt`)
**API endpoints:** `POST /api/dashboard/regenerate-prompt/preview`, `POST /api/dashboard/regenerate-prompt`
**Mutation class (from contract):** DB_PLUS_PROMPT (triggersSync:true, triggersPatch:'agent_mode')
**Sync side-effect on save:** The regenerate-prompt route does its own full slot regen → writes `system_prompt` → calls `syncToUltravox` itself. Not via settings PATCH.
**Where else these columns appear (cross-surface trace):** `CallHandlingModeCard` (admin); `GodModeCard` deep-mode-activation panel (admin) does the same preview+deploy flow for `agent_mode`; `SmsTab` reads `agent_mode` to display the right mode hint.
**Known issues:** None tracked.

#### VoiceStyleCard
**File:** [src/components/dashboard/settings/VoiceStyleCard.tsx](src/components/dashboard/settings/VoiceStyleCard.tsx)
**Visible-to:** both
**Conditional rendering:** always
**What you see:** Four preset buttons — Casual & Friendly / Professional & Warm / Direct & Efficient / Empathetic & Patient — each with a radio-style dot. "Save Style" button. Inline confirmation: "Prompt updated & synced to agent" or "Saved to DB but agent sync failed".
**What you can do:** Select preset → click Save → PATCH.
**Columns it reads:** `voice_style_preset` (initial)
**Columns it writes:** `voice_style_preset`
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** DB_PLUS_PROMPT (triggersSync:false, triggersPatch:'voice_style')
**Sync side-effect on save:** `applyPromptPatches` → `patchVoiceStyleSection` replaces tone/style + filler-style sections in `system_prompt`; also `patchIdentityPersonality` rewrites the personality line in IDENTITY section. Prompt change → `computeNeedsSync` true via `system_prompt` write → `syncToUltravox`. Note `triggersSync` itself is false — sync only fires because the prompt was changed.
**Where else these columns appear (cross-surface trace):** `VoiceTab` (inline in Settings hero / general tab below grid), `AgentKnowledgeCard` (displays voice style label), `SetupProgressRing` (counts as "set" if not default).
**Known issues:** No FieldSyncStatusChip — surfaces sync status via local syncStatus state instead.

#### VoicemailGreetingCard
**File:** [src/components/dashboard/settings/VoicemailGreetingCard.tsx](src/components/dashboard/settings/VoicemailGreetingCard.tsx)
**Visible-to:** both
**Conditional rendering:** always
**What you see:** Textarea for voicemail greeting text, default placeholder built from business_name. Note about audio greeting being admin-uploaded if present.
**What you can do:** Edit text → click Save.
**Columns it reads:** `voicemail_greeting_text`, `voicemail_greeting_audio_url`, `business_name`
**Columns it writes:** `voicemail_greeting_text`
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** DB_ONLY
**Sync side-effect on save:** None. Read at call time by inbound webhook fallback path only (when Ultravox is unreachable). `triggersSync:false`, no patcher.
**Where else these columns appear (cross-surface trace):** `InlineModalsV2.VoicemailModal` (Overview).
**Known issues:** No FieldSyncStatusChip; fallback-path only field, so silent-save risk is low.

#### SectionEditorCard ("Agent Identity" instance)
**File:** [src/components/dashboard/settings/SectionEditorCard.tsx](src/components/dashboard/settings/SectionEditorCard.tsx) (instantiated 3 times across the grid — `identity`, `knowledge`, `triage`)
**Visible-to:** admin
**Conditional rendering:** `isAdmin` (this instance — section_id='identity')
**What you see:** Collapsible card titled "Agent Identity" with a textarea. Top-of-card warning if the section marker is not present in the prompt — "wasn't found in your prompt — saving will add it automatically" or "exists in your prompt without tracking markers — saving will replace it with a tracked version".
**What you can do:** Edit section content → Save → bypasses `usePatchSettings` and posts directly to `PATCH /api/dashboard/settings` with `{section_id, section_content}`.
**Columns it reads:** none (initial content from parsed `sectionContent[client.id].identity`)
**Columns it writes:** writes `system_prompt` indirectly via `section_id` / `section_content` body
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** DB_PLUS_PROMPT (section_id/content go through `replacePromptSection` in `applyPromptPatches` step 1)
**Sync side-effect on save:** Route does role check via `isSectionEditAllowed` (admin-only for `tone`/`flow`/`technical`, owner-editable for others). `applyPromptPatches` step 1 calls `replacePromptSection(prompt, section_id, section_content)` → if prompt changed, prompt written + `computeNeedsSync` true via system_prompt → `syncToUltravox`. Prompt also versioned in step 10.
**Where else these columns appear (cross-surface trace):** Knowledge and Triage section variants of this same card render lower in the grid.
**Known issues:** Bypasses `usePatchSettings`, so no FieldSyncStatusChip wiring + no shared serialization queue. `triage` section has an extra caveat documented in `CallRoutingCard` re: SECTION_HEADER_ALIASES.

### Section: Knowledge

#### PromptVariablesCard (D283b / D358 — the "lego pieces" card)
**File:** [src/components/dashboard/settings/PromptVariablesCard.tsx](src/components/dashboard/settings/PromptVariablesCard.tsx)
**Visible-to:** both
**Conditional rendering:** always (spans 2 cols)
**What you see:** Five collapsible variable groups — Identity (AGENT_NAME, BUSINESS_NAME, CLOSE_PERSON, CITY), Opening & closing (GREETING_LINE, CLOSING_LINE), Services & knowledge (SERVICES_OFFERED, SERVICES_NOT_OFFERED, FAQ_PAIRS), Call routing (TRIAGE_DEEP, URGENCY_KEYWORDS), Guardrails (FORBIDDEN_EXTRA). Each row shows current value (or italic "Not set"). Hover to reveal Edit button. Variables that have a dedicated card (TONE_STYLE_BLOCK, FILLER_STYLE, HOURS_WEEKDAY, TRANSFER_ENABLED, AFTER_HOURS_BLOCK, PRICING_POLICY, UNKNOWN_ANSWER_BEHAVIOR, PRIMARY_GOAL) render read-only with "via Settings" pill.
**What you can do:** Edit a row → Preview diff (calls `POST /api/dashboard/variables/preview`) → Save (calls `POST /api/dashboard/variables`). Each save sends `{variableKey, value}`.
**Columns it reads:** Variables resolved by `PROMPT_VARIABLE_REGISTRY` from many underlying columns (mostly `niche_custom_variables`, `agent_name`, `business_name`, `owner_name`, `city`, `extra_qa`, `services_offered`).
**Columns it writes:** `niche_custom_variables` (merged), and depending on key, can also write `agent_name`/`business_name`/`owner_name`/`city`/`services_offered`/`extra_qa` directly via the variables route
**API endpoints:** `GET /api/dashboard/variables`, `POST /api/dashboard/variables/preview`, `POST /api/dashboard/variables` (NOT the settings PATCH route)
**Mutation class (from contract):** DB_PLUS_PROMPT (slot_regen path) — the variables route writes the field then runs `regenerateSlots` to rebuild the slot prompt, which mirrors the route.ts step 8b path.
**Sync side-effect on save:** Variables route calls `regenerateSlots` + `syncToUltravox` itself. The card calls `recordFieldSyncStatus` directly via the imported module-level function to populate the shared `fieldSyncCache` — so the row can render its own `SyncStatusChip` for `GREETING_LINE` only (D449 Phase 1 wired keys). If `regenerateSlots` returns the legacy-prompt no-op marker (`'Old-format prompt without section markers — use patchers instead of regeneration'`), the chip renders `legacy_prompt_patcher_noop`.
**Where else these columns appear (cross-surface trace):** Identity vars overlap with `AgentOverviewCard` (`agent_name`, `business_name`), `home/InlineModalsV2.IdentityModal`, `home/InlineModalsV2.GreetingModal` (GREETING_LINE specifically — the **D442 known fake-control surface on 4/5 legacy clients**). Services/FAQ vars overlap `ServicesOfferedCard`, `AgentKnowledgeCard`, `home/InlineModalsV2.FaqsModal`/`ServicesModal`. TRIAGE_DEEP also written by `CallRoutingCard` (which also writes section_id='triage' on top of `niche_custom_variables`). Per-niche PM vars (niche_petPolicy etc.) written by `PmConfigCard`.
**Known issues:** **D442 fake-control class.** Per `CALLINGAGENTS/00-Inbox/overview-drift-audit-2026-04-30.md`, GREETING_LINE saves succeed at DB but no-op at prompt level on 4/5 active clients because `hasSlotMarkers()` is false on their legacy prompts. The card surfaces this only for `GREETING_LINE` (Phase 1 wired). All other variable rows have NO chip and silently fail in the same way for legacy clients. PROMPT_VARIABLE_REGISTRY[GREETING_LINE].editable=false per D442 §1 but the variables PATCH route does not enforce the editable flag (D443).

#### ServicesOfferedCard
**File:** [src/components/dashboard/settings/ServicesOfferedCard.tsx](src/components/dashboard/settings/ServicesOfferedCard.tsx)
**Visible-to:** both
**Conditional rendering:** always
**What you see:** Single textarea showing current `services_offered`. "sourced from GBP/onboarding" hint if value is set. Inline patcher-warning amber strip when `patchServicesOffered` returns no-op.
**What you can do:** Edit → Save.
**Columns it reads:** `services_offered`
**Columns it writes:** `services_offered`
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** DB_PLUS_PROMPT (triggersSync:false, triggersPatch:'services')
**Sync side-effect on save:** `applyPromptPatches` → `patchServicesOffered` finds the SERVICES OFFERED section and replaces it. If patcher no-ops, pushes warning "Services saved — but your agent's prompt doesn't use the standard format". If prompt changed → versioned + `computeNeedsSync` true via system_prompt → `syncToUltravox`. Also: `services_offered` is in `LOW_STAKES_REGEN_FIELDS` (line 254 of route.ts) → after save, `scheduleAutoRegen` is fired non-blocking to do a full slot rebuild.
**Where else these columns appear (cross-surface trace):** `PromptVariablesCard` (SERVICES_OFFERED read-only when registered as dedicated card key — actually it's NOT in DEDICATED_CARD_KEYS, so it's editable from both places), `InlineModalsV2.ServicesModal`, `AgentKnowledgeCard` (count display), `AgentKnowsCard` (Overview).
**Known issues:** Patcher silently no-ops on legacy prompts → warning shown but value still saved (D442 fake-control variant).

#### AgentKnowledgeCard
**File:** [src/components/dashboard/settings/AgentKnowledgeCard.tsx](src/components/dashboard/settings/AgentKnowledgeCard.tsx)
**Visible-to:** both
**Conditional rendering:** always
**What you see:** 6-tile stat grid — Business Facts (count), Q&A Pairs (count), Hours (Set/Not set), Booking (Connected/Off), Voice Style (preset label), Knowledge Docs (Active/Off). Always-on blue info banner. Knowledge sources breakdown (pill list per source) when pgvector + chunks exist. Quick add Q&A inputs OR Paste text → `KnowledgeTextInput`. Website nudge link when no website. Reseed confirmation line when last save triggered reseed.
**What you can do:** Quick-add Q&A pair → PATCH `extra_qa` merged. Click "Paste text" → opens `KnowledgeTextInput` (separate component, writes via `/api/dashboard/knowledge/text-add`). Click amber website nudge → `/dashboard/knowledge?add=website`.
**Columns it reads:** `business_facts`, `extra_qa`, `business_hours_weekday`, `booking_enabled`, `calendar_auth_status`, `voice_style_preset`, `knowledge_backend`, `website_scrape_status`; also `knowledge_chunks` stats via `GET /api/dashboard/knowledge/stats`
**Columns it writes:** `extra_qa` (via Quick add)
**API endpoints:** `PATCH /api/dashboard/settings`, `GET /api/dashboard/knowledge/stats`
**Mutation class (from contract):** DB_PLUS_KNOWLEDGE_PIPELINE (extra_qa)
**Sync side-effect on save:** Settings PATCH step 8: `business_facts`/`extra_qa` change + `knowledge_backend='pgvector'` → fires `reseedKnowledgeFromSettings()` (fire-and-forget). `knowledgeReseeded=true` → `computeNeedsSync` true → `syncToUltravox` to re-register `queryKnowledge` tool. Also `extra_qa` is in `LOW_STAKES_REGEN_FIELDS` → `scheduleAutoRegen` fires.
**Where else these columns appear (cross-surface trace):** `AdvancedContextCard` (admin full editor), `KnowledgeEngineCard`, `PromptEditorModal` (hero), `PromptVariablesCard` (FAQ_PAIRS row), `InlineModalsV2.FaqsModal`, Overview `AgentKnowsCard`, Knowledge page `KnowledgePageView`.
**Known issues:** None card-level; Quick-add Q&A inherits the standard reseed pipeline. The stats grid mixes "always-known" (`business_facts`/`extra_qa` — injected via `businessFacts` templateContext) with "searchable" (`knowledge_backend='pgvector'` chunks) — the info banner says "Always knows" but Knowledge Docs tile is a different storage layer.

#### AdvancedContextCard
**File:** [src/components/dashboard/settings/AdvancedContextCard.tsx](src/components/dashboard/settings/AdvancedContextCard.tsx)
**Visible-to:** admin (spans 3 cols)
**Conditional rendering:** `isAdmin`
**What you see:** Big card titled "Advanced Context". Textareas for `business_facts` (newline-list) and `extra_qa` (Q/A pair array). Read-only `context_data`/`context_data_label` displays (admin edits via `ContextDataCard` for PM niche only). "Assembled preview" collapse showing what the agent will see in the callerContext + businessFacts + contextData blocks at call time — formatted as `[TODAY/CURRENT TIME/CALLER PHONE]` block + facts + Q&A + reference data + knowledge hint.
**What you can do:** Edit facts + Q&A → Save (single PATCH bundling 4 fields). Toggle prompt preview / context preview collapses.
**Columns it reads:** `business_facts`, `extra_qa`, `context_data`, `context_data_label`, `injected_note`, `knowledge_backend`, `timezone`, `system_prompt`
**Columns it writes:** `business_facts`, `extra_qa`, `context_data`, `context_data_label`
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** DB_PLUS_KNOWLEDGE_PIPELINE (business_facts, extra_qa); PER_CALL_CONTEXT_ONLY (context_data, context_data_label)
**Sync side-effect on save:** Step 8 reseed if pgvector + facts/qa changed → `syncToUltravox`. `context_data` change has no sync — injected via `templateContext.contextData` at call time. Also: `business_facts` and `context_data` are in `LOW_STAKES_REGEN_FIELDS` → `scheduleAutoRegen` fires.
**Where else these columns appear (cross-surface trace):** `AgentKnowledgeCard`, `KnowledgeEngineCard`, `PromptEditorModal`, `PromptVariablesCard` (FAQ_PAIRS row), Overview `AgentKnowsCard`, `InlineModalsV2.FaqsModal`/`TodayUpdateModal`, `PmSetupChecklist` (context_data tenant count), `ContextDataCard` (PM-specific reference editor), `CapabilitiesCard` (`hasContextData` prop).
**Known issues:** None tracked. The "assembled preview" is purely cosmetic — it does not call the server to assemble — so what it shows can drift from the real `buildAgentContext()` output if the assembly logic changes.

#### KnowledgeEngineCard
**File:** [src/components/dashboard/settings/KnowledgeEngineCard.tsx](src/components/dashboard/settings/KnowledgeEngineCard.tsx)
**Visible-to:** admin (PlanGate `feature='knowledge'`)
**Conditional rendering:** `isAdmin` and inside `<PlanGate feature='knowledge'>`
**What you see:** Collapsible card. Header with title "Knowledge Engine" + premium toggle for pgvector backend + `FieldSyncStatusChip` for `knowledge_backend`. When expanded: stats grid (total/approved/pending/rejected/by-type/by-source), gap badges, expandable sections — `ChunkBrowserSection`, `GapAnswerSection`, `TestQuerySection`.
**What you can do:** Toggle pgvector backend (calls PATCH directly, sets `recordFieldSyncStatus` manually). Browse chunks, answer unresolved gaps, run test queries against the knowledge index.
**Columns it reads:** `knowledge_backend`; `knowledge_chunks` table (stats); `knowledge_query_log` (gaps)
**Columns it writes:** `knowledge_backend`; `knowledge_chunks` (via answer-gap/chunk-edit subroutes)
**API endpoints:** `PATCH /api/dashboard/settings`, `GET /api/dashboard/knowledge/stats`, `GET /api/dashboard/knowledge/gaps`, plus sub-section routes
**Mutation class (from contract):** DB_PLUS_TOOLS (knowledge_backend, admin-only); DB_PLUS_KNOWLEDGE_PIPELINE (chunk operations)
**Sync side-effect on save:** `knowledge_backend` is in sync-trigger list → `computeNeedsSync` true → `syncToUltravox` registers/de-registers `queryKnowledge` tool (also requires approved chunks > 0 to actually register).
**Where else these columns appear (cross-surface trace):** `AgentKnowledgeCard` (reads same stats), Knowledge page (`KnowledgePageView`), `CapabilitiesCard.hasKnowledge`.
**Known issues:** None tracked. Field sync chip wired correctly.

#### WebsiteKnowledgeCard, WebsiteSourcesList
**Files:** [src/components/dashboard/settings/WebsiteKnowledgeCard.tsx](src/components/dashboard/settings/WebsiteKnowledgeCard.tsx), [src/components/dashboard/settings/WebsiteSourcesList.tsx](src/components/dashboard/settings/WebsiteSourcesList.tsx)
**Visible-to:** admin
**Conditional rendering:** `isAdmin` + `<PlanGate feature='knowledge'>`
**What you see:** Website URL input, scrape trigger, preview of extracted chunks awaiting approval, sources list with status.
**What you can do:** Enter website URL → trigger scrape → review + approve chunks. Approve/reject extracted content → embeds into `knowledge_chunks`.
**Columns it reads:** `website_url`, `website_scrape_status`, knowledge_chunks with `source='website_scrape'`
**Columns it writes:** `website_url` (PATCH settings); knowledge approval writes `knowledge_chunks.status`
**API endpoints:** `POST /api/dashboard/scrape-website`, knowledge approval routes
**Mutation class (from contract):** DB_ONLY for `website_url`; DB_PLUS_KNOWLEDGE_PIPELINE for chunk approval (`seedKnowledgeFromScrape`)
**Sync side-effect on save:** `website_url` save is decoupled from scrape (contract §2 row "website_url" — known UX gap). Chunk approval runs `embedChunks` → `syncClientTools` → `clients.tools` rewrite to register `queryKnowledge` once first chunks land.
**Where else these columns appear (cross-surface trace):** `AgentKnowledgeCard` (website nudge link), Knowledge page (primary surface), `CapabilitiesCard.hasWebsite`.
**Known issues:** Saving URL gives no visible feedback that a separate scrape must run.

#### SectionEditorCard ("Knowledge Base" instance)
Same component as Identity instance above; section_id='knowledge'. Admin-only. Same PATCH path through `replacePromptSection`.

### Section: Capabilities & Routing

#### "Answering schedule" link card (non-admin)
**File:** inline in [AgentTab.tsx](src/components/dashboard/settings/AgentTab.tsx) lines 554–562
**Visible-to:** non-admin
**Conditional rendering:** `!isAdmin`
**What you see:** Single row card "Answering schedule / Configure when your agent answers calls / Go Live →"
**What you can do:** Click → `/dashboard/go-live`
**Columns it reads:** none
**Columns it writes:** none
**API endpoints:** none
**Mutation class:** N/A — deep link only
**Sync side-effect on save:** N/A
**Where else these columns appear (cross-surface trace):** `/dashboard/go-live` is the destination, where `HoursFields`, `GreetingFields`, etc. write the hours columns.
**Known issues:** None.

#### CallRoutingCard
**File:** [src/components/dashboard/settings/CallRoutingCard.tsx](src/components/dashboard/settings/CallRoutingCard.tsx)
**Visible-to:** both (spans 3 cols)
**Conditional rendering:** always
**What you see:** "Call Routing" card with 3 numbered text inputs for caller reasons (niche-specific placeholders). Status pill "Routing active" when `TRIAGE_DEEP` exists in `niche_custom_variables`. "Generate routing" / "Update routing" button.
**What you can do:** Fill in reasons → Generate → calls `POST /api/onboard/infer-niche` → returns custom variables (TRIAGE_DEEP) → saves via TWO sequential PATCHes: (a) `niche_custom_variables` merge with TRIAGE_DEEP + `_caller_reasons` JSON, then (b) `section_id='triage'` + `section_content=triage` to also patch the live prompt's TRIAGE section.
**Columns it reads:** `niche_custom_variables`, `business_name`, `niche`
**Columns it writes:** `niche_custom_variables` (TRIAGE_DEEP + _caller_reasons), `system_prompt` (via section_id='triage' second PATCH)
**API endpoints:** `POST /api/onboard/infer-niche`, `PATCH /api/dashboard/settings` (×2)
**Mutation class (from contract):** DB_PLUS_PROMPT (niche_custom_variables triggers slot_regen + section_id='triage' triggers section patch)
**Sync side-effect on save:** First PATCH (niche_custom_variables) → step 8b `regenerateSlots(SLOT_IDS)` → if regen worked, prompt overwritten + auto-Ultravox-sync. Second PATCH (section_id='triage') → `replacePromptSection` finds `## 3. TRIAGE` via SECTION_HEADER_ALIASES → if section actually replaced, prompt changed → `computeNeedsSync` true → `syncToUltravox`.
**Where else these columns appear (cross-surface trace):** `PromptVariablesCard` (TRIAGE_DEEP row), `SectionEditorCard` for triage (admin), `GodModeCard` (admin niche override), `PmConfigCard` (different niche-var keys).
**Known issues:** Bypasses `usePatchSettings` (uses raw `fetch`). No FieldSyncStatusChip. The comment block in the file (lines 17–25) flags that `triage` SECTION_HEADER_ALIASES support has gone in — D256 was completed. For legacy clients, the section patch also no-ops if `## 3. TRIAGE` isn't there.

#### SectionEditorCard ("Call Routing Script" / triage instance)
section_id='triage'. Both admin and non-admin write here (admin gating only for `tone`/`flow`/`technical`). See SectionEditorCard description above.

#### PmConfigCard (PM niche only)
**File:** [src/components/dashboard/settings/PmConfigCard.tsx](src/components/dashboard/settings/PmConfigCard.tsx)
**Visible-to:** both
**Conditional rendering:** `niche === 'property_management'` (col-span-full)
**What you see:** Card with Save button. Inputs for: emergency phone, maintenance contacts (multi-line), pet policy, parking, package handling.
**What you can do:** Edit fields → Save → bundled PATCH of `niche_custom_variables` (merge of `niche_petPolicy`, `niche_parkingPolicy`, `niche_packagePolicy`, `niche_maintenanceContacts`) + `after_hours_emergency_phone`.
**Columns it reads:** `niche_custom_variables.niche_*`, `after_hours_emergency_phone`
**Columns it writes:** `niche_custom_variables` (merged), `after_hours_emergency_phone`
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** DB_PLUS_PROMPT (niche_custom_variables → slot_regen); PER_CALL_CONTEXT_ONLY (after_hours_emergency_phone)
**Sync side-effect on save:** `niche_custom_variables` triggers step 8b `regenerateSlots(SLOT_IDS)` → prompt rebuilt → auto-sync. `after_hours_emergency_phone` is per-call injected, no sync.
**Where else these columns appear (cross-surface trace):** `PmSetupChecklist` (reads same niche_vars), `HoursCard` (after_hours_emergency_phone), `PromptVariablesCard` (won't show these — they're not in the registry's variable groups).
**Known issues:** Same legacy-prompt no-op risk as `PromptVariablesCard` — if `hasSlotMarkers()=false`, slot regen returns the marker string and DB save sticks but prompt doesn't update. No FieldSyncStatusChip surface.

#### BookingCard
**File:** [src/components/dashboard/settings/BookingCard.tsx](src/components/dashboard/settings/BookingCard.tsx)
**Visible-to:** admin (non-admin sees a link card to `/dashboard/actions`)
**Conditional rendering:** `hasCapability(niche, 'bookAppointments')` + `<PlanGate feature='booking'>` + `isAdmin`
**What you see:** Emerald-tinted card. "Booking enabled" `PremiumToggle` + `FieldSyncStatusChip` for `booking_enabled`. Connection-status row (connected / expired). "Connect Google Calendar" button. Duration + buffer dropdowns when enabled.
**What you can do:** Toggle booking, redirect to `/api/auth/google` for OAuth, edit duration + buffer (saves as `booking_service_duration_minutes`, `booking_buffer_minutes`).
**Columns it reads:** `calendar_auth_status`, `google_calendar_id`, `booking_service_duration_minutes`, `booking_buffer_minutes`, `booking_enabled`
**Columns it writes:** `booking_enabled`, `booking_service_duration_minutes`, `booking_buffer_minutes`
**API endpoints:** `PATCH /api/dashboard/settings`, OAuth redirect to `/api/auth/google`
**Mutation class (from contract):** DB_PLUS_PROMPT_PLUS_TOOLS (booking_enabled); DB_ONLY (duration, buffer)
**Sync side-effect on save:** `booking_enabled` change → `patchCalendarBlock` adds/removes CALENDAR BOOKING FLOW block in prompt; `computeNeedsSync` true → `syncToUltravox` → `buildAgentTools` adds/removes `checkCalendarAvailability` + `bookAppointment` tools. Step 8c: if `booking_enabled` change AND slot regen didn't already fire → `regenerateSlots(['conversation_flow', 'goal'])` (D276). Step 9 also does the post-enable verification fetch to confirm calendar tools landed on the live Ultravox agent.
**Where else these columns appear (cross-surface trace):** `actions/BookingSettingsSection.tsx` (Actions page primary editor), `InlineModalsV2.CalendarModal` (Overview), `AgentKnowledgeCard` (count display), `AgentOverviewCard` (Calendar modal trigger), `CapabilitiesCard.hasBooking`, `ActionItems.tsx` (Overview tile), `StaffRosterCard` (gated on booking_enabled).
**Known issues:** UI requires `calendar_auth_status='connected'` but agent tool registers regardless of auth status (mutation contract §7 Risk 1, intentional). `calendar_auth_status` writable only via OAuth callback.

#### StaffRosterCard
**File:** [src/components/dashboard/settings/StaffRosterCard.tsx](src/components/dashboard/settings/StaffRosterCard.tsx)
**Visible-to:** both
**Conditional rendering:** `hasCapability(niche, 'bookAppointments')` + `<PlanGate feature='booking'>`
**What you see:** Emerald-tinted card "Team Members". List of staff with role + availability note + remove button. "+ Add member" form (name/role/availability). When `bookingEnabled=false`: "Enable booking to manage team members." message.
**What you can do:** Add/remove staff. Each operation triggers PATCH `staff_roster`.
**Columns it reads:** `staff_roster`, `booking_enabled`
**Columns it writes:** `staff_roster`
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** PER_CALL_CONTEXT_ONLY
**Sync side-effect on save:** None. `triggersSync:false`. Injected at call time as part of `businessFacts` or staff-roster context (not via agent sync).
**Where else these columns appear (cross-surface trace):** Only this card writes `staff_roster`.
**Known issues:** No FieldSyncStatusChip. Per-call context — silent save is by design but unverifiable from UI.

#### IvrMenuCard
**File:** [src/components/dashboard/settings/IvrMenuCard.tsx](src/components/dashboard/settings/IvrMenuCard.tsx)
**Visible-to:** both
**Conditional rendering:** always (in section `Capabilities & Routing`)
**What you see:** "Voicemail Menu (IVR)" card. Toggle "Enable voicemail menu". When enabled: a textarea with default placeholder `"Press 1 for voicemail, or stay on the line..."`.
**What you can do:** Toggle enabled, edit prompt text, click Save.
**Columns it reads:** `ivr_enabled`, `ivr_prompt`, `business_name`, `agent_name`
**Columns it writes:** `ivr_enabled`, `ivr_prompt`
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** DB_ONLY for both
**Sync side-effect on save:** None. Read at call time by inbound webhook gate (returns `<Gather>` TwiML when `ivr_enabled=true`). No prompt patch, no agent sync.
**Where else these columns appear (cross-surface trace):** `InlineModalsV2.IvrModal` (Overview), `CapabilitiesCard.hasIvr`.
**Known issues:** No FieldSyncStatusChip. DB-only field — silent save is by design.

#### VIPContactsCard
**File:** [src/components/dashboard/settings/VIPContactsCard.tsx](src/components/dashboard/settings/VIPContactsCard.tsx)
**Visible-to:** both
**Conditional rendering:** `<PlanGate feature='transfer'>`
**What you see:** List of VIP contacts with name/phone/relationship/notes/transfer toggle. "+ Add Contact" form. Amber warning when no `forwarding_number` set ("live transfer won't be possible").
**What you can do:** Add/edit/remove VIP contacts; toggle `transfer_enabled` per contact.
**Columns it reads:** `client_contacts` table (filtered to `is_vip=true`); `forwarding_number` (for warning)
**Columns it writes:** `client_contacts` (insert/PATCH/soft-delete via `is_vip=false`)
**API endpoints:** `GET/POST/PATCH /api/dashboard/contacts` — NOT the settings PATCH route
**Mutation class (from contract):** Not in the settings FIELD_REGISTRY — this is a separate table.
**Sync side-effect on save:** None at agent level. VIP behavior is runtime — agent checks caller phone against `client_contacts` at call time.
**Where else these columns appear (cross-surface trace):** Only this card edits `client_contacts.is_vip`. `forwarding_number` shown for warning only — actually edited by `SetupCard`/`InlineModalsV2.TransferModal`.
**Known issues:** None tracked at card level. Note `forwarding_number` warning is the only cross-card data dependency surfaced.

### Section: Agent Script

#### PromptEditorCard
**File:** [src/components/dashboard/settings/PromptEditorCard.tsx](src/components/dashboard/settings/PromptEditorCard.tsx)
**Visible-to:** both (spans 3 cols)
**Conditional rendering:** always; collapsed by default for admin only
**What you see:** Full system_prompt textarea, char counter, "change description" optional field. "Save" button. "Regenerate Prompt" button (calls full slot rebuild). Inline display of `ultravox_warning`, `prompt_warnings` returned by route.
**What you can do:** Edit `system_prompt` directly, save (bypasses `usePatchSettings` — uses raw fetch). Regenerate (calls `POST /api/dashboard/regenerate-prompt`). Receives 429 cooldown response.
**Columns it reads:** `system_prompt`, `agent_name`, `business_name`, `sms_enabled`, `forwarding_number`, `booking_enabled`, `calendar_auth_status`, `business_hours_weekday`, `business_facts`, `extra_qa`, `context_data`, `context_data_label`, `status`, `knowledge_backend`
**Columns it writes:** `system_prompt` (direct, with `change_description`)
**API endpoints:** `PATCH /api/dashboard/settings`, `POST /api/dashboard/regenerate-prompt`
**Mutation class (from contract):** DB_PLUS_PROMPT (direct system_prompt write)
**Sync side-effect on save:** Direct system_prompt write → `validatePrompt` → DB save → `computeNeedsSync` true (system_prompt path) → `syncToUltravox` → `updateAgent` + tools rebuild + version stored. Regenerate calls the regen route which does its own slot rebuild + sync.
**Where else these columns appear (cross-surface trace):** `PromptEditorModal` (hero overlay — also writes system_prompt direct), `SectionEditorCard` (writes via section_id), all the surgical patchers fire system_prompt rewrites indirectly. `system_prompt` is the single most fanned-out column.
**Known issues:** Uses raw `fetch`, not `usePatchSettings` — so no shared serialization and no FieldSyncStatusChip. Can race with `AgentOverviewCard` (which uses `usePatchSettings` per client serialization).

#### ImprovePromptCard
**File:** [src/components/dashboard/settings/ImprovePromptCard.tsx](src/components/dashboard/settings/ImprovePromptCard.tsx)
**Visible-to:** admin
**Conditional rendering:** `isAdmin`
**What you see:** Purple-tinted card "AI Improve" with "Beta" pill. "Generate Improvement" button. Shows changes summary with apply/dismiss controls.
**What you can do:** Generate (`POST /api/dashboard/settings/improve-prompt`) → reviews last 10 calls + current prompt → returns suggested rewrite with rationale. Apply → calls parent `onApply(improved_prompt)` which sets the local prompt state in `AgentTab` (does NOT save — user must click Save in `PromptEditorCard`).
**Columns it reads:** `system_prompt`, `call_logs` (last 10)
**Columns it writes:** none directly — produces a draft for `PromptEditorCard`
**API endpoints:** `POST /api/dashboard/settings/improve-prompt`
**Mutation class:** N/A — read-only suggestion engine
**Sync side-effect on save:** N/A (save happens through PromptEditorCard)
**Where else these columns appear (cross-surface trace):** Only this card uses the improve route.
**Known issues:** None tracked.

#### PromptVersionsCard
**File:** [src/components/dashboard/settings/PromptVersionsCard.tsx](src/components/dashboard/settings/PromptVersionsCard.tsx)
**Visible-to:** admin
**Conditional rendering:** `isAdmin`
**What you see:** Collapsible "Prompt History" card. When opened: list of prompt versions with `change_description`, char_count, role, timestamp. View / Restore actions.
**What you can do:** View any version inline; Restore → posts `version_id` to restore endpoint, which sets that version active + writes `system_prompt` back, then refreshes the parent state.
**Columns it reads:** `prompt_versions` table
**Columns it writes:** `clients.system_prompt`, `clients.active_prompt_version_id` (via restore route)
**API endpoints:** `GET /api/dashboard/settings/prompt-versions`, `POST /api/dashboard/settings/prompt-versions`
**Mutation class (from contract):** DB_PLUS_PROMPT (restore overwrites system_prompt)
**Sync side-effect on save:** Restore route should run the same sync path as a normal system_prompt write (writes prompt + triggers needsAgentSync).
**Where else these columns appear (cross-surface trace):** `ActivityLog` shows the same versions in a read-only timeline.
**Known issues:** None tracked.

#### OutboundAgentConfigCard
**File:** [src/components/dashboard/OutboundAgentConfigCard.tsx](src/components/dashboard/OutboundAgentConfigCard.tsx) (note: not in settings/ subdir)
**Visible-to:** both
**Conditional rendering:** always (when `hasPhoneNumber=false`, renders only a "Upgrade for outbound" stub)
**What you see:** Goal textarea, tone radios (warm/professional/direct), opening line textarea with variable-insert buttons (`{{AGENT_NAME}}`, etc), voicemail script textarea, optional call notes. Preview shows assembled prompt.
**What you can do:** Edit fields → Save → bundled PATCH of `outbound_goal`, `outbound_tone`, `outbound_opening`, `outbound_vm_script`, `outbound_notes`, and the assembled `outbound_prompt`.
**Columns it reads:** `outbound_prompt`, `outbound_goal`, `outbound_opening`, `outbound_vm_script`, `outbound_tone`, `outbound_notes`, `twilio_number` (gate)
**Columns it writes:** `outbound_prompt`, `outbound_goal`, `outbound_opening`, `outbound_vm_script`, `outbound_tone`, `outbound_notes`
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** DB_ONLY for all outbound_* fields
**Sync side-effect on save:** None — outbound is a separate prompt and there's no inbound agent sync triggered.
**Where else these columns appear (cross-surface trace):** `actions/OutboundSchedulingCard.tsx` writes `outbound_enabled`, `outbound_number`, `outbound_time_window_*`, `outbound_max_attempts`.
**Known issues:** No FieldSyncStatusChip — but `triggersSync:false` so silent-save is by design. No outbound dialer exists in codebase per call-path matrix §1F — these fields are written but currently consumed only by the planned campaign dialer.

#### LearningLoopCard
**File:** [src/components/dashboard/settings/LearningLoopCard.tsx](src/components/dashboard/settings/LearningLoopCard.tsx)
**Visible-to:** both
**Conditional rendering:** `<PlanGate feature='learningLoop'>`; can be dismissed via sessionStorage flag
**What you see:** "Checking call patterns…" → "Analyzing…" → either: ready banner with N recommendations + "Review Improvements" button, OR idle "Agent is performing well".
**What you can do:** Click "Review Improvements" → `onRequestImprovement` callback (admin only) scrolls to `ImprovePromptCard`. Dismiss → sessionStorage flag.
**Columns it reads:** `GET /api/dashboard/settings/learning-status` (which reads `call_logs` aggregates + `pending_loop_suggestion`)
**Columns it writes:** Through `POST /api/dashboard/analyze-now` (may write `pending_loop_suggestion`)
**API endpoints:** `GET /api/dashboard/settings/learning-status`, `POST /api/dashboard/analyze-now`
**Mutation class:** DB_ONLY for `pending_loop_suggestion` (registered in FIELD_REGISTRY as DB_ONLY)
**Sync side-effect on save:** None (suggestion writes don't reach agent — they're pending review).
**Where else these columns appear (cross-surface trace):** `PromptSuggestionsCard` (the user-facing review surface).
**Known issues:** None tracked.

#### PromptSuggestionsCard
**File:** [src/components/dashboard/settings/PromptSuggestionsCard.tsx](src/components/dashboard/settings/PromptSuggestionsCard.tsx)
**Visible-to:** both
**Conditional rendering:** `<PlanGate feature='learningLoop'>`
**What you see:** List of pending suggestions, each with a trigger label (Unanswered Q / Frustration / Feature Gap / Low Conf.) and section label. Dismiss + "Go to section" buttons.
**What you can do:** Dismiss a suggestion (`POST /api/dashboard/prompt-suggestions`); click "Go to section" → `onScrollTo(section_id)` to deep-link in this same Settings page.
**Columns it reads:** `prompt_suggestions` table via `GET /api/dashboard/prompt-suggestions`
**Columns it writes:** `prompt_suggestions` (dismiss action)
**API endpoints:** `GET/POST /api/dashboard/prompt-suggestions`
**Mutation class:** N/A — separate table from `clients`
**Sync side-effect on save:** None.
**Where else these columns appear (cross-surface trace):** Only this card.
**Known issues:** None tracked.

### Section: Configuration (admin)

#### AgentConfigCard
**File:** [src/components/dashboard/settings/AgentConfigCard.tsx](src/components/dashboard/settings/AgentConfigCard.tsx)
**Visible-to:** admin
**Conditional rendering:** `isAdmin`
**What you see:** Read-only display of: Voice (with `KNOWN_VOICES` lookup), AI Model (hardcoded "Ultravox v0.7 (fixie-ai)"), Client ID, Telegram Chat. "Re-sync Agent" button at bottom that pushes the stored prompt to Ultravox.
**What you can do:** Copy any field, click "Re-sync Agent" → `POST /api/dashboard/settings/sync-agent` (pushes current `system_prompt` to Ultravox without rebuilding).
**Columns it reads:** `agent_voice_id`, `ultravox_agent_id`, `telegram_chat_id`
**Columns it writes:** none directly; sync-agent route may update `last_agent_sync_at`/`last_agent_sync_status`
**API endpoints:** `POST /api/dashboard/settings/sync-agent`
**Mutation class:** READ_MODEL_ONLY (display) + sync utility
**Sync side-effect on save:** Re-sync = explicit `updateAgent()` call.
**Where else these columns appear (cross-surface trace):** `VoiceTab`, `VoicePicker`, `GodModeCard`.
**Known issues:** None tracked.

#### WebhooksCard
**File:** [src/components/dashboard/settings/WebhooksCard.tsx](src/components/dashboard/settings/WebhooksCard.tsx)
**Visible-to:** admin
**Conditional rendering:** `isAdmin`
**What you see:** Collapsible "Developer Settings" with read-only URL rows — Inbound URL, Completed URL, Twilio Number — each with copy buttons. Note: "These URLs are pre-configured in your Twilio console."
**What you can do:** Copy values.
**Columns it reads:** `appUrl` prop + `slug` prop + `twilio_number`
**Columns it writes:** none
**API endpoints:** none
**Mutation class:** READ_MODEL_ONLY
**Sync side-effect on save:** N/A
**Where else these columns appear (cross-surface trace):** N/A.
**Known issues:** None tracked.

#### GodModeCard
**File:** [src/components/dashboard/settings/GodModeCard.tsx](src/components/dashboard/settings/GodModeCard.tsx)
**Visible-to:** admin
**Conditional rendering:** `isAdmin` (rendered when `godConfig[client.id]` exists)
**What you see:** Editable fields for `telegram_bot_token`, `telegram_chat_id`, `timezone`, `twilio_number`, `monthly_minute_limit`. Telegram test button. Niche override panel (collapsible) for `custom_niche_config` editing. Deep Mode activation flow — select agent_mode → preview full prompt diff → deploy.
**What you can do:** Edit all admin-only fields → Save (bundled PATCH). Test Telegram. Override niche industry/triage/classification. Activate deep agent_mode via `POST /api/dashboard/regenerate-prompt/preview` + `POST /api/dashboard/regenerate-prompt`.
**Columns it reads:** `telegram_chat_id`, `timezone`, `twilio_number`, `monthly_minute_limit`, `agent_mode`, `call_handling_mode`, `niche`, `custom_niche_config`
**Columns it writes:** `telegram_bot_token`, `telegram_chat_id`, `timezone`, `twilio_number`, `monthly_minute_limit`, `custom_niche_config`, `agent_mode` (via regen route)
**API endpoints:** `PATCH /api/dashboard/settings`, `POST /api/dashboard/regenerate-prompt/preview`, `POST /api/dashboard/regenerate-prompt`, Telegram test endpoint
**Mutation class (from contract):** DB_ONLY (telegram_*, timezone, monthly_minute_limit, custom_niche_config — all `adminOnly:true`); DB_PLUS_TOOLS (twilio_number — `adminOnly:true`, triggersSync:true)
**Sync side-effect on save:** `twilio_number` save → in sync trigger list (added per D442) → `syncToUltravox` rebuilds `clients.tools` to enable SMS tool if `sms_enabled=true`. **Note** mutation contract §7 Risk 2 historically flagged twilio_number as missing from `needsAgentSync` — settings-schema.ts FIELD_REGISTRY now lists it as `triggersSync:true, adminOnly:true`, so the gap is closed at the schema level, but the card itself has no `FieldSyncStatusChip` for `twilio_number`.
**Where else these columns appear (cross-surface trace):** `AlertsTab` (telegram_chat_id read), `AgentConfigCard` (display), `BillingCard` (twilio_number gating), `WebhooksCard` (twilio_number copy), `SmsTab` (gates on twilio_number), `RuntimeCard` (display), `SetupCard` (twilio_number display), bottom non-admin "Phone & call forwarding" row card (twilio_number display).
**Known issues:** No `FieldSyncStatusChip` despite being the only writer of `twilio_number` post-provision (mutation contract §7 Risk 2 historical context). Sync-failure path would not surface via per-field chip.

#### RuntimeCard
**File:** [src/components/dashboard/settings/RuntimeCard.tsx](src/components/dashboard/settings/RuntimeCard.tsx)
**Visible-to:** admin
**Conditional rendering:** `isAdmin` + env flag `NEXT_PUBLIC_SHOW_RUNTIME_CARD !== 'false'`
**What you see:** Live runtime config snapshot from Ultravox — prompt length (color-coded by threshold), tool count + tool name list, max duration, VAD settings, inactivity messages, firstSpeakerSettings, voice, total calls, recordingEnabled flag, stale flag.
**What you can do:** None — read-only diagnostic.
**Columns it reads:** Live Ultravox agent config + `call_logs` (total) via `GET /api/dashboard/runtime`
**Columns it writes:** none
**API endpoints:** `GET /api/dashboard/runtime`
**Mutation class:** READ_MODEL_ONLY (diagnostic)
**Sync side-effect on save:** N/A
**Where else these columns appear (cross-surface trace):** N/A — diagnostic only.
**Known issues:** None tracked. Reads live Ultravox state — useful for confirming sync worked.

### Section: Billing & Setup (non-admin bottom)

The non-admin bottom of `AgentTab` includes (lines 742–806):

- **Timezone card** — inline, simple `<select>` writing `timezone` (PER_CALL_CONTEXT_ONLY, no sync).
- **PlanInfoCard** — same component as admin top, see above.
- **BillingCard** — same as admin top, see above.
- **SetupProgressRing** (non-admin only) — see below.
- **"Phone & call forwarding" link row** — inline card linking to `/dashboard/go-live` showing `twilio_number` if set.

#### SetupProgressRing
**File:** [src/components/dashboard/settings/SetupProgressRing.tsx](src/components/dashboard/settings/SetupProgressRing.tsx)
**Visible-to:** non-admin
**Conditional rendering:** `!isAdmin`
**What you see:** SVG donut showing weighted % complete (business_facts 15 + extra_qa 15 + hours 10 + booking 10 + voice_style 10 + knowledge 15 + setup_complete 15 + sms 5 + forwarding 5). Tagline varies by % bracket. Green check when 100%.
**What you can do:** None — display only.
**Columns it reads:** `business_facts`, `extra_qa`, `business_hours_weekday`, `booking_enabled`, `calendar_auth_status`, `voice_style_preset`, `knowledge_backend`, `setup_complete`, `sms_enabled`, `forwarding_number`
**Columns it writes:** none
**API endpoints:** none
**Mutation class:** READ_MODEL_ONLY
**Sync side-effect on save:** N/A
**Where else these columns appear (cross-surface trace):** Same readiness signals appear in `QuickSetupStrip`, `CapabilitiesCard`, Overview readiness band.
**Known issues:** None tracked.

### Section: Activity Log

#### ActivityLog
**File:** [src/components/dashboard/settings/ActivityLog.tsx](src/components/dashboard/settings/ActivityLog.tsx)
**Visible-to:** both (full-width footer)
**Conditional rendering:** always
**What you see:** Collapsible "Recent Changes" card. When opened: 8 most recent prompt versions with relative time, change_description, char delta, role.
**What you can do:** Toggle open.
**Columns it reads:** `prompt_versions` table via `GET /api/dashboard/settings/prompt-versions`
**Columns it writes:** none
**API endpoints:** `GET /api/dashboard/settings/prompt-versions`
**Mutation class:** READ_MODEL_ONLY
**Sync side-effect on save:** N/A
**Where else these columns appear (cross-surface trace):** `PromptVersionsCard` (admin) shows the same data with Restore actions.
**Known issues:** None tracked.

### Side drawer: HoursCard

#### HoursCard (in SettingsPanel drawer)
**File:** [src/components/dashboard/settings/HoursCard.tsx](src/components/dashboard/settings/HoursCard.tsx) (rendered inside [SettingsPanel.tsx](src/components/dashboard/settings/SettingsPanel.tsx))
**Visible-to:** both
**Conditional rendering:** opened via `handleConfigure('hours')` → setActivePanel('hours') → drawer slides in
**What you see:** Two text inputs for weekday/weekend hours. Select for closed behavior (Take message / Route emergencies / Custom). Phone input when "Route emergencies" selected. `FieldSyncStatusChip` for `after_hours_behavior` and `after_hours_emergency_phone`. Collapsible after-hours preview showing what agent will be told.
**What you can do:** Edit all four fields → Save (single bundled PATCH).
**Columns it reads:** `business_hours_weekday`, `business_hours_weekend`, `after_hours_behavior`, `after_hours_emergency_phone`
**Columns it writes:** `business_hours_weekday`, `business_hours_weekend`, `after_hours_behavior`, `after_hours_emergency_phone`
**API endpoints:** `PATCH /api/dashboard/settings`
**Mutation class (from contract):** DB_PLUS_PROMPT (business_hours_weekday — triggers `patchHoursWeekday`); PER_CALL_CONTEXT_ONLY (weekend, after_hours_behavior, after_hours_emergency_phone)
**Sync side-effect on save:** `business_hours_weekday` change → `patchHoursWeekday(prompt, oldHours, newHours)` does literal-replace of old hours text baked into prompt at provision. If prompt changed → `computeNeedsSync` true via system_prompt write → `syncToUltravox`. Also: `business_hours_weekday`, `after_hours_behavior`, `after_hours_emergency_phone` are all in `LOW_STAKES_REGEN_FIELDS` → `scheduleAutoRegen` fires non-blocking. Weekend and after-hours fields are injected at call time via `buildAgentContext` → `callerContextBlock`.
**Where else these columns appear (cross-surface trace):** `InlineModalsV2.HoursModal` (Overview — distinct path), `go-live/HoursFields.tsx`, `PmConfigCard` (after_hours_emergency_phone only), `PmSetupChecklist`, Overview `AgentKnowsCard` (display).
**Known issues:** `patchHoursWeekday` is a literal-replace — if the prompt's "Monday to Friday, 9am to 5pm" was edited manually, the patcher silently no-ops on the next change. Hours weekend stays out of the chip because it's `triggersSync:false`.

## Settings/notifications tab

### AlertsTab
**File:** [src/components/dashboard/settings/AlertsTab.tsx](src/components/dashboard/settings/AlertsTab.tsx)
**Visible-to:** both (admin sees as tab; non-admin sees as inline since Settings hero NotificationsWidget redirects to `/dashboard/notifications` but the tab also renders if forced)
**Conditional rendering:** `activeTab === 'notifications'`
**What you see:** Three notification channel toggles (Telegram / Email / SMS alerts to owner — distinct from caller SMS). Multichannel alert destination fields: `alert_phone`, `alert_email`, `alert_email_cc`. Spam filter toggle (`notification_filter_spam`). Weekly digest toggle (`weekly_digest_enabled`). Telegram style selector (`telegram_style`: compact/standard/action_card). Telegram connect flow with deep-link button + copy. Per-channel "Test" buttons.
**What you can do:** Toggle all channel enables; edit destination addresses; change Telegram style; trigger Telegram deep link; send test message per channel.
**Columns it reads:** `telegram_notifications_enabled`, `email_notifications_enabled`, `sms_alerts_enabled`, `alert_phone`, `alert_email`, `alert_email_cc`, `notification_filter_spam`, `weekly_digest_enabled`, `telegram_style`, `telegram_registration_token`, `telegram_chat_id`
**Columns it writes:** all of the above except read-only `telegram_chat_id` and `telegram_registration_token`
**API endpoints:** `PATCH /api/dashboard/settings`, `POST /api/dashboard/telegram-link`, test-notification endpoints
**Mutation class (from contract):** DB_ONLY for all of these fields
**Sync side-effect on save:** None on any of these (all DB_ONLY). All read at post-call webhook / digest cron time.
**Where else these columns appear (cross-surface trace):** Hero `NotificationsWidget` writes `telegram_notifications_enabled`, `email_notifications_enabled`, `sms_enabled`. `/dashboard/notifications` page is the canonical surface for these. `GodModeCard` writes `telegram_bot_token` + `telegram_chat_id` directly.
**Known issues:** None tracked. No `FieldSyncStatusChip` but `triggersSync:false` for all fields here, so silent-save is by design.

### SmsTab
**File:** [src/components/dashboard/settings/SmsTab.tsx](src/components/dashboard/settings/SmsTab.tsx)
**Visible-to:** both
**Conditional rendering:** `activeTab === 'notifications'`
**What you see:** SMS follow-up card with `PremiumToggle` for `sms_enabled` + `FieldSyncStatusChip` for `sms_enabled`. Mode-aware hint block ("Message receipt" / "Booking confirmation" / "On-request only" / "Lead follow-up") based on `agent_mode`. `sms_template` textarea. Test SMS phone input + send button. Opt-outs collapsible list. Warning when no `twilio_number` ("SMS requires a phone number").
**What you can do:** Toggle `sms_enabled`, edit `sms_template`, click Save (bundled PATCH), test SMS via `POST /api/dashboard/settings/test-sms`. View opt-outs (`GET /api/dashboard/sms-opt-outs`).
**Columns it reads:** `sms_enabled`, `sms_template`, `twilio_number`, `agent_mode`
**Columns it writes:** `sms_enabled`, `sms_template`
**API endpoints:** `PATCH /api/dashboard/settings`, `POST /api/dashboard/settings/test-sms`, `GET /api/dashboard/sms-opt-outs`
**Mutation class (from contract):** DB_PLUS_TOOLS (sms_enabled — triggersSync:true, triggersPatch:'sms'); DB_ONLY (sms_template)
**Sync side-effect on save:** `sms_enabled` change → `applyPromptPatches.patchSmsBlock(prompt, smsEnabled, agentMode)` inserts/removes SMS instruction block in `system_prompt`. `computeNeedsSync` true → `syncToUltravox` → `buildAgentTools` registers/de-registers `sendTextMessage` tool (gated on `sms_enabled && twilio_number && plan.smsEnabled`). When `agent_mode` is explicitly in body, route also refreshes SMS block content to match the new mode.
**Where else these columns appear (cross-surface trace):** Hero `NotificationsWidget` (sms_enabled), `AgentOverviewCard` (sms_enabled chip), `InlineModalsV2.AfterCallModal` (Overview), `actions/MessagingSettingsSection.tsx`. `sms_template` only here + Actions + Overview.
**Known issues:** Chip wired correctly. Triple-toggle entry point for `sms_enabled` (this + hero widget + Overview AfterCallModal) with no shared local state across cards — last-write-wins on `router.refresh()`. Optimistic state can drift briefly.

## Settings/billing tab

### BillingTab
**File:** [src/components/dashboard/settings/BillingTab.tsx](src/components/dashboard/settings/BillingTab.tsx)
**Visible-to:** both
**Conditional rendering:** `activeTab === 'billing'`
**What you see:** Plan comparison cards (Trial / Lite / Core / Pro) with per-plan capability chips. This-period stats (totalCalls / aiResolvedPct / avgCallMin / voicemails). Usage progress bar (color-coded). Upgrade CTAs. Stripe portal link. Minute reload packs. Invoice list. Admin-only: `DangerZoneCard`, `AdminPromoPanel`, `AdminRecomposePanel`.
**What you can do:** Upgrade plan, open Stripe portal, buy minute packs, view invoices. Admin extras: apply promo, trigger admin recompose (which opens `RecomposeConfirmDialog` per D305/D307 flow).
**Columns it reads:** `selected_plan`, `subscription_status`, `subscription_current_period_end`, `stripe_customer_id`, plus all the same billing columns as `BillingCard` + `PlanInfoCard`
**Columns it writes:** none directly — Stripe writes via webhook; admin recompose writes `system_prompt`
**API endpoints:** `POST /api/billing/upgrade`, `POST /api/billing/portal`, `POST /api/billing/minute-pack`, `GET /api/billing/invoices`, `POST /api/dashboard/regenerate-prompt` (via `AdminRecomposePanel`)
**Mutation class (from contract):** READ_MODEL_ONLY for display; admin recompose is DB_PLUS_PROMPT
**Sync side-effect on save:** Stripe webhook does the sync work for plan changes (`syncClientTools()`). Admin recompose runs `regenerateSlots` → writes prompt + syncs.
**Where else these columns appear (cross-surface trace):** `BillingCard`, `PlanInfoCard`, `UsageSummary`, Sidebar usage chip.
**Known issues:** None tracked.

## Cross-tab field-sync status chip — who consumes it

`FieldSyncStatusChip` ([src/components/dashboard/settings/FieldSyncStatusChip.tsx](src/components/dashboard/settings/FieldSyncStatusChip.tsx)) reads from the shared module-level `fieldSyncCache` in `usePatchSettings.ts`. The cache is populated by every successful `usePatchSettings.patch` (via `recordFieldSyncStatusMap` reading `data.field_sync_status` from the route response) AND by direct `recordFieldSyncStatus` calls from cards bypassing the hook. The chip renders only when status !== 'success'. Consumers, with the field they surface:

- **AgentOverviewCard** ([src/components/dashboard/settings/AgentOverviewCard.tsx:276](src/components/dashboard/settings/AgentOverviewCard.tsx)) — `fieldKey="sms_enabled"`
- **SmsTab** ([src/components/dashboard/settings/SmsTab.tsx:150](src/components/dashboard/settings/SmsTab.tsx)) — `fieldKey="sms_enabled"`
- **CallHandlingModeCard** ([src/components/dashboard/settings/CallHandlingModeCard.tsx:86](src/components/dashboard/settings/CallHandlingModeCard.tsx)) — `fieldKey="call_handling_mode"`
- **KnowledgeEngineCard** ([src/components/dashboard/settings/KnowledgeEngineCard.tsx:236](src/components/dashboard/settings/KnowledgeEngineCard.tsx)) — `fieldKey="knowledge_backend"`
- **SetupCard** (4 instances) ([src/components/dashboard/settings/SetupCard.tsx](src/components/dashboard/settings/SetupCard.tsx) lines 103, 109, 172, 191) — `fieldKey="forwarding_number"` (×2 — compact + full form), `fieldKey="transfer_conditions"` (×2 — compact + full form)
- **BookingCard** ([src/components/dashboard/settings/BookingCard.tsx:79](src/components/dashboard/settings/BookingCard.tsx)) — `fieldKey="booking_enabled"`
- **HoursCard** (2 instances) ([src/components/dashboard/settings/HoursCard.tsx](src/components/dashboard/settings/HoursCard.tsx) lines 139, 161) — `fieldKey="after_hours_behavior"`, `fieldKey="after_hours_emergency_phone"`
- **PromptVariablesCard** ([src/components/dashboard/settings/PromptVariablesCard.tsx:349](src/components/dashboard/settings/PromptVariablesCard.tsx)) — renders `<SyncStatusChip>` directly (not the wrapper) but populates the same module-level cache. Phase-1 wired only for `GREETING_LINE`.

**Cards conspicuously missing a chip despite writing sync-relevant fields:** `AgentOverviewCard` for `agent_name`/`display_name` (DB_PLUS_PROMPT), `VoiceStyleCard` for `voice_style_preset`, `ServicesOfferedCard` for `services_offered`, `GodModeCard` for `twilio_number`, `AgentModeCard` for `agent_mode` (it has its own preview/deploy state machine but no chip surface afterward), `CallRoutingCard` for `niche_custom_variables` (legacy-prompt-noop risk), `PmConfigCard` for `niche_custom_variables` (same risk), `PromptEditorCard` for `system_prompt` (uses local `ultravoxWarning` state instead), `PromptEditorModal` for everything (bypasses the hook), `SectionEditorCard` for `system_prompt` (also bypasses the hook).

## Settings data flow — column-by-column

For each settings column, every UI surface (Overview / Calls / Knowledge / Settings / Admin) that reads or writes it, the mutation class, and what fires on save.

### `clients.agent_name`
- **Reads:** Overview `AgentIdentityCardCompact`, `InlineModalsV2.IdentityModal`, Settings `AgentOverviewCard` (admin), Settings `PromptEditorCard`, Settings `AgentTab` (rendering layer), Settings `IvrMenuCard` (default IVR prompt), Settings `PromptVariablesCard` (AGENT_NAME row), Settings `TestCallCard` knowledge prop, `go-live/GreetingFields.tsx`.
- **Writes:** Overview `InlineModalsV2.IdentityModal`, Settings `AgentOverviewCard` (admin only — non-admin gets it via IdentityModal on Overview), Settings `PromptVariablesCard` (via variables API).
- **Mutation class:** DB_PLUS_PROMPT (`triggersPatch:'agent_name'`, `triggersSync:false` directly — sync only fires because prompt changed).
- **Sync on save:** `patchAgentName(prompt, oldName, newName)` word-boundary replace throughout `system_prompt` → if prompt changed, prompt versioned + DB updated + `computeNeedsSync` true via `system_prompt` write → `syncToUltravox` → `updateAgent`. Patcher pushes warning if oldName not found (legacy prompt risk).
- **Silent-failure risk:** LOW per mutation contract §7 Risk 5 — word-boundary replace is reliable when name exists in prompt; silent skip with warning if not.

### `clients.business_name`
- **Reads:** Sidebar, dashboard headers, `ClientHealthBar`, `IdentityModal`, `LiveCallBanner`, `ClientsTable`, `ClientSelector`, Settings `AgentOverviewCard`, Settings `VoicemailGreetingCard` (default placeholder), Settings `IvrMenuCard` (default), Settings `CallRoutingCard` (infer-niche call), Settings `PromptVariablesCard` (BUSINESS_NAME row), Settings `SmsTab` (test SMS), Settings header strip, Telegram alerts.
- **Writes:** Overview `InlineModalsV2.IdentityModal`, Settings `AgentOverviewCard` indirectly (via the same patch path); Settings `PromptVariablesCard` (via variables API).
- **Mutation class:** DB_PLUS_PROMPT (`triggersPatch:'business_name'`, `triggersSync:false`).
- **Sync on save:** `patchBusinessName(prompt, oldName, newName)` word-boundary replace → same pipeline as agent_name. Resolved 2026-03-31 per D282 (mutation contract §7 Risk 6).
- **Silent-failure risk:** LOW — same patcher class as agent_name.

### `clients.agent_voice_id`
- **Reads:** Overview `AgentIdentityCardCompact`, `InlineModalsV2.VoiceModal`, Settings `QuickSetupStrip`, Settings `VoiceTab`, Settings `VoicePicker`, Settings `AgentConfigCard`, Settings `AgentTab` rendering.
- **Writes:** Overview `InlineModalsV2.VoiceModal`, Settings `VoicePicker` (rendered inside `AgentOverviewCard` for admin and inside `VoiceTab` for both).
- **Mutation class:** DB_PLUS_TOOLS (`triggersSync:true`).
- **Sync on save:** `computeNeedsSync` true → `syncToUltravox` → `updateAgent({ voice })` sends new voice to Ultravox. No prompt patch.
- **Silent-failure risk:** LOW — direct pass-through.

### `clients.voice_style_preset`
- **Reads:** Settings `VoiceStyleCard` (initial), Settings `AgentTab`, Settings `AgentKnowledgeCard` (display), Settings `SetupProgressRing`, hero `CapabilitiesCard`.
- **Writes:** Settings `VoiceStyleCard`.
- **Mutation class:** DB_PLUS_PROMPT (`triggersPatch:'voice_style'`, `triggersSync:false`).
- **Sync on save:** `patchVoiceStyleSection` + `patchIdentityPersonality` rewrite tone/style/filler + personality line in `system_prompt`. If prompt changed → `computeNeedsSync` true via system_prompt path → `syncToUltravox`.
- **Silent-failure risk:** MEDIUM on legacy prompts — patchers silently no-op if expected section headers missing; UI surfaces local `syncStatus` state but no FieldSyncStatusChip.

### `clients.system_prompt`
- **Reads:** Settings `PromptEditorCard`, Settings `PromptEditorModal` (hero), Settings `AgentOverviewCard` (`promptLength` prop), Settings `SettingsView` (legacy banner check), Settings `AdvancedContextCard` (preview).
- **Writes:** Settings `PromptEditorCard` (direct), Settings `PromptEditorModal` (hero, direct), Settings `SectionEditorCard` (via section_id/content → `replacePromptSection`), Settings `PromptVersionsCard` restore. Indirectly written by every other card whose patcher rewrites the prompt (`AgentOverviewCard` via `patchAgentName`, `VoiceStyleCard` via `patchVoiceStyleSection`, `BookingCard` via `patchCalendarBlock`, `SmsTab`/`NotificationsWidget` via `patchSmsBlock`, `ServicesOfferedCard` via `patchServicesOffered`, `CallHandlingModeCard`/`AgentModeCard` via `patchCallHandlingMode`, `SetupCard` via `patchVipSection`, `HoursCard` via `patchHoursWeekday`, `CallRoutingCard` via `replacePromptSection`, plus slot regen via `niche_custom_variables`/`city`/`display_name`/`booking_enabled` paths). Voicemail clients get full rebuild via `voicemailFullRebuild()`.
- **Mutation class:** DB_PLUS_PROMPT (always `triggersSync:true`).
- **Sync on save:** Direct write → `validatePrompt` → DB → `computeNeedsSync` true (system_prompt path) → `syncToUltravox` → `updateAgent` rebuilds full callTemplate with stripped markers + ensures `{{callerContext}}`, `{{businessFacts}}`, `{{contextData}}` placeholders → `buildAgentTools` rewrites `clients.tools`. Step 10 also stores a `prompt_versions` row and updates `active_prompt_version_id`; non-admin edits get a Telegram alert to operator.
- **Silent-failure risk:** MEDIUM — `updateAgent` is awaited but can fail; failure path writes `last_agent_sync_status='error'` and Telegram alerts the operator (settings/route.ts line 156).

### `clients.niche_custom_variables` (THE D442 RISK ONE)
- **Reads:** Settings `PmSetupChecklist`, Settings `CallRoutingCard` (parses `_caller_reasons` JSON + reads TRIAGE_DEEP), Settings `PmConfigCard`, Settings `PromptVariablesCard` (all variable groups), Settings `GreetingFields` (Go Live). Resolved variable values flow into `PROMPT_VARIABLE_REGISTRY` at slot-render time and feed every templateContext.
- **Writes:** Settings `CallRoutingCard` (TRIAGE_DEEP + _caller_reasons), Settings `PmConfigCard` (PM niche keys), Settings `PromptVariablesCard` (any key via variables API), Overview `InlineModalsV2.GreetingModal` (GREETING_LINE — the known fake-control). The settings PATCH route deep-merges existing vars with the body (route.ts lines 240–251) so partial saves don't blow out other keys.
- **Mutation class:** DB_PLUS_PROMPT (`triggersPatch:'slot_regen'`, `triggersSync:false`). Per D283c this was DB_ONLY until recently.
- **Sync on save:** Step 8b: `regenerateSlots(targetClientId, SLOT_IDS, user.id)` runs against the slot prompt. If `promptChanged=true` → prompt overwritten + already-synced flag set (route.ts line 386 — `updates.system_prompt = '__regenerated__'`). If `regenerateSlots` returns the marker `'Old-format prompt without section markers — use patchers instead of regeneration'` (legacy clients), the DB write of `niche_custom_variables` still sticks but the prompt does NOT change → `field_sync_status` for affected fields returns `legacy_prompt_patcher_noop` reason → `usePatchSettings.recordFieldSyncStatusMap` populates the cache → `PromptVariablesCard.VariableRow` (for GREETING_LINE only — Phase 1) renders the chip.
- **Silent-failure risk:** **HIGH — this is D442 Phase 1 known fake-control on 4/5 active clients.** Only the `GREETING_LINE` row in `PromptVariablesCard` surfaces the chip. All other variable rows (CLOSE_PERSON, CITY, CLOSING_LINE, SERVICES_NOT_OFFERED, FAQ_PAIRS, TRIAGE_DEEP, URGENCY_KEYWORDS, FORBIDDEN_EXTRA) AND the entire `PmConfigCard` AND `CallRoutingCard` AND `InlineModalsV2.GreetingModal` save successfully at DB level but do not propagate to prompt on legacy clients. The legacy-prompt amber banner in `SettingsView` is the only page-level signal.

### `clients.business_facts`
- **Reads:** Settings `AdvancedContextCard`, Settings `AgentKnowledgeCard`, Settings `PromptEditorModal`, Settings `PromptEditorCard`, Settings `SetupProgressRing`, Settings `AgentTab`, Overview `AgentKnowsCard`, Overview `Agent Readiness band`.
- **Writes:** Settings `AdvancedContextCard`, Settings `PromptEditorModal`, Overview `InlineModalsV2.FaqsModal` (often bundled). Indirectly populated by AI Compiler approval path.
- **Mutation class:** DB_PLUS_KNOWLEDGE_PIPELINE (`triggersSync:false`).
- **Sync on save:** Step 8 reseed: if `knowledge_backend='pgvector'` → `reseedKnowledgeFromSettings(clientId, facts, qa)` fire-and-forget → `knowledgeReseeded=true` → `computeNeedsSync` true → `syncToUltravox` to re-register `queryKnowledge` tool. Also `business_facts` is in `LOW_STAKES_REGEN_FIELDS` → `scheduleAutoRegen` fires post-save (non-blocking full rebuild).
- **Silent-failure risk:** LOW — chunk-count-gated tool registration; double safety via auto-regen.

### `clients.extra_qa`
- **Reads:** Settings `AdvancedContextCard`, Settings `AgentKnowledgeCard` (count), Settings `KnowledgeEngineCard`, Settings `PromptEditorModal`, Settings `PromptEditorCard`, Settings `SetupProgressRing`, Settings `AgentTab`, Settings `PromptVariablesCard` (FAQ_PAIRS row), Overview `InlineModalsV2.FaqsModal`, Overview `AgentKnowsCard`, hero `CapabilitiesCard.hasFaqs`.
- **Writes:** Settings `AdvancedContextCard`, Settings `AgentKnowledgeCard` (quick-add merge), Settings `KnowledgeEngineCard` (via gap answer path), Settings `PromptEditorModal`, Overview `InlineModalsV2.FaqsModal`, Settings `PromptVariablesCard` (FAQ_PAIRS row via variables API).
- **Mutation class:** DB_PLUS_KNOWLEDGE_PIPELINE (`triggersSync:false`).
- **Sync on save:** Same reseed pipeline as `business_facts` — step 8 → reseed → sync. Route also dedupes by question (last-write-wins). The `buildUpdates` in settings-schema deduplicates extra_qa pairs before writing.
- **Silent-failure risk:** LOW.

### `clients.services_offered`
- **Reads:** Settings `ServicesOfferedCard`, Overview `AgentKnowsCard`, Overview `InlineModalsV2.ServicesModal`, Settings `PromptVariablesCard` (SERVICES_OFFERED row).
- **Writes:** Settings `ServicesOfferedCard`, Overview `InlineModalsV2.ServicesModal`, Settings `PromptVariablesCard` (via variables API).
- **Mutation class:** DB_PLUS_PROMPT (`triggersPatch:'services'`, `triggersSync:false`).
- **Sync on save:** `patchServicesOffered` replaces SERVICES OFFERED section. If patcher no-ops → warning surfaced (Settings only). If prompt changed → `computeNeedsSync` true via system_prompt path → `syncToUltravox`. Also in `LOW_STAKES_REGEN_FIELDS` → auto-regen scheduled.
- **Silent-failure risk:** MEDIUM on legacy — warning is shown but unspecified for non-Settings paths; auto-regen is the safety net.

### `clients.business_hours_weekday` and `business_hours_weekend`
- **Reads (weekday):** Settings `HoursCard`, Settings `AgentKnowledgeCard`, Settings `PromptEditorCard`, Settings `SetupProgressRing`, Settings `QuickSetupStrip`, Settings `AgentTab`, `go-live/HoursFields.tsx`, Overview `AgentKnowsCard`, Overview `InlineModalsV2.HoursModal`. Weekend: same minus the readiness/quick-setup tiles.
- **Writes:** Settings `HoursCard`, Settings `PromptEditorModal`, Overview `InlineModalsV2.HoursModal`, Go Live `HoursFields`.
- **Mutation class (weekday):** DB_PLUS_PROMPT (`triggersSync:false`). Weekend: PER_CALL_CONTEXT_ONLY.
- **Sync on save (weekday):** `patchHoursWeekday(prompt, oldHours, newHours)` does literal-text replace. If prompt changed → sync via system_prompt path. Also `business_hours_weekday` is in `LOW_STAKES_REGEN_FIELDS` → auto-regen.
- **Silent-failure risk (weekday):** MEDIUM — patcher relies on literal-text match against value baked at provision; manual prompt edits break it. Weekend: zero risk (per-call injection).

### `clients.after_hours_behavior` and `after_hours_emergency_phone`
- **Reads:** Settings `HoursCard`, Settings `PmConfigCard`, Settings `PmSetupChecklist`, Go Live `HoursFields`, Overview `InlineModalsV2.HoursModal`.
- **Writes:** Settings `HoursCard`, Settings `PmConfigCard`, Overview `InlineModalsV2.HoursModal`, Go Live `HoursFields`.
- **Mutation class:** PER_CALL_CONTEXT_ONLY (both).
- **Sync on save:** None at agent layer. Injected at call time via `callerContextBlock` → `OFFICE STATUS:` line in `buildAfterHoursBehaviorNote()`. `after_hours_behavior` is in `LOW_STAKES_REGEN_FIELDS` → triggers auto-regen anyway.
- **Silent-failure risk:** ZERO at agent level. Chips surface via D449 because HoursCard wires them.

### `clients.injected_note`
- **Reads:** Settings `QuickInject` (inside `AgentOverviewCard`), Settings `AdvancedContextCard` (preview line), Settings `AgentTab`, Overview `InlineModalsV2.TodayUpdateModal`, Overview `AgentIdentityCardCompact`.
- **Writes:** Settings `QuickInject`, Overview `InlineModalsV2.TodayUpdateModal`.
- **Mutation class:** PER_CALL_CONTEXT_ONLY (`triggersSync:false`).
- **Sync on save:** None. Injected at call time via `callerContextBlock` as `RIGHT NOW: {note}`. `buildUpdates` in settings-schema auto-sets `injected_note_expires_at` to +24h on non-null saves, null on clear.
- **Silent-failure risk:** ZERO at agent level. Auto-expiry handled in schema layer.

### `clients.forwarding_number`
- **Reads:** Settings `SetupCard`, Settings `AgentOverviewCard`, Settings `VIPContactsCard` (warning), Settings `SetupProgressRing`, Settings `PromptEditorCard`, `actions/TransferSettingsSection.tsx`, Overview `InlineModalsV2.TransferModal`, Overview `ActionItems`, hero `CapabilitiesCard.hasTransfer`.
- **Writes:** Settings `SetupCard`, Overview `InlineModalsV2.TransferModal`, `actions/TransferSettingsSection`.
- **Mutation class:** DB_PLUS_TOOLS (`triggersSync:true`).
- **Sync on save:** `applyPromptPatches.patchVipSection(prompt, !!effectiveForwardingNumber)` toggles VIP section. `forwarding_number` is in sync trigger list → `computeNeedsSync` true → `syncToUltravox` → `buildAgentTools` registers/de-registers `transferCall` tool + `clients.tools` rewrite. `forwarding_number` also in `LOW_STAKES_REGEN_FIELDS` → auto-regen scheduled.
- **Silent-failure risk:** LOW. FieldSyncStatusChip wired in SetupCard.

### `clients.transfer_conditions`
- **Reads:** Settings `SetupCard`, `actions/TransferSettingsSection`, Overview `InlineModalsV2.TransferModal`.
- **Writes:** same three.
- **Mutation class:** DB_PLUS_TOOLS (`triggersSync:true`).
- **Sync on save:** In sync trigger list → `syncToUltravox` rebuilds `transferCall` tool with new description from `transfer_conditions`.
- **Silent-failure risk:** LOW. FieldSyncStatusChip wired in SetupCard.

### `clients.sms_enabled`
- **Reads:** Settings `SmsTab`, Settings `AgentOverviewCard`, Settings hero `NotificationsWidget`, Settings `SetupProgressRing`, Settings `PromptEditorCard`, `actions/MessagingSettingsSection.tsx`, Go Live `GreetingFields`, Overview `InlineModalsV2.AfterCallModal`, hero `CapabilitiesCard.hasSms`.
- **Writes:** Settings `SmsTab`, Settings `AgentOverviewCard` chip toggle, Settings hero `NotificationsWidget`, Overview `InlineModalsV2.AfterCallModal`, Actions Messaging section.
- **Mutation class:** DB_PLUS_TOOLS (`triggersPatch:'sms'`, `triggersSync:true`).
- **Sync on save:** `patchSmsBlock(prompt, smsEnabled, agentMode)` adds/removes SMS block. `computeNeedsSync` true → `syncToUltravox` → `buildAgentTools` registers `sendTextMessage` tool gated on `sms_enabled && twilio_number && plan.smsEnabled`.
- **Silent-failure risk:** LOW for sync; HIGH product UX risk per call-path matrix §6 (trial clients have `sms_enabled=true` but no `twilio_number` → tool silently doesn't register, UI still says SMS active). FieldSyncStatusChip wired in SmsTab + AgentOverviewCard.

### `clients.sms_template`
- **Reads:** Settings `SmsTab`, Go Live `GreetingFields`, `actions/MessagingSettingsSection`, Overview `InlineModalsV2.AfterCallModal`.
- **Writes:** Same set.
- **Mutation class:** DB_ONLY.
- **Sync on save:** None. Read at post-call SMS send time.
- **Silent-failure risk:** ZERO at agent level.

### `clients.twilio_number`
- **Reads:** Sidebar, `ClientsTable`, `AdminCommandStrip`, `CampaignCard`, `ClientSelector`, Settings `AgentOverviewCard`, Settings `GodModeCard` (editable), Settings `AlertsTab`, Settings `SmsTab` (gate), Settings `AgentTab`, Settings `AgentIdentityHeader`, Settings `WebhooksCard`, Settings `BillingCard` (gate), Settings `SetupCard` (display), `actions/OutboundSchedulingCard.tsx`.
- **Writes:** Settings `GodModeCard` (admin only, `adminOnly:true`). Provision routes set it at activation. Stripe webhook → `ensureTwilioProvisioned()` writes it on trial upgrade.
- **Mutation class:** DB_PLUS_TOOLS (`triggersSync:true`, `adminOnly:true`).
- **Sync on save:** In FIELD_REGISTRY sync trigger list. `computeNeedsSync` true → `syncToUltravox` → `buildAgentTools` re-registers SMS tool now that `twilio_number` is present. Resolves mutation contract §7 Risk 2 at schema level.
- **Silent-failure risk:** MEDIUM — no FieldSyncStatusChip in `GodModeCard` despite the field being the historical fake-control case.

### `clients.ivr_enabled` and `ivr_prompt`
- **Reads:** Settings `IvrMenuCard`, Settings `AgentTab`, Overview `InlineModalsV2.IvrModal`, hero `CapabilitiesCard.hasIvr`.
- **Writes:** Settings `IvrMenuCard`, Overview `InlineModalsV2.IvrModal`.
- **Mutation class:** DB_ONLY (both).
- **Sync on save:** None. Inbound webhook reads `ivr_enabled` at call time to decide whether to serve `<Gather>` TwiML before connecting; `ivr_prompt` used verbatim.
- **Silent-failure risk:** ZERO at agent level.

### `clients.voicemail_greeting_text` and `voicemail_greeting_audio_url`
- **Reads:** Settings `VoicemailGreetingCard`, Settings `AgentTab`, Go Live `GreetingFields`, Overview `InlineModalsV2.VoicemailModal`.
- **Writes:** Settings `VoicemailGreetingCard`, Overview `InlineModalsV2.VoicemailModal`, Go Live (text only; audio is admin-uploaded only).
- **Mutation class:** DB_ONLY (both).
- **Sync on save:** None. Only used by inbound webhook voicemail fallback path when Ultravox is unreachable.
- **Silent-failure risk:** ZERO at agent level; fallback path only.

### `clients.booking_enabled`
- **Reads:** Settings `BookingCard`, Settings `AgentOverviewCard`, Settings `AgentKnowledgeCard`, Settings `PromptEditorCard`, Settings `SetupProgressRing`, Settings `StaffRosterCard` (gate), Settings `AgentTab`, `actions/BookingSettingsSection.tsx`, Overview `InlineModalsV2.CalendarModal`, Overview `ActionItems`, hero `CapabilitiesCard.hasBooking`.
- **Writes:** Settings `BookingCard`, Overview `InlineModalsV2.CalendarModal`, `actions/BookingSettingsSection`.
- **Mutation class:** DB_PLUS_PROMPT_PLUS_TOOLS (`triggersPatch:'calendar'`, `triggersSync:true`).
- **Sync on save:** `patchCalendarBlock` adds/removes CALENDAR BOOKING FLOW block in prompt. `computeNeedsSync` true → `syncToUltravox` → `buildAgentTools` adds/removes calendar tools. Step 8c: if not already slot-regen'd, runs `regenerateSlots(['conversation_flow', 'goal'])` (D276). Step 9 verifies calendar tools actually landed on Ultravox after save and surfaces an error if not.
- **Silent-failure risk:** LOW. Both surgical patch AND slot regen AND post-enable verification all run.

### `clients.calendar_auth_status`
- **Reads:** Settings `BookingCard`, Settings `AgentOverviewCard`, Settings `AgentKnowledgeCard`, Settings `PromptEditorCard`, Settings `SetupProgressRing`, Settings `AgentTab`, `actions/BookingSettingsSection`, hero `CapabilitiesCard.hasBooking`.
- **Writes:** OAuth callback only (`/api/auth/google/callback`). No settings PATCH path.
- **Mutation class:** READ_MODEL_ONLY (derived via OAuth flow).
- **Sync on save:** None — sync side is OAuth callback writing `'connected'` / `'expired'`.
- **Silent-failure risk:** INTENTIONAL UI gap (mutation contract §7 Risk 1) — UI badge requires `calendar_auth_status='connected'` but agent tool registers regardless.

### `clients.knowledge_backend`
- **Reads:** Settings `KnowledgeEngineCard` (toggle), Settings `AgentKnowledgeCard`, Settings `AgentOverviewCard`, Settings `WebsiteKnowledgeCard`, Settings `SetupProgressRing`, Settings `QuickSetupStrip`, Settings `PromptEditorCard`, Settings `AgentTab`, Knowledge page, hero `CapabilitiesCard.hasKnowledge`.
- **Writes:** Settings `KnowledgeEngineCard` (`adminOnly:true`).
- **Mutation class:** DB_PLUS_TOOLS (`triggersSync:true`, `adminOnly:true`).
- **Sync on save:** In sync trigger list. `syncToUltravox` checks live chunk count when `knowledge_backend='pgvector'` and conditionally registers `queryKnowledge` tool.
- **Silent-failure risk:** LOW. FieldSyncStatusChip wired in KnowledgeEngineCard.

### `clients.telegram_notifications_enabled` and `email_notifications_enabled`
- **Reads:** Settings `AlertsTab`, Settings hero `NotificationsWidget`, Settings `QuickSetupStrip`.
- **Writes:** Settings `AlertsTab`, Settings hero `NotificationsWidget`.
- **Mutation class:** DB_ONLY (both).
- **Sync on save:** None. Read by post-call webhook for alert routing.
- **Silent-failure risk:** ZERO at agent level.

### `clients.telegram_style`
- **Reads:** Settings `AlertsTab`.
- **Writes:** Settings `AlertsTab`.
- **Mutation class:** DB_ONLY.
- **Sync on save:** None. Affects Telegram notification formatting only.
- **Silent-failure risk:** ZERO at agent level.

### `clients.status` (active / paused)
- **Reads:** Sidebar status pill, many list views, Settings `AgentOverviewCard`, Settings `AgentTab` (`toggleStatus` handler), Settings hero strip (admin), `LiveCallBanner`.
- **Writes:** Settings `AgentTab.toggleStatus` (pause/activate button in `AgentOverviewCard`).
- **Mutation class:** DB_ONLY.
- **Sync on save:** None. Read at inbound webhook call-time to gate whether agent answers.
- **Silent-failure risk:** ZERO at agent layer.

### `clients.call_handling_mode`
- **Reads:** Settings `CallHandlingModeCard` (admin editor), Settings `AgentModeCard` (display), Settings `AgentTab`, Settings `GodModeCard` (display), `applyPromptPatches` context, `voicemailFullRebuild` (detects `message_only`).
- **Writes:** Settings `CallHandlingModeCard` (admin).
- **Mutation class:** DB_PLUS_PROMPT (`triggersPatch:'call_handling_mode'`, `triggersSync:true`).
- **Sync on save:** `patchCallHandlingMode(prompt, effectiveMode, closePerson)` rewrites the mode block. `computeNeedsSync` true → `syncToUltravox`. Also refreshes SMS block when SMS currently enabled.
- **Silent-failure risk:** MEDIUM on legacy prompts (warning surfaced). FieldSyncStatusChip wired in CallHandlingModeCard.

### `clients.agent_mode`
- **Reads:** Settings `AgentModeCard`, Settings `AgentTab`, Settings `GodModeCard` (deep-mode-activation), Settings `SmsTab` (SMS hint), `applyPromptPatches` context.
- **Writes:** Settings `AgentModeCard` (via regen route), Settings `GodModeCard` (admin deep-mode flow).
- **Mutation class:** DB_PLUS_PROMPT (`triggersPatch:'agent_mode'`, `triggersSync:true`). But practically — `AgentModeCard` and `GodModeCard` write through `POST /api/dashboard/regenerate-prompt`, not through the settings PATCH route, so the patcher itself isn't the typical path.
- **Sync on save:** The regen route does its own full slot rebuild → writes `system_prompt` → calls its own sync. `applyPromptPatches.patchCallHandlingMode` would run if agent_mode came in via settings PATCH (e.g., bundled from another card), refreshing SMS block too.
- **Silent-failure risk:** LOW via regen route; MEDIUM if reaching it through patcher path on legacy prompts.

### `clients.context_data` and `context_data_label`
- **Reads:** Settings `AdvancedContextCard`, Settings `ContextDataCard` (PM only), Settings `AgentTab`, Settings `PmSetupChecklist` (line count), Settings `PromptEditorCard`, Settings `PromptEditorModal`, Overview `CapabilitiesCard.hasContextData`.
- **Writes:** Settings `AdvancedContextCard` (admin), Settings `ContextDataCard` (PM niche-specific editor), Settings `PromptEditorModal`.
- **Mutation class:** PER_CALL_CONTEXT_ONLY (both, `triggersSync:false`).
- **Sync on save:** None. Injected at call time via `templateContext.contextData`. `context_data` is in `LOW_STAKES_REGEN_FIELDS` → triggers auto-regen anyway.
- **Silent-failure risk:** ZERO at agent level.

### `clients.staff_roster`
- **Reads:** Settings `StaffRosterCard`, Settings `AgentTab`.
- **Writes:** Settings `StaffRosterCard`.
- **Mutation class:** PER_CALL_CONTEXT_ONLY (`triggersSync:false`).
- **Sync on save:** None. Injected at call time. Schema validation filters out entries with empty name/role.
- **Silent-failure risk:** ZERO at agent level.

### `clients.outbound_*` (outbound_prompt, outbound_goal, outbound_opening, outbound_vm_script, outbound_tone, outbound_notes, outbound_enabled, outbound_number, outbound_time_window_start/end, outbound_max_attempts)
- **Reads:** Settings `OutboundAgentConfigCard` (prompt + structured fields), `actions/OutboundSchedulingCard.tsx` (scheduling fields).
- **Writes:** Same two cards.
- **Mutation class:** DB_ONLY for all.
- **Sync on save:** None. Outbound dialer doesn't exist yet — these fields are write-only against the planned campaign system.
- **Silent-failure risk:** ZERO at agent level (the agent never reads these).

### `clients.custom_niche_config`
- **Reads:** Settings `GodModeCard` (admin niche override panel), Settings `AgentTab` (passed through).
- **Writes:** Settings `GodModeCard` (admin only).
- **Mutation class:** DB_ONLY (`adminOnly:true`, `triggersSync:false`).
- **Sync on save:** None directly. `GodModeCard` also runs a separate niche-rebuild flow that calls `POST /api/dashboard/regenerate-prompt` after saving to actually apply the override.
- **Silent-failure risk:** LOW — admin-only path with an explicit rebuild step in the same UI.

### `clients.niche`
- **Reads:** Many — Settings `AgentTab` (conditional rendering for PM cards), Settings `CallRoutingCard` (placeholders + infer-niche), Settings `AgentIdentityHeader`, `home/UnifiedHomeSection`, `knowledge/KnowledgeHealthScore`, `ClientsTable`, `AdminDropdown`, `ClientHealthBar`, `CampaignCard`, `ClientSelector`, `AdminCommandStrip`, `IntakeTable`.
- **Writes:** Provision routes only — set once. No settings PATCH path (treated as immutable per mutation contract Section 2 row).
- **Mutation class:** DB_ONLY in registry terms; effectively READ-ONLY post-provision per contract §2.
- **Sync on save:** N/A.
- **Silent-failure risk:** **HIGH if ever changed** (contract §2 marks niche as "no post-provision update path"). Card-level surfaces never write this.

### `clients.display_name`
- **Reads:** Settings `AgentOverviewCard`.
- **Writes:** Settings `AgentOverviewCard` (admin).
- **Mutation class:** DB_PLUS_PROMPT (`triggersSync:true`, `triggersPatch:'slot_regen'`). Added per Bug #3 2026-05-21.
- **Sync on save:** Hits the slot_regen path → `regenerateSlots(SLOT_IDS)` → if marker-aware slot prompt, prompt rebuilt + auto-synced. If legacy → silent no-op (DB writes stick, prompt unchanged).
- **Silent-failure risk:** HIGH on legacy clients (same risk class as `niche_custom_variables`).

### `clients.owner_name`
- **Reads:** Settings `AgentOverviewCard`.
- **Writes:** Settings `AgentOverviewCard` (admin, via the same patch path).
- **Mutation class:** DB_PLUS_PROMPT (`triggersPatch:'owner_name'`, `triggersSync:false`).
- **Sync on save:** `applyPromptPatches` step 2b: derives first-name and runs `patchAgentName(prompt, oldFirst, newFirst)` to replace CLOSE_PERSON occurrences. Warning if not found.
- **Silent-failure risk:** MEDIUM — same word-boundary patcher class, slightly fragile when owners share first names with agents.

---

**End of map.** Every card in scope has been described against its current code state. The D442 risk surface is concentrated in any column with `triggersPatch:'slot_regen'` (`niche_custom_variables`, `city`, `display_name`) plus the surgical-patcher columns on legacy prompts (`agent_name`, `business_name`, `voice_style_preset`, `services_offered`, `call_handling_mode`, `business_hours_weekday`, `forwarding_number` (VIP section), `sms_enabled` (SMS block), `booking_enabled` (calendar block), `owner_name`). The FieldSyncStatusChip is currently wired only on 7 cards covering 8 distinct field keys.
