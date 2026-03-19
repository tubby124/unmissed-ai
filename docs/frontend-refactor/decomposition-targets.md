# Frontend Decomposition Targets

Phase F0 — proposed decomposition plan for F1–F4.

---

## 1. SettingsView.tsx → Tab Components (Phase F1)

### Target: reduce 3,044 lines → ~200-300 line shell

### New Files

#### `components/dashboard/settings/constants.ts`
Extract from SettingsView:
- `TIMEZONES` (lines 30-42)
- `KNOWN_VOICES` (lines 47-52)
- `RELOAD_OPTIONS` (lines 54-58)
- Tab definitions array (lines 953-960)
- Types: `PromptVersion`, `ImproveState`, `VoiceTabVoice`, `LearningStatus`

#### `components/dashboard/settings/shared.tsx`
Extract from SettingsView:
- `CopyButton` (lines 67-91)
- `UrlRow` (lines 93-101)
- `ConfigRow` (lines 103-111)
- `fmtDate` (lines 62-65) — or move to `lib/settings-utils.ts`

#### `components/dashboard/settings/AgentTab.tsx`
Lines: ~1,005-1,947 + 2,078-2,510 (combined ~1,375 lines of JSX)

**State that MOVES IN (single-tab only):**
- prompt, saving, saved, saveError, changeDesc
- godConfig, godSaving, godSaved (admin-only god mode)
- regenState
- improveState, improveResult, improveError
- learning, learningState, learningDismissed
- versionsOpen, versions, versionsLoading, restoring, viewingVersion, showAllVersions
- syncing, syncState, syncError, saveUltravoxWarning
- injectedNote, injectedNoteSaving, injectedNoteSaved
- hoursWeekday, hoursWeekend, afterHoursBehavior, afterHoursPhone, hoursSaving, hoursSaved
- sectionContent, sectionSaving, sectionSaved, sectionError, sectionCollapsed
- businessFacts, extraQA, advancedSaving, advancedSaved
- contextData, contextDataLabel, promptPreviewOpen
- bookingSaving, bookingSaved, bookingDuration, bookingBuffer
- testPhone, testCallState, testCallResult, testCallError
- promptCollapsed, webhooksCollapsed
- forwardingNumber, transferConditions, setupComplete, setupCollapsed, setupSaving, setupSaved, setupEditing

**State that STAYS in parent (shared across tabs or shell):**
- selectedId, activeTab (shell navigation)
- status (used by shell for client switcher + by AgentOverviewCard)
- corpusEnabled (used by Knowledge tab)

**Functions that move in:**
- save, saveSection, toggleStatus, saveGodConfig
- generateImprovement, applyImprovedPrompt
- loadVersions, toggleVersions, restoreVersion
- syncAgent, saveAdvanced, saveHoursConfig
- saveInjectedNote, saveBookingConfig
- fireTestCall, saveSetup, handleMarkSetupComplete

**Props interface:**
```ts
interface AgentTabProps {
  client: ClientConfig
  clients: ClientConfig[] // for client switcher rendering inside tab
  isAdmin: boolean
  appUrl: string
  status: string
  onStatusChange: (newStatus: string) => void
}
```

#### `components/dashboard/settings/SmsTab.tsx`
Lines: ~1,948-2,075 (~127 lines)

**State that MOVES IN:**
- smsEnabled, smsTemplate, smsSaving, smsSaved
- testSmsPhone, testSmsState, testSmsError

**Functions that move in:**
- saveSms, fireTestSms

**Props interface:**
```ts
interface SmsTabProps {
  client: ClientConfig
  isAdmin: boolean
}
```

#### `components/dashboard/settings/VoiceTab.tsx`
Lines: ~2,513-2,639 (~126 lines)

**State that MOVES IN:**
- voices, voicesLoading, playingVoiceId, audioRef

**Functions that move in:**
- playVoice

