# Frontend Baseline Component Audit

Phase F0 — docs only, no code changes.

Branch: `refactor/frontend` (from main at `6bdb6d2`)
Build status: GREEN (`npm run build` passes)

---

## 1. SettingsView.tsx — 3,044 lines

**Path:** `agent-app/src/app/dashboard/settings/SettingsView.tsx`

### Props

```ts
interface SettingsViewProps {
  clients: ClientConfig[]
  isAdmin: boolean
  appUrl: string
  initialClientId?: string
}
```

### useState Hooks (~63)

| # | Name | Type | Initial | Tab |
|---|------|------|---------|-----|
| 1 | selectedId | string | initialClientId or clients[0].id | Shell |
| 2 | prompt | Record<string, string> | clients map → system_prompt | General |
| 3 | status | Record<string, string> | clients map → status | General |
| 4 | saving | boolean | false | General |
| 5 | saved | boolean | false | General |
| 6 | saveError | string | '' | General |
| 7 | godConfig | Record<string, {...}> | clients map → telegram/tz/twilio/limits | General (admin) |
| 8 | godSaving | boolean | false | General (admin) |
| 9 | godSaved | boolean | false | General (admin) |
| 10 | telegramTest | Record<string, state> | clients map → 'idle' | Alerts |
| 11 | tgStyle | Record<string, string> | clients map → telegram_style | Alerts |
| 12 | tgStyleSaving | boolean | false | Alerts |
| 13 | regenState | state enum | 'idle' | General |
| 14 | improveState | ImproveState | 'idle' | General |
| 15 | improveResult | object \| null | null | General |
| 16 | improveError | string | '' | General |
| 17 | learning | LearningStatus \| null | null | General |
| 18 | learningState | state enum | 'checking' | General |
| 19 | learningDismissed | boolean | sessionStorage | General |
| 20 | versionsOpen | boolean | false | General |
| 21 | versions | PromptVersion[] | [] | General |
| 22 | versionsLoading | boolean | false | General |
| 23 | restoring | string \| null | null | General |
| 24 | viewingVersion | PromptVersion \| null | null | General |
| 25 | syncing | boolean | false | General |
| 26 | syncState | state enum | 'idle' | General |
| 27 | syncError | string | '' | General |
| 28 | saveUltravoxWarning | string \| null | null | General |
| 29 | smsEnabled | Record<string, boolean> | clients map | SMS |
| 30 | smsTemplate | Record<string, string> | clients map | SMS |
| 31 | smsSaving | boolean | false | SMS |
| 32 | smsSaved | boolean | false | SMS |
| 33 | testSmsPhone | string | '' | SMS |
| 34 | testSmsState | state enum | 'idle' | SMS |
| 35 | testSmsError | string | '' | SMS |
| 36 | injectedNote | Record<string, string> | clients map | General |
| 37 | injectedNoteSaving | boolean | false | General |
| 38 | injectedNoteSaved | boolean | false | General |
| 39 | hoursWeekday | Record<string, string> | clients map | General |
| 40 | hoursWeekend | Record<string, string> | clients map | General |
| 41 | afterHoursBehavior | Record<string, string> | clients map | General |
| 42 | afterHoursPhone | Record<string, string> | clients map | General |
| 43 | hoursSaving | boolean | false | General |
| 44 | hoursSaved | boolean | false | General |
| 45 | corpusEnabled | Record<string, boolean> | clients map | Knowledge |
| 46 | sectionContent | Record<string, Record<string, string>> | parsed sections | General |
| 47 | sectionSaving | nested Record | {} | General |
| 48 | sectionSaved | nested Record | {} | General |
| 49 | sectionError | nested Record | {} | General |
| 50 | sectionCollapsed | nested Record | clients map → {} | General |
| 51 | businessFacts | Record<string, string> | clients map | General |
| 52 | extraQA | Record<string, {q,a}[]> | clients map | General |
| 53 | advancedSaving | boolean | false | General |
| 54 | advancedSaved | boolean | false | General |
| 55 | contextData | Record<string, string> | clients map | General |
| 56 | contextDataLabel | Record<string, string> | clients map | General |
| 57 | promptPreviewOpen | boolean | false | General |
| 58 | bookingSaving | boolean | false | General |
| 59 | bookingSaved | boolean | false | General |
| 60 | bookingDuration | Record<string, number> | clients map | General |
| 61 | bookingBuffer | Record<string, number> | clients map | General |
| 62 | testPhone | string | '' | General |
| 63 | testCallState | state enum | 'idle' | General |
| 64 | testCallResult | object \| null | null | General |
| 65 | testCallError | string | '' | General |
| 66 | promptCollapsed | boolean | isAdmin | General |
| 67 | webhooksCollapsed | boolean | true | General |
| 68 | forwardingNumber | Record<string, string> | clients map | General |
| 69 | transferConditions | Record<string, string> | clients map | General |
| 70 | setupComplete | Record<string, boolean> | clients map | General |
| 71 | setupCollapsed | boolean | derived | General |
| 72 | setupSaving | boolean | false | General |
| 73 | setupSaved | boolean | false | General |
| 74 | setupEditing | boolean | false | General |
| 75 | changeDesc | string | '' | General |
| 76 | showAllVersions | boolean | false | General |
| 77 | activeTab | tab union | 'general' | Shell |
| 78 | reloadMinutes | number | 100 | Billing |
| 79 | reloadLoading | boolean | false | Billing |
| 80 | reloadSuccess | number \| null | null | Billing |
| 81 | voices | VoiceTabVoice[] | [] | Voice |
| 82 | voicesLoading | boolean | true | Voice |
| 83 | playingVoiceId | string \| null | null | Voice |

