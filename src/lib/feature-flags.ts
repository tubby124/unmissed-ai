// Phase 0.5.4 — Feature flag for admin dashboard redesign.
// Plan: 2026-04-28-admin-dashboard-redesign-plan.md
//
// Default OFF. Flip ADMIN_REDESIGN_ENABLED=1 in Railway when Phase 1+ surfaces ship.
// Also exposed to the client via NEXT_PUBLIC_ADMIN_REDESIGN_ENABLED — server reads
// either; client must read NEXT_PUBLIC_ ... only.

function envFlag(value: string | undefined): boolean {
  if (!value) return false
  const v = value.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

export function isAdminRedesignEnabled(): boolean {
  return (
    envFlag(process.env.ADMIN_REDESIGN_ENABLED) ||
    envFlag(process.env.NEXT_PUBLIC_ADMIN_REDESIGN_ENABLED)
  )
}

// Client components must use this — bundlers replace NEXT_PUBLIC_* at build time.
export function isAdminRedesignEnabledClient(): boolean {
  return envFlag(process.env.NEXT_PUBLIC_ADMIN_REDESIGN_ENABLED)
}