**Props interface:**
```ts
interface VoiceTabProps {
  client: ClientConfig
  isAdmin: boolean
}
```

Note: Voice state currently lives in SettingsView shell (fetched on mount). Move the entire voice fetch + playback into VoiceTab since it's only used there (AgentOverviewCard has its own separate voice picker state).

#### `components/dashboard/settings/AlertsTab.tsx`
Lines: ~2,640-2,852 (~212 lines)

**State that MOVES IN:**
- telegramTest
- tgStyle, tgStyleSaving

**Functions that move in:**
- testTelegram, saveTelegramStyle

**Props interface:**
```ts
interface AlertsTabProps {
  client: ClientConfig
  isAdmin: boolean
}
```

#### `components/dashboard/settings/BillingTab.tsx`
Lines: ~2,855-3,008 (~153 lines)

**State that MOVES IN:**
- reloadMinutes, reloadLoading, reloadSuccess

**Props interface:**
```ts
interface BillingTabProps {
  client: ClientConfig
  isAdmin: boolean
}
```

#### Remaining Shell (SettingsView.tsx — target ~200-300 lines)

Keeps:
- `selectedId` + client switcher dropdown
- `activeTab` + tab bar rendering
- `status` (needed by AgentOverviewCard which renders inside AgentTab)
- AnimatePresence wrapper
- Imports and renders: AgentTab, SmsTab, VoiceTab, AlertsTab, BillingTab, KnowledgeBaseTab

---

## 2. SetupView.tsx → Sub-components (Phase F2)

### Target: reduce 1,297 lines → ~150 line shell

### New Files

#### `components/dashboard/setup/constants.ts`
Extract:
- CARRIERS, CARRIER_NOTES, FIDO_DISABLE
- LANDLINE_CARRIERS, LANDLINE_CODES, LANDLINE_NOTES
- VOIP_PLATFORMS, VOIP_INSTRUCTIONS
- LandlineCodes type
- lineTypeTabs config

#### `components/dashboard/setup/shared.tsx`
Extract:
- CopyButton (duplicated from SettingsView — consolidate to single source)
- CodeRow, SectionLabel, InlineNotes
- ActiveBadge, MarkActiveButton, ConfirmActivation
- StarCard
- stripToDigits, fmtPhone (or import from lib/settings-utils)

#### `components/dashboard/setup/MobileSetup.tsx`
The mobile carrier selection + star code cards section.

**Props:**
```ts
interface MobileSetupProps {
  rawNumber: string
  carrier: string
  onCarrierChange: (id: string) => void
  device: 'iphone' | 'android'
  onDeviceChange: (d: 'iphone' | 'android') => void
}
```

#### `components/dashboard/setup/LandlineSetup.tsx`
Landline carrier selection + star code display.

**Props:**
```ts
interface LandlineSetupProps {
  rawNumber: string
  landlineCarrier: string
  onCarrierChange: (id: string) => void
}
```

#### `components/dashboard/setup/VoipSetup.tsx`
VoIP platform selection + step-by-step instructions.

**Props:**
```ts
interface VoipSetupProps {
  rawNumber: string
  voipPlatform: string
  onPlatformChange: (id: string) => void
}
```

#### Remaining Shell (SetupView.tsx — target ~150 lines)

Keeps:
- selectedId + client switcher (admin)
- lineType tab bar
- step + checkedSteps state
- isActive state
- Renders MobileSetup / LandlineSetup / VoipSetup based on lineType
- localStorage effect

---

## 3. onboard/status/page.tsx → Sub-components (Phase F2)

### Target: reduce 1,101 lines → ~200 line shell

### New Files

#### `components/onboard/ActivationProgress.tsx`
Extract both light and dark variants:
- ActivationProgress (lines 17-71)
- ActivationProgressDark (lines 74-125)
- ACTIVATION_STEPS constant

#### `components/onboard/AdminTestPanel.tsx`
Extract the entire AdminTestPanel (lines 147-488).
Self-contained — has its own hooks, fetch calls, and UI.

