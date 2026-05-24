# endvoicemail.ai Dashboard — Full UI Audit Report

Audit performed: May 24, 2026
Total routes: 30 pages/tabs across the dashboard

---

## 1. Dashboard Layout (`layout.tsx`)

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/app/dashboard/layout.tsx` |
| **Component** | `DashboardLayout` (async server component) |

**What it does**: Composes the entire dashboard shell:
- TopBar via `DashboardShellClient` (business name, admin status, failed notification count badge, user email, minute usage)
- `RouteLoadingBar` (fixed top edge progress bar)
- Desktop `TabBar` navigation
- `ForwardingBanner` (for active/non-trial clients with incomplete setup)
- `TrialUrgencyBanner` (last-3-day conversion gate, persistent)
- `Sidebar` (hidden via `aria-hidden="true"` — legacy, kept for safety)
- `ActivitySubNav` (self-gating, visible only on Activity routes)
- `ClientSwitcher` + `AdminCommandStrip` (admin-only)
- `PageTransition` wrapping `{children}` — motion spring animation
- `ActivityFeed` (XL+ right panel for admins)
- `BottomTabBar` (mobile)
- `FloatingCallOrb` (call PiP across all pages)
- `UpgradeModal`, `DashboardToaster`, `RealtimeToasts`, `RecordingConsentGate`

**State handling**:
- ✅ Auth redirect: unauthenticated → `/login`, no client_users row → `/onboard`
- ✅ Setup auto-redirect: `status='setup'` clients → `/dashboard/go-live`
- ✅ Suspense boundaries around `RouteLoadingBar`, `UpgradeModalProvider`, `CallProvider`, `AdminClientProvider`

**Patterns**:
- Uses CSS variables (`var(--color-text-1)`, `var(--color-bg)`, etc.) — theme-ready
- `PageTransition` uses `motion` spring animation for page changes
- `DashboardShellClient` is client component with `useEffect` for route change detection — updates loading bar

---

## 2. Orb Component: `VoicePoweredOrb`

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/components/ui/voice-powered-orb.tsx` |
| **Component** | `VoicePoweredOrb` (client) |

**What it does**: GPU-accelerated WebGL gradient orb with hue-shift and audio-reactive animation.

**Key patterns**:
- **WebGL GLSL fragment shader** with simplex noise, hue rotation, animated rotation
- **Three energy modes**: (1) `externalEnergy` prop (from Ultravox call energy), (2) device mic analysis via `AudioContext`/`AnalyserNode`, (3) idle (no animation energy)
- **`prefers-reduced-motion` honor**: disables WebGL entirely, renders static radial gradient fallback
- **Dynamic import of `ogl` library** — avoids SSR issues
- **Clean lifecycle**: requests `WEBGL_lose_context` on unmount, cancels RAF, stops mic
- **`maxRotationSpeed` / `maxHoverIntensity`** params for controllable intensity
- **Props**: `hue` (0-360), `externalEnergy` (0-1), `enableVoiceControl`, `voiceSensitivity`, `onVoiceDetected` callback

**What could apply across the app**:
- ✅ `prefers-reduced-motion` check — should be repeated on all animated components
- ✅ External energy → UI reactivity (live status updates)
- ✅ Clean WebGL lifecycle (lose context) — pattern for all GPU-accelerated components
- ✅ Smooth GPU-composited animation via shaders (60fps guarantee)

---

