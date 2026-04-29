'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import AlertsTab from '@/components/dashboard/settings/AlertsTab'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { useClientScope } from '@/lib/admin-scope'
import { isAdminRedesignEnabledClient } from '@/lib/feature-flags'

// Minimal fields needed by AlertsTab
const SELECT = 'id, telegram_chat_id, telegram_bot_token, telegram_style, weekly_digest_enabled, contact_email, telegram_notifications_enabled, email_notifications_enabled'

/**
 * Renders the Alerts configuration (channel status, message style, notification
 * preferences, weekly digest toggle) at the top of the Notifications page.
 *
 * Phase 3 Wave B: when ADMIN_REDESIGN_ENABLED, admin's selected client (from the
 * top-bar switcher / `?client_id=`) drives which client this card edits. Falls
 * back to the legacy "first alphabetically" behavior when the flag is off.
 *
 * Fetches its own client config via browser client — matches the existing pattern
 * used by the realtime subscription already on this page. Extracted from
 * settings/AlertsTab.tsx (Settings > Alerts tab).
 */
export default function NotificationsConfigSection() {
  const [client, setClient] = useState<ClientConfig | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [tgStyle, setTgStyle] = useState('standard')

  // Phase 3 Wave B: admin scope from URL/switcher. No-op when flag is off.
  const { scopedClientId } = useClientScope()
  const flagOn = isAdminRedesignEnabledClient()
  const scopeOverride = flagOn && scopedClientId !== 'all' ? scopedClientId : null

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return

      const { data: cu } = await supabase
        .from('client_users')
        .select('client_id, role')
        .eq('user_id', user.id)
        .order('role')
        .limit(1)
        .maybeSingle()

      if (!cu) return

      const admin = cu.role === 'admin'
      setIsAdmin(admin)

      // Non-admin: assigned client. Admin + flag + scope: scoped client.
      // Admin + no scope (or flag off): first client alphabetically (legacy).
      let query = supabase.from('clients').select(SELECT)
      if (!admin) {
        query = query.eq('id', cu.client_id)
      } else if (scopeOverride) {
        query = query.eq('id', scopeOverride)
      } else {
        query = query.order('business_name').limit(1)
      }

      const { data } = await query.maybeSingle()
      if (data) {
        setClient(data as ClientConfig)
        setTgStyle((data as ClientConfig).telegram_style ?? 'standard')
      } else {
        // Scope target may have been deleted; clear card so AlertsTab doesn't keep stale state.
        setClient(null)
      }
    })
  }, [scopeOverride])

  if (!client) return null

  return (
    <div className="mb-10">
      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-3" style={{ color: 'var(--color-text-3)' }}>
        Configure Alerts
      </p>
      <AlertsTab
        client={client}
        isAdmin={isAdmin}
        tgStyle={tgStyle}
        setTgStyle={setTgStyle}
      />
    </div>
  )
}