**Props:**
```ts
interface AdminTestPanelProps {
  intakeId: string
}
```

#### `components/onboard/AgentPreviewCard.tsx`
Extract:
- AgentPreviewCard (lines 528-565)
- NICHE_LABELS, DEFAULT_AGENT_NAMES constants
- getSampleGreeting helper
- IntakePreview interface

#### `components/onboard/TrialSuccessScreen.tsx`
Extract TrialSuccessScreen (lines 569-670).

**Props:**
```ts
interface TrialSuccessScreenProps {
  clientId: string | null
  setupUrl: string | null
  telegramLink: string | null
}
```

#### `components/onboard/PaymentView.tsx`
Extract the payment state rendering (lines 924-1067).
This section handles intake preview, number picker, and Stripe checkout redirect.

**Props:**
```ts
interface PaymentViewProps {
  intakeId: string
}
```

Contains its own state: loading, payError, preview, availableNumbers, selectedNumber.

#### `components/onboard/SuccessView.tsx`
Extract the success screen (lines 777-921).
Contains confetti, phone number display, next steps.

**Props:**
```ts
interface SuccessViewProps {
  intakeId: string | null
  twilioNumber: string | null
  polling: boolean
}
```

#### Remaining Shell (page.tsx — target ~100-200 lines)

Keeps:
- useSearchParams routing logic
- Top-level state: loading, polling, twilioNumber
- fetchActivationStatus callback
- Polling effects
- Conditional rendering of TrialSuccessScreen / SuccessView / PaymentView / fallback
- Suspense wrapper

---

## 4. AgentOverviewCard.tsx → Sub-cards (Phase F3)

### Target: reduce 927 lines → ~200 line composition

### New Files

#### `components/dashboard/settings/VoicePicker.tsx`
Extract voice picker dropdown + preview player.

**State that MOVES IN:**
- voicePickerOpen, voiceSearch, voiceSaving, voiceSaved
- playingVoiceId, audioRef, voicePickerRef

**Props:**
```ts
interface VoicePickerProps {
  voiceId: string
  voices: UltravoxVoice[]
  voicesLoading: boolean
  isAdmin: boolean
  clientId: string
  onVoiceChange: (newVoiceId: string) => void
}
```

#### `components/dashboard/settings/QuickInject.tsx`
Extract injected note + quick inject pills.

**State that MOVES IN:**
- injectedNote, injectLoading, injectSaved

**Props:**
```ts
interface QuickInjectProps {
  client: ClientConfig
  isAdmin: boolean
}
```

#### `components/dashboard/settings/ContextDataCard.tsx`
Extract context data editor + CSV upload.

**State that MOVES IN:**
- contextData, contextDataLabel, contextDataSaving, contextDataSaved
- csvUpload, csvInputRef

**Props:**
```ts
interface ContextDataCardProps {
  client: ClientConfig
  isAdmin: boolean
}
```

#### `components/dashboard/settings/AgentIdentityHeader.tsx`
Extract the top identity row: bot icon, name editor, niche badge, status toggle.

**State that MOVES IN:**
- agentName, savedName, footerSaving, footerSaved

**Props:**
```ts
interface AgentIdentityHeaderProps {
  client: ClientConfig
  isAdmin: boolean
  isActive: boolean
  onToggleStatus: () => void
}
```

#### Remaining Shell (AgentOverviewCard.tsx — target ~200 lines)

Keeps:
- voices, voicesLoading (fetched on mount, passed to VoicePicker)
- localSmsEnabled (SMS chip toggle)
- showCalendarModal
- Derives minutesUsed, usagePct
- Composes: AgentIdentityHeader, VoicePicker, QuickInject, ContextDataCard
- Usage bar, SMS chip, calendar modal trigger

---

## 5. LabView.tsx → Panels (Phase F3)

### Target: reduce 858 lines → ~200 line shell