### useEffect Hooks (4)

| # | Deps | What it does |
|---|------|-------------|
| 1 | [] | Fetch voice list from `/api/dashboard/voices` |
| 2 | [] | Audio cleanup on unmount |
| 3 | [] | Read `?reloaded=N` from URL, show success toast |
| 4 | [client.id] | Learning loop: check `/api/dashboard/settings/learning-status`, auto-analyze if needed |

### useCallback Hooks (2)

| # | Name | Deps |
|---|------|------|
| 1 | dismissLearning | [selectedId] |
| 2 | loadVersions | [client.id, isAdmin] |

### useRef Hooks (1)

| # | Name | Type |
|---|------|------|
| 1 | audioRef | HTMLAudioElement \| null |

### Async Functions (~20)

| Name | Method | Endpoint | Tab |
|------|--------|----------|-----|
| save | PATCH | /api/dashboard/settings | General |
| saveSection | PATCH | /api/dashboard/settings | General |
| toggleStatus | PATCH | /api/dashboard/settings | General |
| testTelegram | POST | /api/dashboard/settings/test-telegram | Alerts |
| saveTelegramStyle | PATCH | /api/dashboard/settings | Alerts |
| saveGodConfig | PATCH | /api/dashboard/settings | General (admin) |
| generateImprovement | POST | /api/dashboard/settings/improve-prompt | General |
| toggleVersions / loadVersions | GET | /api/dashboard/settings/prompt-versions | General |
| restoreVersion | POST | /api/dashboard/settings/prompt-versions | General |
| syncAgent | POST | /api/dashboard/settings/sync-agent | General |
| saveSms | PATCH | /api/dashboard/settings | SMS |
| saveAdvanced | PATCH | /api/dashboard/settings | General |
| saveHoursConfig | PATCH | /api/dashboard/settings | General |
| saveInjectedNote | PATCH | /api/dashboard/settings | General |
| saveBookingConfig | PATCH | /api/dashboard/settings | General |
| fireTestSms | POST | /api/dashboard/settings/test-sms | SMS |
| fireTestCall | POST | /api/dashboard/test-call | General |
| saveSetup | PATCH | /api/dashboard/settings | General |
| handleMarkSetupComplete | PATCH | /api/dashboard/settings | General |

### Sync Functions

| Name | Purpose |
|------|---------|
| playVoice | Audio playback for voice preview |
| applyImprovedPrompt | Copy AI-improved prompt into editor |

### Inline Components (3)

| Name | Lines | Purpose |
|------|-------|---------|
| CopyButton | 67-91 | Clipboard copy with animated feedback |
| UrlRow | 93-101 | Label + monospace URL + CopyButton |
| ConfigRow | 103-111 | Label + value + optional CopyButton |

### Inline Types (4)

| Name | Lines |
|------|-------|
| PromptVersion | 11-18 |
| ImproveState | 20 |
| VoiceTabVoice | 22-28 |
| LearningStatus | 178-188 |