## 3. FloatingCallOrb

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/components/dashboard/FloatingCallOrb.tsx` |
| **Component** | `FloatingCallOrb` (client) |

**What it does**: Floating PiP overlay for active test calls. Shows when user navigates away from a test call page.

**Current UX**:
- Fixed bottom-right, `z-[9999]`, portaled to `document.body`
- `AnimatePresence` spring enter/exit animation (opacity, scale, y)
- Mini `VoicePoweredOrb` with `externalEnergy={energy}` from `CallContext`
- Pulsing ring around orb (2s infinite scale/opacity loop)
- Agent name, green pulse dot, countdown timer
- "Return to call" button (navigates to `meta.sourceRoute`)
- "End call" button (red, ends call)
- Toast notification on call end (only if PiP was visible during call)

**State handling**:
- ✅ Hides when `callState === 'idle'` or `'ended'`
- ✅ Tracks `wasShowingRef` to only toast on call end if user was seeing PiP
- ✅ SSR-safe with `typeof document === "undefined"` guard

**Patterns that could apply app-wide**:
- ✅ `AnimatePresence` with spring for portable UI entry/exit
- ✅ Portal-to-body for fixed overlays
- ✅ `wasShowingRef` pattern for conditional toast-on-exit
- ✅ Pulse ring indicator for live state

---

## 4. Page-by-Page Audit

### 4.1 Dashboard Home (`/dashboard`)

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/app/dashboard/page.tsx` |
| **Component** | `DashboardPage` (server) / `ClientHomeV2` (non-admin) |
| **Loading** | `/root/tmp/unmissed-ai/src/app/dashboard/loading.tsx` — ✅ Custom skeleton (header + 3-column pulse + action items) |
| **Error** | `/root/tmp/unmissed-ai/src/app/dashboard/error.tsx` — ✅ Custom error with try-again button, logged to console |

**What it does**:
- **Admin** (flag OFF): Legacy Command Center — `SystemPulse`, `MonthlySpendCard`, `TalkToZaraAdminButton`, `ActionItems`, `LiveCallBanner`, `ClientHealthBar`
- **Admin** (flag ON): Shows "Pick a client" page or scoped `ClientHomeV2`
- **Non-admin**: Renders `ClientHomeV2` (Overview dashboard with call stats, recent activity, quick actions)

**State gaps**:
- ⚠️ No keyboard shortcuts anywhere
- ⚠️ `ClientHomeV2` is a black-box component — unknown internal state handling
- ✅ Admin empty state when no client scoped (links to `/dashboard/admin`)

---

### 4.2 Calls (`/dashboard/calls`)

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/app/dashboard/calls/page.tsx` |
| **Component** | `CallsPage` (server) |
| **Loading** | `/root/tmp/unmissed-ai/src/app/dashboard/calls/loading.tsx` — ✅ Rich skeleton (test card + stats + 8 rows) |

**What it does**: Inbound call log with month-to-date filter. 2/3 CallsList + 1/3 ContactsView sidebar. Resolves stuck-in-processing calls (>5min). Admin supports `?client_id=` scoping.

**State**:
- ✅ Setup redirect for `status='setup'` clients
- ✅ Stuck-call resolution (server-side mutation for calls stuck in 'processing' >5min)
- ✅ `force-dynamic` for real-time data
- ⚠️ No empty-state component — relies on `CallsList` internal EMPTY handling
- ✅ 500-call limit to prevent over-fetching

**Mobile**: ✅ Uses `grid-cols-1 lg:grid-cols-3` responsive grid

---

### 4.3 Call Detail (`/dashboard/calls/[id]`)

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/app/dashboard/calls/[id]/page.tsx` |
| **Component** | `CallDetailPage` (server) → `CallDetail` (client) |

**What it does**: Single call view. Supports both `ultravox_call_id` and internal `call_logs.id` lookup. Shows recording, transcript, AI analysis.

**State**:
- ✅ `notFound()` for missing calls
- ✅ Dual ID lookup (ultravox_call_id fallback → call_logs.id)
- ✅ Live call state passed to `CallDetail`
- ⚠️ No loading.tsx for this route (relies on parent calls/loading.tsx? No — different segment)

---