### New Files

#### `components/dashboard/lab/constants.ts`
Extract:
- NICHE_HINTS, DEFAULT_HINTS
- CHAR_WARN, CHAR_MAX
- getNicheHints helper
- charCountColor helper
- PromptVersion, CallResult, LabViewProps interfaces

#### `components/dashboard/lab/ClassBadge.tsx`
Extract ClassBadge inline component (lines 94-135).

#### `components/dashboard/lab/PromptEditor.tsx`
The draft prompt textarea + char count + save controls.

**State that MOVES IN:**
- draftPrompt, draftSaved, saveState

**Props:**
```ts
interface PromptEditorProps {
  livePrompt: string | null
  clientId: string | null
  onDraftChange: (draft: string) => void
  onMakeLive: () => void
}
```

#### `components/dashboard/lab/TestCallPanel.tsx`
The A/B test call trigger + BrowserTestCall embed + results.

**Props (all passed from shell):**
```ts
interface TestCallPanelProps {
  slot: 'A' | 'B'
  result: CallResult | null
  activeSlot: 'A' | 'B' | null
  startingSlot: 'A' | 'B' | null
  busy: boolean
  onStartTest: (slot: 'A' | 'B') => void
  joinUrl: string | null
  onCallEnd: (transcripts: TranscriptEntry[]) => void
  hints: string[]
  hintIdx: number
}
```

#### `components/dashboard/lab/VersionHistory.tsx`
Version sidebar + restore controls.

**State that MOVES IN:**
- versionsOpen, versions, restoring

**Props:**
```ts
interface VersionHistoryProps {
  versions: PromptVersion[]
  versionsOpen: boolean
  onToggle: () => void
  onRestore: (id: string, content: string) => void
  restoring: string | null
}
```

#### `components/dashboard/lab/SessionHistory.tsx`
Lab session transcript history.

**State that MOVES IN:**
- historyOpen, sessions, historyLoading

**Props:**
```ts
interface SessionHistoryProps {
  clientId: string | null
  open: boolean
  onToggle: () => void
}
```

#### Remaining Shell (LabView.tsx — target ~200 lines)

Keeps:
- activeSlot, startingSlot, joinUrl, callStartTime (call lifecycle)
- startTest, handleCallEnd callbacks
- makeDraftLive, restoreVersion
- toastMsg
- Empty state renders (no client, no prompt)
- Composes panels in A/B layout

---

## 6. Shared Primitives (Phase F4)

After F1-F3, audit for duplicated patterns:

### CopyButton
Used in: SettingsView, SetupView, onboard/status
Action: Consolidate to `components/ui/CopyButton.tsx` (single source)

### Loading/saving feedback pattern
`saving → saved → setTimeout clear` appears 15+ times.
Consider: `useSaveState()` custom hook if 3+ components benefit.

### fmtDate / fmtPhone / timeAgo
Already in `lib/settings-utils.ts` (fmtPhone, timeAgo) — move fmtDate there too.
LabView has its own fmtDate — consolidate.

### Import cleanup
- Remove barrel exports unless they reduce 3+ import lines
- Check for circular dependencies between new tab components

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| AgentTab gets most state | ~80% of SettingsView state is Agent-tab-only. Moving it reduces shell from 3,044 to ~200 lines. |
| Voice tab gets its own voice fetch | SettingsView voices are only used in Voice tab. AgentOverviewCard has separate voice state. No duplication. |
| AdminTestPanel stays self-contained | Already has its own hooks and API calls. Clean extraction boundary. |
| CopyButton consolidation deferred to F4 | SettingsView and SetupView versions differ slightly (styling). Consolidate after extraction. |
| No Context/Provider added | State passing via props is sufficient. Adding React Context would change the state management pattern (violates runbook rules). |
| Record<string, T> pattern preserved | Admin multi-client switching requires per-client state keying. Do not flatten to single-client. |