### Constants (3)

| Name | Lines | Purpose |
|------|-------|---------|
| TIMEZONES | 30-42 | 11 timezone picker options |
| KNOWN_VOICES | 47-52 | 4 voice ID → name mappings |
| RELOAD_OPTIONS | 54-58 | 3 minute reload tiers |

### Child Components Rendered

| Component | Source |
|-----------|--------|
| AgentOverviewCard | `@/components/dashboard/settings/AgentOverviewCard` |
| KnowledgeBaseTab | `@/components/dashboard/KnowledgeBaseTab` |
| UsageSummary | `@/components/dashboard/UsageSummary` |
| ShimmerButton | `@/components/ui/shimmer-button` |

### External Imports

| Import | From |
|--------|------|
| fmtPhone, timeAgo, getPlanName | `@/lib/settings-utils` |
| NICHE_CONFIG | `@/lib/niche-config` |
| parsePromptSections | `@/lib/prompt-sections` |

---

## 2. SetupView.tsx — 1,297 lines

**Path:** `agent-app/src/app/dashboard/setup/SetupView.tsx`

### Props

```ts
interface SetupViewProps {
  clients: SetupClientConfig[]
  isAdmin: boolean
}
```

### useState Hooks (11)

| # | Name | Type | Initial |
|---|------|------|---------|
| 1 | selectedId | string | clients[0]?.id |
| 2 | lineType | 'mobile' \| 'landline' \| 'voip' | 'mobile' |
| 3 | carrier | string | '' |
| 4 | device | 'iphone' \| 'android' | 'iphone' |
| 5 | landlineCarrier | string | '' |
| 6 | voipPlatform | string | '' |
| 7 | telusOption | 'A' \| 'B' | 'A' |
| 8 | isActive | boolean | false |
| 9 | step | number | 1 |
| 10 | checkedSteps | Set<number> | new Set() |
| 11 | (inside ConfirmActivation) step | 'idle' \| 'confirm' | 'idle' |

### useEffect Hooks (1)

| # | Deps | What it does |
|---|------|-------------|
| 1 | [] | Restore last-used selections from localStorage ('unmissed-setup-v1') |

### Fetch Calls

None — this component is pure client-side UI. No API calls.

### Sync Functions

| Name | Purpose |
|------|---------|
| stripToDigits | Strip non-digits, remove leading '1' |
| fmtPhone | Format phone for display |
| toggleStep | Toggle checked step in Set |

### Inline Components (7)

| Name | Lines | Purpose |
|------|-------|---------|
| CopyButton | 221-272 | Clipboard copy with AnimatePresence feedback (duplicated from SettingsView but different styling) |
| CodeRow | 274-286 | Label + code + CopyButton (motion hover) |
| SectionLabel | 288-298 | Numbered section header |
| InlineNotes | 300-316 | Warning notes with amber styling |
| ActiveBadge | 318-328 | Green pulsing "Agent Active" indicator |
| MarkActiveButton | 330-342 | "Done dialing" button |
| ConfirmActivation | 344-376 | Two-step confirmation dialog |

### Inline Functions (1)

| Name | Purpose |
|------|---------|
| StarCard | Terminal-style star code card (lines 462-488) |

### Constants (10)

| Name | Lines | Purpose |
|------|-------|---------|
| CARRIERS | 9-25 | 13 mobile carriers |
| CARRIER_NOTES | 27-33 | Per-carrier warning strings |
| FIDO_DISABLE | 36 | Set of carriers using double-hash disable |
| LANDLINE_CARRIERS | 40-47 | 6 landline carriers |
| LANDLINE_CODES | 59-96 | Star codes per landline carrier |
| LANDLINE_NOTES | 98-125 | Per-carrier notes |
| VOIP_PLATFORMS | 129-137 | 7 VoIP systems |
| VOIP_INSTRUCTIONS | 139-197 | Per-platform step-by-step instructions |
| lineTypeTabs | 455-459 | 3 tab config objects |
| (icons) | 438-453 | PhoneIcon, DeskPhoneIcon, CloudIcon SVGs |

### Inline Types (1)

| Name | Lines |
|------|-------|
| LandlineCodes | 49-57 |

### Child Components Rendered

None — fully self-contained.

---

## 3. onboard/status/page.tsx — 1,101 lines