### 4.4 Go Live (`/dashboard/go-live`)

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/app/dashboard/go-live/page.tsx` + `GoLiveView.tsx` |
| **Component** | `GoLivePage` (server) → `GoLiveView` (client) |
| **Loading** | None (inline) |

**What it does**: Onboarding/setup wizard for clients. Three blocks: Hero (Twilio number, tap-to-copy), Forwarding (`CallForwardingCard`), Alerts (email/Telegram indicator). Sticky `GoLiveBanner` at bottom. `ReadinessChecklist` with 5-step progress.

**State**:
- ✅ Live derivation: `forwardingReady && hasTestCall` (no `is_live` DB column)
- ✅ Live celebration view — checkmark grid, CTA buttons to `/dashboard/calls` and `/settings`
- ✅ Number not assigned state — links to billing
- ✅ Error state for missing client config (shows migration instructions)
- ✅ Copy-to-clipboard with vibration + timeout feedback
- ✅ Carrier stored in localStorage (survives refresh)
- ⚠️ No loading skeleton — brief flash on page load
- ✅ `min-h-screen` with `pb-[env(safe-area-inset-bottom)]` for mobile safe area
- ✅ `focus-visible:ring` on copy button (keyboard accessibility)

**Patterns from Orb that could apply**:
- ✅ The `GoLiveView` celebration grid uses a minimal checkmark style. Could use animated checkmarks like Orb's spring transitions.

---

### 4.5 Calls (Live) (`/dashboard/live`)

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/app/dashboard/live/page.tsx` |
| **Component** | `LivePage` (server) |

**What it does**: Shows currently live/processing calls. Animated ping dot in header. Empty state with icon + "No active calls" message + link to `/dashboard/calls`.

**State**:
- ✅ Empty state: SVG icon + descriptive text + navigation link
- ✅ Live count badge
- ✅ Admin support with `ScopedClientLabel`
- ⚠️ No loading skeleton
- ⚠️ No auto-refresh/polling for live state changes (server-rendered, no real-time updates)

---

### 4.6 Settings (`/dashboard/settings`)

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/app/dashboard/settings/page.tsx` + `SettingsView.tsx` |
| **Component** | `SettingsPage` (server) → `SettingsView` (client) |
| **Loading** | `/root/tmp/unmissed-ai/src/app/dashboard/settings/loading.tsx` — ✅ Tab bar + 4 card skeletons |

**What it does**: Full settings hub. Tabs: General (Agent), Voice, Notifications (Alerts + SMS), Billing, Knowledge. Non-admin sees inline overview with `CapabilitiesCard` + `TestCallCard` + Prompt Editor + NotificationsWidget.

**State**:
- ✅ Quick Setup strip (non-admin, non-trial) — progress bar, 4-item grid, hides when all done
- ✅ Tab bar with `motion.div` animated underline indicator (`layoutId="settings-tab-indicator"`)
- ✅ Tab content transitions via `AnimatePresence` (opacity + y spring)
- ✅ Client selector for admins with info strip (business name, status badge, niche badge, phone, slug)
- ✅ Preview mode banner (amber, all changes disabled)
- ✅ Legacy prompt banner (amber, shows when prompt lacks `<!-- unmissed:` markers)
- ✅ Reload success banner (green, auto-dismiss after 5s)
- ✅ Knowledge gap count badge fetch via API
- ✅ `usePatchSettings` hook — serializes concurrent writes
- ✅ 21 per-client Record-based state fields (prompts, hours, SMS, etc.)
- ⚠️ Massive component (699 lines + external tabs) — could benefit from code-splitting
- ✅ `PromptEditorModal` with full prompt editing

**Mobile**: ✅ `grid-cols-1 md:grid-cols-3` for overview layout

---

### 4.7 Agent (`/dashboard/agent`)

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/app/dashboard/agent/page.tsx` + `AgentPageView.tsx` |
| **Component** | `AgentPage` (server) → `AgentPageView` (client) |

**What it does**: Agent identity and behavior configuration. Features:
- `AgentIdentityHeader` (bot avatar with CSS keyframe animation — antenna blink, arm wave)
- Voice style presets (4 legacy + 4 new Wave B.6 presets)
- `VoicePicker` for voice selection
- `CapabilitiesCard` showing enabled features
- `Day1EditPanel` — voice tone, pricing policy, unknown answer behavior, calendar mode, fields_to_collect, business_notes
- `AgentAnswerabilityCard`
- `QuickInject` for injected notes
- `ActivityLog`
- `BusinessProfileCard` — editable fields (business_name, owner_name, callback_phone, city, website_url)
- `AgentNameField` — inline edit with save/saved/saving states
- Debounced regen (2s) to prevent 429 cascades
- Hand-tuned prompt conflict modal

