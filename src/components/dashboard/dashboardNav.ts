export interface NavItem {
  href: string
  label: string
  adminLabel?: string
  adminOnly: boolean
  group: number
  iconName: string
  // trialLocked: item requires a live phone number — shown dimmed with lock icon for trial users
  trialLocked?: boolean
}

export const GROUP_LABELS: Record<number, string | null> = {
  1: null,       // client main — no label
  2: null,       // ops — no label (just a divider)
  3: 'MORE',     // secondary locked items
  4: 'ADMIN',    // admin-only tools
  5: null,       // bottom
}

export const NAV_ITEMS: NavItem[] = [
  // ── Group 1 — CLIENT MAIN ─────────────────────────────────────────────────
  { href: '/dashboard', label: 'Overview', adminLabel: 'Command Center', adminOnly: false, group: 1, iconName: 'command-center' },
  { href: '/dashboard/agent', label: 'Agent', adminOnly: false, group: 1, iconName: 'agent' },
  { href: '/dashboard/calls', label: 'Calls', adminOnly: false, group: 1, iconName: 'phone' },
  { href: '/dashboard/notifications', label: 'Notifications', adminOnly: false, group: 1, iconName: 'bell' },
  // ── Group 2 — OPS ─────────────────────────────────────────────────────────
  { href: '/dashboard/setup', label: 'Go Live', adminOnly: false, group: 2, iconName: 'wrench' },
  // ── Group 3 — SECONDARY (trialLocked) ────────────────────────────────────
  { href: '/dashboard/live', label: 'Live', adminOnly: false, group: 3, iconName: 'broadcast', trialLocked: true },
  { href: '/dashboard/leads', label: 'Leads', adminLabel: 'Outbound Queue', adminOnly: false, group: 3, iconName: 'list', trialLocked: true },
  { href: '/dashboard/calendar', label: 'Calendar', adminOnly: false, group: 3, iconName: 'calendar', trialLocked: true },
  // ── Group 4 — ADMIN ONLY ──────────────────────────────────────────────────
  { href: '/dashboard/clients', label: 'Clients', adminOnly: true, group: 4, iconName: 'users' },
  { href: '/dashboard/campaigns', label: 'Performance', adminOnly: true, group: 4, iconName: 'chart-columns' },
  { href: '/dashboard/demos', label: 'Demos', adminOnly: true, group: 4, iconName: 'activity' },
  { href: '/dashboard/intake', label: 'Intake', adminOnly: true, group: 4, iconName: 'inbox' },
  { href: '/dashboard/lab', label: 'Lab', adminOnly: true, group: 4, iconName: 'grid' },
  { href: '/dashboard/costs', label: 'Cost Intel', adminOnly: true, group: 4, iconName: 'dollar' },
  { href: '/dashboard/numbers', label: 'Numbers', adminOnly: true, group: 4, iconName: 'smartphone' },
  { href: '/dashboard/voices', label: 'Voices', adminOnly: true, group: 4, iconName: 'microphone' },
  { href: '/dashboard/insights', label: 'Insights', adminOnly: true, group: 4, iconName: 'bar-chart' },
  // ── Group 5 — BOTTOM ──────────────────────────────────────────────────────
  { href: '/dashboard/advisor', label: 'Advisor', adminOnly: false, group: 5, iconName: 'message-dots' },
]