**Path:** `agent-app/src/app/onboard/status/page.tsx`

### Props

Top-level `StatusPage` is a Next.js page (no props). Inner `StatusContent` reads `useSearchParams`.

### useState Hooks in StatusContent (7)

| # | Name | Type | Initial |
|---|------|------|---------|
| 1 | loading | boolean | false |
| 2 | payError | string \| null | null |
| 3 | preview | IntakePreview \| null | null |
| 4 | availableNumbers | InventoryNumber[] | [] |
| 5 | selectedNumber | string \| null | null |
| 6 | twilioNumber | string \| null | null |
| 7 | polling | boolean | false |

### useState Hooks in AdminTestPanel (16)

| # | Name | Type | Initial |
|---|------|------|---------|
| 1 | isAdmin | boolean \| null | null |
| 2 | activating | boolean | false |
| 3 | result | AdminResult \| null | null |
| 4 | error | string \| null | null |
| 5 | cleaning | boolean | false |
| 6 | cleaned | boolean | false |
| 7 | editablePrompt | string | '' |
| 8 | promptDirty | boolean | false |
| 9 | testCallJoinUrl | string \| null | null |
| 10 | testCallLoading | boolean | false |
| 11 | saving | boolean | false |
| 12 | saveMessage | string \| null | null |
| 13 | promptExpanded | boolean | false |
| 14 | buyNumber | boolean | false |
| 15 | sendingEmail | boolean | false |
| 16 | emailMessage | string \| null | null |

### useState Hooks in ActivationProgress / ActivationProgressDark (2 each)

| Name | Type |
|------|------|
| visibleCount | number (0) |

### useEffect Hooks

| # | Component | Deps | What it does |
|---|-----------|------|-------------|
| 1 | ActivationProgress | [active, done] | Timer-based step reveal |
| 2 | ActivationProgress | [done] | Set all steps visible on done |
| 3 | ActivationProgressDark | [active, done] | Same as #1 |
| 4 | ActivationProgressDark | [done] | Same as #2 |
| 5 | AdminTestPanel | [] | Admin check (with ref guard) |
| 6 | TrialSuccessScreen | [] | Clear localStorage draft |
| 7 | StatusContent | [success, intakeId, fetchActivationStatus] | Clear draft + start polling |
| 8 | StatusContent | [intakeId, success, isTrial] | Fetch preview + available numbers |
| 9 | StatusContent | [polling, fetchActivationStatus] | Poll every 4s for Twilio number |

### useCallback Hooks (1)

| Name | Deps | Purpose |
|------|------|---------|
| fetchActivationStatus | [intakeId] | GET `/api/public/activation-status` |

### useRef Hooks (2)

| Name | Component | Type |
|------|-----------|------|
| timersRef | ActivationProgress | setTimeout[] |
| adminCheckRef | AdminTestPanel | boolean (double-mount guard) |

### Fetch Calls

| Function | Method | Endpoint |
|----------|--------|----------|
| AdminTestPanel.useEffect | GET | /api/admin/check |
| handleActivate | POST | /api/admin/test-activate |
| handleTestCall | POST | /api/admin/test-call |
| handleSavePrompt | POST | /api/admin/save-prompt |
| handleTestEmail | POST | /api/admin/test-email |
| handleCleanup | POST | /api/admin/cleanup-test |
| fetchActivationStatus | GET | /api/public/activation-status |
| StatusContent.useEffect | GET | /api/public/intake-preview |
| StatusContent.useEffect | GET | /api/public/available-numbers |
| handlePay | POST | /api/stripe/create-public-checkout |

### Inline Components (6)

| Name | Lines | Purpose |
|------|-------|---------|
| ActivationProgress | 17-71 | Light-themed step progress |
| ActivationProgressDark | 74-125 | Dark-themed step progress |
| AdminTestPanel | 147-488 | Full admin activation/test UI |
| AgentPreviewCard | 528-565 | Niche/agent preview card |
| TrialSuccessScreen | 569-670 | Trial activation success screen |
| StatusContent | 672-1091 | Main content with payment/success states |

### Constants (4)

| Name | Lines | Purpose |
|------|-------|---------|
| ACTIVATION_STEPS | 10-15 | 4 activation step strings |
| NICHE_LABELS | 491-504 | Niche → display label |
| DEFAULT_AGENT_NAMES | 506-511 | Niche → default agent name |
| (lazy import) LiveTestCall | 7 | Dynamic import |