**State**:
- ✅ Inline save patterns with saving/saved visual feedback (green checkmark, blue save)
- ✅ Chip groups with `aria-pressed` and disabled states
- ✅ Hand-tuned prompt confirmation dialog
- ✅ 409 (hand-tuned) and 429 (cooldown) error handling with toast
- ✅ Debounced regen timer with cleanup on unmount
- ✅ Admin client switcher with `AdminDropdown`
- ⚠️ No loading skeleton specific to this page
- ✅ Preview mode banner

**Patterns from Orb**:
- ✅ The bot CSS animations (antenna blink, arm wave) are similar to Orb's pulsing patterns
- ⚠️ No `prefers-reduced-motion` check on CSS animations

---

### 4.8 Knowledge (`/dashboard/knowledge`)

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/app/dashboard/knowledge/page.tsx` + `KnowledgePageView.tsx` |
| **Component** | `KnowledgePage` (server) → `KnowledgePageView` (client) |

**What it does**: Full knowledge management hub — the most feature-rich page in the dashboard. 4 tiers:

- **Tier 1**: `KnowledgeHealthScore` + `TestCallCard` (orb) + Quick Add grid (Upload, Scrape, AI Compile, Browse)
- **Tier 2**: Inline Facts editor + FAQ editor + Knowledge Gaps (unanswered questions with Bulk AI Answers)
- **Tier 3**: `KnowledgeProvenanceCard` + `KnowledgeSourceRegistry` + `PendingSuggestions` + `TopQueriesCard` ("What Callers Search For")
- **Tier 4**: "Ask Your Agent" interactive QA
- **Drawer**: Slide-over panel for Upload, Scrape, AI Compile, Chunk Browser, Context Preview, Bulk AI

**State**:
- ✅ Conflict detection banner (amber, clickable to modal)
- ✅ Conflict modal with "Dismiss all" and individual entries
- ✅ Loading spinner for Top Queries (animated spinner + "Loading..." text)
- ✅ Empty state for Top Queries ("No search data yet" with icon + description)
- ✅ `AbortController` for in-flight fetch cleanup on client switch
- ✅ Deep link support: `?quickAdd=upload|scrape|compile|chunks` opens drawer directly; `?source=xxx` filters chunk browser
- ✅ `uploadRefresh` counter to trigger document list refresh
- ✅ Bulk AI Answers placeholder drawer ("Coming soon")
- ✅ Test call integration with `CallContext` (Talk to Agent / End Call toggle)
- ✅ Export CSV button
- ✅ Context preview drawer
- ✅ Health score with multiple dimensions
- ⚠️ No `prefers-reduced-motion` check on drawer entrance animations

**Mobile**: ✅ 3-column responsive grid for tiers

**Patterns from Orb**:
- ✅ The `TestCallCard` already uses the Orb pattern with `externalEnergy`
- ✅ Drawer slide animation could mirror Orb's spring timing

---

### 4.9 Outbound (`/dashboard/outbound`)

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/app/dashboard/outbound/page.tsx` |
| **Component** | `OutboundPage` (client) |

**What it does**: Outbound calling template management. 3-tab view: Templates (CRUD), Composer (CallComposer modal), History (placeholder — "Coming next").

**State**:
- ✅ Empty state for no client selected (select-a-client prompt with Phone icon)
- ✅ Empty state for no templates (create-one prompt)
- ✅ Loading "Loading templates..." text
- ✅ Template cards with `motion.div` `layout` animation + staggered entry
- ✅ Built-in vs custom template badges
- ✅ Tone color-coded badges
- ✅ Create/Edit form in `AnimatePresence` bottom sheet modal with backdrop
- ✅ Form preview toggle (collapsible)
- ✅ Save button with disabled state when name/goal missing
- ✅ Delete action for non-built-in templates
- ✅ Set Default action
- ✅ History tab placeholder with "Coming next" message
- ✅ Sub-nav pill tabs styling
- ⚠️ No keyboard shortcuts for template search
- ⚠️ No `prefers-reduced-motion` on motion animations

---

### 4.10 Leads (`/dashboard/leads`)

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/app/dashboard/leads/page.tsx` |
| **Component** | `LeadsPage` (server) |

**What it does**: Lead management. Admin path shows all-clients `LeadQueue`. Owner path shows `OutboundAgentConfigCard` + `LeadQueue` + `LeadsView` (hot/warm inbound leads worth following up).

**State**:
- ✅ Admin all-clients view (no scope needed)
- ✅ Client-scoped view with outbound config card
- ✅ Conditional `LeadsView` — only renders when there are hot/warm leads
- ⚠️ No loading skeleton
- ⚠️ No empty state for no leads

---

### 4.11 Notifications (`/dashboard/notifications`)

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/app/dashboard/notifications/page.tsx` |
| **Component** | `NotificationsPage` (client) |
| **Loading** | `/root/tmp/unmissed-ai/src/app/dashboard/notifications/loading.tsx` — ✅ Header + 4 stats + 6 card skeletons |

**What it does**: Notification timeline with channel/status filters. Realtime via Supabase subscription. Stats row (Sent, Failed, Telegram, Email). Grouped by date with timeline UI.

**State**:
- ✅ Full loading state with spinner (centered, animated spinner + text)
- ✅ Empty state: `<NoNotifications />` component
- ✅ Filter empty state: "No notifications match this filter."
- ✅ Channel/status filter pills with active indicator styling
- ✅ Staggered card entrance animation (delay based on group + index)
- ✅ Timeline dot with color coding (green for sent, red for failed)
- ✅ Hover-reveal "View call" link (opacity transition)
- ✅ Error display for failed notifications
- ✅ "Load more" pagination
- ✅ Realtime subscription for instant refresh on new notifications
- ✅ Stats computed via `useMemo` for performance
- ⚠️ No `prefers-reduced-motion` check

**Mobile**: ✅ `grid-cols-2 sm:grid-cols-4` for stats

---

### 4.12 Calendar (`/dashboard/calendar`)

| Property | Value |
|---|---|
| **File** | `/root/tmp/unmissed-ai/src/app/dashboard/calendar/page.tsx` |
| **Component** | `CalendarPage` (client) |
| **Loading** | `/root/tmp/unmissed-ai/src/app/dashboard/calendar/loading.tsx` — ✅ Timeline card skeletons |

**What it does**: Booking calendar with mini calendar widget. Stats row (Upcoming, Today, Completed, Cancelled). Filter pills. Grouped timeline with time badges. Realtime subscription.

**State**:
- ✅ Loading state with `CalendarSkeleton` component
- ✅ Empty state: `<NoBookings />` component
- ✅ Filter empty state: "No bookings match this filter."
- ✅ Mini calendar with booking dots, month navigation, today highlight
- ✅ Staggered card entrance animation (group + index delay)
- ✅ Timeline dot color coding (cancelled red, today emerald, past zinc, upcoming indigo)
- ✅ Hover-reveal action buttons (Google Calendar link + View call link)
- ✅ "Load more" pagination
- ✅ Realtime subscription
- ✅ Client-side filter exclusion for "upcoming" (today excluded)
- ⚠️ No `prefers-reduced-motion` check

**Mobile**: ✅ `flex-col lg:flex-row` layout — mini calendar stacks above on mobile
✅ `grid-cols-2 sm:grid-cols-4` for stats

---

### 4.13 Other pages (thinner)

#### Bookings (`/dashboard/bookings`)
- **File**: `/root/tmp/unmissed-ai/src/app/dashboard/bookings/page.tsx`
- **Loading**: `/root/tmp/unmissed-ai/src/app/dashboard/bookings/loading.tsx` ✅ Stats strip + cards + past table row skeletons
- Server-rendered `BookingsView` — appointments booked by agent
- Simple empty state via `BookingsView` internal handling