### Interfaces (3)

| Name | Lines |
|------|-------|
| InventoryNumber | 127-133 |
| AdminResult | 135-145 |
| IntakePreview | 521-526 |

---

## 4. AgentOverviewCard.tsx — 927 lines

**Path:** `agent-app/src/components/dashboard/settings/AgentOverviewCard.tsx`

### Props

```ts
interface AgentOverviewCardProps {
  client: ClientConfig
  isAdmin: boolean
  isActive: boolean
  onToggleStatus: () => void
}
```

### useState Hooks (22)

| # | Name | Type | Initial |
|---|------|------|---------|
| 1 | agentName | string | client.agent_name |
| 2 | savedName | string | client.agent_name |
| 3 | footerSaving | boolean | false |
| 4 | footerSaved | boolean | false |
| 5 | voiceId | string | client.agent_voice_id |
| 6 | voices | UltravoxVoice[] | [] |
| 7 | voicesLoading | boolean | true |
| 8 | voicePickerOpen | boolean | false |
| 9 | voiceSearch | string | '' |
| 10 | voiceSaving | boolean | false |
| 11 | voiceSaved | boolean | false |
| 12 | playingVoiceId | string \| null | null |
| 13 | localSmsEnabled | boolean | client.sms_enabled |
| 14 | injectedNote | string | client.injected_note |
| 15 | injectLoading | boolean | false |
| 16 | injectSaved | boolean | false |
| 17 | contextData | string | client.context_data |
| 18 | contextDataLabel | string | client.context_data_label |
| 19 | contextDataSaving | boolean | false |
| 20 | contextDataSaved | boolean | false |
| 21 | csvUpload | Record<string, {...}> | {} |
| 22 | showCalendarModal | boolean | false |

### useEffect Hooks (3)

| # | Deps | What it does |
|---|------|-------------|
| 1 | [] | Fetch voice list from `/api/dashboard/voices` |
| 2 | [voicePickerOpen] | Outside click handler for voice picker |
| 3 | [] | Audio cleanup on unmount |

### useRef Hooks (3)

| Name | Type |
|------|------|
| audioRef | HTMLAudioElement \| null |
| voicePickerRef | HTMLDivElement |
| csvInputRef | HTMLInputElement |

### Fetch Calls

| Function | Method | Endpoint |
|----------|--------|----------|
| useEffect | GET | /api/dashboard/voices |
| assignVoice | POST | /api/dashboard/voices/assign |
| patch (helper) | PATCH | /api/dashboard/settings |

### Async Functions

| Name | Purpose |
|------|---------|
| assignVoice | Assign voice to agent |
| saveFooter | Save agent name |
| toggleSms | Toggle SMS enabled |
| handleInject | Save injected note |
| saveContextData | Save context data + label |

### Sync Functions

| Name | Purpose |
|------|---------|
| playVoice | Audio preview playback |
| handleCsvUpload | CSV file upload + parse |
| patch | Generic PATCH helper |

### Constants (2)

| Name | Lines | Purpose |
|------|-------|---------|
| PROVIDER_COLORS | 17-21 | Voice provider color themes |
| INJECT_PILLS | 32-36 | 3 quick inject options |

### Interfaces (2)

| Name | Lines |
|------|-------|
| UltravoxVoice | 23-30 |
| AgentOverviewCardProps | 38-43 |

### External Imports

| Import | From |
|--------|------|
| fmtPhone, timeAgo, getPlanName, parseCsvRaw, detectKeyColumns, columnsToMarkdownTable | `@/lib/settings-utils` |
| NICHE_CONFIG | `@/lib/niche-config` |
| BorderBeam | `@/components/ui/border-beam` |

---

## 5. LabView.tsx — 858 lines

**Path:** `agent-app/src/app/dashboard/lab/LabView.tsx`

### Props

```ts
interface LabViewProps {
  isAdmin: boolean
  clientId: string | null
  livePrompt: string | null
  agentName: string
  niche: string | null
  initialVersions: PromptVersion[]
}
```

### useState Hooks (18)

| # | Name | Type | Initial |
|---|------|------|---------|
| 1 | draftPrompt | string | '' |
| 2 | draftSaved | boolean | false |
| 3 | resultA | CallResult \| null | null |
| 4 | resultB | CallResult \| null | null |
| 5 | activeSlot | 'A' \| 'B' \| null | null |
| 6 | startingSlot | 'A' \| 'B' \| null | null |
| 7 | joinUrl | string \| null | null |
| 8 | callStartTime | number \| null | null |
| 9 | versions | PromptVersion[] | initialVersions |
| 10 | versionsOpen | boolean | false |
| 11 | restoring | string \| null | null |
| 12 | toastMsg | string \| null | null |
| 13 | makingLive | boolean | false |
| 14 | hintIdx | number | 0 |
| 15 | saveState | state enum | 'idle' |
| 16 | historyOpen | boolean | false |
| 17 | sessions | session[] | [] |
| 18 | historyLoading | boolean | false |

### useEffect Hooks (3)

| # | Deps | What it does |
|---|------|-------------|
| 1 | [STORAGE_KEY] | Load draft from localStorage |
| 2 | [draftPrompt, STORAGE_KEY] | Persist draft to localStorage |
| 3 | [activeSlot, hints.length] | Rotate hint text every 8s |

### useCallback Hooks (3)

| Name | Deps | Purpose |
|------|------|---------|
| loadHistory | [clientId] | GET `/api/dashboard/lab-transcripts` |
| startTest | [activeSlot, startingSlot, draftPrompt, isAdmin, clientId] | POST `/api/dashboard/browser-test-call` |
| handleCallEnd | [activeSlot, callStartTime] | POST `/api/dashboard/analyze-now` |

### Fetch Calls

| Function | Method | Endpoint |
|----------|--------|----------|
| loadHistory | GET | /api/dashboard/lab-transcripts |
| startTest | POST | /api/dashboard/browser-test-call |
| handleCallEnd | POST | /api/dashboard/analyze-now |
| makeDraftLive | PATCH | /api/dashboard/settings |
| makeDraftLive | GET | /api/dashboard/settings/prompt-versions |
| restoreVersion | POST | /api/dashboard/settings/prompt-versions |
| restoreVersion | GET | /api/dashboard/settings/prompt-versions |

### Inline Components (3)

| Name | Lines | Purpose |
|------|-------|---------|
| ClassBadge | 94-135 | HOT/WARM/COLD/JUNK classification badge |
| Spinner | 139-149 | Loading spinner |
| ResultTranscript | 840-858 | Transcript viewer |

### Constants (4)

| Name | Lines | Purpose |
|------|-------|---------|
| NICHE_HINTS | 10-41 | 6 niche scenario hint arrays |
| DEFAULT_HINTS | 43-47 | 3 generic hints |
| CHAR_WARN | 83 | 40000 |
| CHAR_MAX | 84 | 50000 |

### Interfaces (3)

| Name | Lines |
|------|-------|
| PromptVersion | 56-63 |
| CallResult | 65-70 |
| LabViewProps | 72-79 |

### Helper Functions (3)

| Name | Purpose |
|------|---------|
| charCountColor | Color by char count threshold |
| fmtDuration | Format seconds to Xm Xs |
| fmtDate | Format ISO date for display |
| getNicheHints | Get hints array for niche |
| showToast | Show toast message |

### Child Components Rendered

| Component | Source |
|-----------|--------|
| BrowserTestCall | `@/components/dashboard/BrowserTestCall` |
| ShimmerButton | `@/components/ui/shimmer-button` |

---

## Summary Table

| File | Lines | useState | useEffect | useCallback | useRef | fetch() calls | Inline components |
|------|-------|----------|-----------|-------------|--------|--------------|-------------------|
| SettingsView.tsx | 3,044 | ~83 | 4 | 2 | 1 | 20 endpoints | 3 |
| SetupView.tsx | 1,297 | 11 | 1 | 0 | 0 | 0 | 7 |
| onboard/status/page.tsx | 1,101 | 27 | 9 | 1 | 2 | 10 endpoints | 6 |
| AgentOverviewCard.tsx | 927 | 22 | 3 | 0 | 3 | 3 endpoints | 0 |
| LabView.tsx | 858 | 18 | 3 | 3 | 0 | 7 endpoints | 3 |
| **Total** | **7,227** | **~161** | **20** | **6** | **6** | **40** | **19** |