#### Insights (`/dashboard/insights`)
- **File**: `/root/tmp/unmissed-ai/src/app/dashboard/insights/page.tsx`
- **Loading**: `/root/tmp/unmissed-ai/src/app/dashboard/insights/loading.tsx` ✅ Full skeleton with header, 4 stats, 2 chart areas, 2 bottom charts
- Renders `InsightsView` — analytics dashboard with charts
- Setup redirect for `status='setup'` clients

#### Billing (`/dashboard/billing`)
- **File**: `/root/tmp/unmissed-ai/src/app/dashboard/billing/page.tsx`
- Renders `BillingTab` with usage, plan, and payment details
- Empty state when no `client_id` for admin: "Select a client to view billing."
- ⚠️ No loading skeleton

#### Setup (`/dashboard/setup`)
- **File**: `/root/tmp/unmissed-ai/src/app/dashboard/setup/SetupView.tsx` (794 lines)
- Call forwarding setup wizard: 3 phone types (mobile, landline, VoIP), carrier selection, device selection, forwarding code dialing
- Trial locked preview (shows what-to-expect, upgrade CTA)
- Activation checklist with ping animation for pending items
- Activation hero state machine: `awaiting_number` → `forwarding_needed` → `ready`
- LocalStorage persistence for selections
- Tracking events on every major interaction
- ⚠️ No `prefers-reduced-motion` on ping animation

#### Analytics (`/dashboard/other` / `/dashboard/v2`)
- **`/dashboard/other`**: `OtherPage` — `StatsGrid` + `OutcomeCharts` + `OperatorActivity`. Server-rendered analytics.
- **`/dashboard/v2`**: Thin server page rendering `ClientHomeV2`.

#### Admin pages
- **`/dashboard/admin`**: Command Center (redirects to `/dashboard` if flag off). Same as legacy admin home.
- **`/dashboard/admin/learning-bank`**: `LearningBankClient` — admin knowledge management.
- **`/dashboard/admin/harness`**: Harness page (empty route).

#### Actions (`/dashboard/actions`)
- **File**: `/root/tmp/unmissed-ai/src/app/dashboard/actions/page.tsx` + `ActionsPageView.tsx`
- Behavior configuration: Booking, Transfer, Messaging, Hours, IVR, Voicemail Greeting, Service Catalog, Outbound Scheduling
- Behavior summary derived from client config

#### Support/maintenance pages
- **`/dashboard/campaigns`**: `CampaignsPage` — per-client call performance grid (admin only)
- **`/dashboard/costs`**: `CostsPage` — admin-only cost intelligence (redirects non-admin)
- **`/dashboard/clients`**: `ClientsPage` — client table with last login and drift data (admin only)
- **`/dashboard/demos`**: `DemosPage` — website demo call analytics (admin only)
- **`/dashboard/intake`**: `IntakePage` — admin intake pipeline
- **`/dashboard/maintenance`**: `MaintenanceTab` — niche-gated (property_management only)
- **`/dashboard/numbers`**: `NumbersView` — phone number inventory (admin only)
- **`/dashboard/lab`**: `LabView` — prompt version history and agent lab
- **`/dashboard/notifications`**: (see above — already detailed)
- **`/dashboard/welcome`**: `WelcomeWizard` + `ProvisioningWait` — post-activation flow
- **`/dashboard/voices`**: `VoicesPage` — voice library with preview, search, provider/gender filters, assign dropdown
- **`/dashboard/advisor`**: `AdvisorPage` — AI chat advisor with model picker, history sidebar, conversation limits

---

## 5. Summary: State Coverage Matrix

| Page | Loading Skeleton | Empty State | Error State | Mobile Resp. | Animations | Keyboard Shortcuts | prefers-reduced-motion |
|---|---|---|---|---|---|---|---|
| Dashboard (/) | ✅ | ✅ | ✅ (global) | ✅ | ✅ PageTransition | ❌ | ❌ |
| Calls | ✅ | ❌ (in child) | ✅ (stuck-call fix) | ✅ | ❌ | ❌ | ❌ |
| Call Detail ([id]) | ❌ | ✅ (notFound) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Go Live | ❌ | ✅ (no number) | ✅ (config error) | ✅ | ❌ | ✅ (focus-visible) | ❌ |
| Live | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Settings | ✅ | ✅ (no client) | ✅ (legacy banner) | ✅ | ✅ Tab indicator + page transition | ❌ | ❌ |
| Agent | ❌ | ❌ | ❌ | ✅ | ✅ CSS bot animations | ❌ | ❌ (no pref check on CSS anims) |
| Knowledge | ✅ (partial) | ✅ (top queries) | ✅ (conflict detection) | ✅ | ✅ Drawer slide | ❌ | ❌ |
| Outbound | ❌ (text only) | ✅ | ❌ | ✅ | ✅ Card layout + modal | ❌ | ❌ |
| Leads | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Notifications | ✅ | ✅ | ✅ (error per item) | ✅ | ✅ Staggered entry + filter transition | ❌ | ❌ |
| Calendar | ✅ | ✅ | ❌ | ✅ | ✅ Staggered entry | ❌ | ❌ |
| Bookings | ✅ | ❌ (in child) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Insights | ✅ | ❌ (in child) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Billing | ❌ | ✅ (no client) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Setup | ❌ | ✅ | ❌ | ✅ | ✅ Ping animation | ❌ | ❌ (no pref check on ping) |
| Voices | ✅ (shimmer cards) | ✅ (no voices) | ✅ (preview error) | ✅ | ❌ | ❌ | ❌ |
| Advisor | ❌ | ❌ | ❌ | ❌ (fixed layouts) | ❌ | ❌ | ❌ |

---

## 6. Reusable Patterns from the Orb

| Pattern | Current Usage | Where It Could Apply |
|---|---|---|
| **`prefers-reduced-motion`** | Orb only | Every animated component (CSS bot anims, ping dots, staggered entries, page transitions) |
| **External energy → UI reactivity** | Orb + FloatingCallOrb | Live call indicators, pulse animations on call-related pages |
| **Spring-based AnimatePresence** | PageTransition, Settings tabs, Notifications filter, Calendar filter | Every tab/page transition |
| **Portal to body** | FloatingCallOrb | Any fixed overlay (modals, toasts already use) |
| **WebGL/GPU compositing** | Orb only | Could extend to animated backgrounds on celebration states |
| **AudioContext real-time analysis** | Orb (mic mode) | Voice activity detection on call pages |
| **Clean lifecycle (RAF cancel, lose context, close AudioContext)** | Orb | Every component with resource-intensive animations |
| **`useRef` + `useEffect` cleanup pattern** | Orb, KnowledgePageView | Already consistent across app |

---

## 7. Key Issues Found

1. **No `prefers-reduced-motion` anywhere except Orb** — CSS keyframe animations (bot antenna ping, activation ping dots, pulse indicators) don't check reduced-motion media query
2. **No keyboard shortcuts on any page** — not even basic navigation shortcuts (Cmd+K for search, 1-9 for tab switching)
3. **Inconsistent loading skeletons** — 6 pages have full skeletons, 7 pages lack them entirely (Call Detail, Go Live, Agent, Leads, Billing, Setup)
4. **KnowledgePageView is the heaviest component** (909 lines) — could be split into sub-pages
5. **SetupView is also large** (794 lines) — tightly coupled state machine
6. **`ClientHomeV2` is a black box** — internal state handling unverified
7. **No toast/notification for API errors on several pages** — some pages silently swallow fetch errors
8. **Mobile: few pages use safe-area-inset-bottom** — only Go Live explicitly does
9. **Advisor page uses fixed `h-[calc(100vh-56px)]`** — may not adapt to mobile
10. **Realtime subscriptions** — Notifications and Calendar use Supabase realtime, but Calls, Live, Insights don't auto-refresh