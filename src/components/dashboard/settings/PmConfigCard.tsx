'use client'

/**
 * D422 — PmConfigCard
 *
 * PM-niche-only settings card. Editable fields map to niche_custom_variables keys
 * (the same keys prompt-slots.ts reads via clientRowToIntake / niche_* spreading).
 *
 * Save: PATCH niche_custom_variables (triggers slot_regen per settings-schema.ts).
 */

import { useState, useEffect } from 'react'
import { usePatchSettings } from './usePatchSettings'
import { useDirtyGuard } from './useDirtyGuard'
import type { ClientConfig } from '@/app/dashboard/settings/page'

interface PmConfigCardProps {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
  onPromptChange?: (prompt: string) => void
}

// Pull PM-specific fields from niche_custom_variables
function getPmField(client: ClientConfig, key: string): string {
  const ncv = client.niche_custom_variables ?? {}
  return (ncv[key] as string) ?? ''
}

export default function PmConfigCard({ client, isAdmin, previewMode, onPromptChange }: PmConfigCardProps) {
  const [petPolicy, setPetPolicy] = useState(() => getPmField(client, 'niche_petPolicy'))
  const [parking, setParking] = useState(() => getPmField(client, 'niche_parkingPolicy'))
  const [packageHandling, setPackageHandling] = useState(() => getPmField(client, 'niche_packagePolicy'))
  const [maintenanceContacts, setMaintenanceContacts] = useState(() => getPmField(client, 'niche_maintenanceContacts'))
  const [emergencyPhone, setEmergencyPhone] = useState(client.after_hours_emergency_phone ?? '')

  // Track saved state to detect dirty
  const [saved, setSaved] = useState({
    petPolicy: getPmField(client, 'niche_petPolicy'),
    parking: getPmField(client, 'niche_parkingPolicy'),
    packageHandling: getPmField(client, 'niche_packagePolicy'),
    maintenanceContacts: getPmField(client, 'niche_maintenanceContacts'),
    emergencyPhone: client.after_hours_emergency_phone ?? '',
  })

  const isDirty =
    petPolicy !== saved.petPolicy ||
    parking !== saved.parking ||
    packageHandling !== saved.packageHandling ||
    maintenanceContacts !== saved.maintenanceContacts ||
    emergencyPhone !== saved.emergencyPhone

  const { markDirty, markClean } = useDirtyGuard('pm-config-' + client.id)

  useEffect(() => {
    if (isDirty) markDirty()
    else markClean()
  }, [isDirty, markDirty, markClean])

  const { saving, saved: patchSaved, error, patch } = usePatchSettings(client.id, isAdmin, { onPromptChange })

  async function handleSave() {
    const currentNcv = client.niche_custom_variables ?? {}
    const nextNcv = {
      ...currentNcv,
      niche_petPolicy: petPolicy,
      niche_parkingPolicy: parking,
      niche_packagePolicy: packageHandling,
      niche_maintenanceContacts: maintenanceContacts,
    }
    const res = await patch({
      niche_custom_variables: nextNcv,
      after_hours_emergency_phone: emergencyPhone || null,
    })
    if (res?.ok) {
      setSaved({ petPolicy, parking, packageHandling, maintenanceContacts, emergencyPhone })
      markClean()
    }
  }

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">PM Configuration</p>
          <p className="text-[11px] t3 mt-0.5">Property-management specific settings used in every call</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || previewMode || !isDirty}
          className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all disabled:opacity-40 ${
            patchSaved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-blue-500 hover:bg-blue-400 text-white'
          }`}
        >
          {saving ? 'Saving...' : patchSaved ? '\u2713 Saved' : 'Save'}
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-red-400 mb-3">{error}</p>
      )}

      <div className="space-y-4">
        {/* Emergency phone */}
        <div>
          <label className="text-[10px] t3 uppercase tracking-wider block mb-1">Emergency forwarding phone</label>
          <input
            type="tel"
            value={emergencyPhone}
            onChange={e => setEmergencyPhone(e.target.value)}
            placeholder="e.g. +14035551234"
            className="w-full text-xs t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50"
          />
          <p className="text-[10px] t3 mt-1">Callers are given this number for after-hours emergencies</p>
        </div>

        {/* Maintenance contacts */}
        <div>
          <label className="text-[10px] t3 uppercase tracking-wider block mb-1">Maintenance contacts</label>
          <textarea
            rows={4}
            value={maintenanceContacts}
            onChange={e => setMaintenanceContacts(e.target.value)}
            placeholder={"Plumber: John Smith 403-555-1111\nElectrician: ABC Electric 403-555-2222\nGeneral: Mike 403-555-3333"}
            className="w-full text-xs t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50 resize-none"
          />
          <p className="text-[10px] t3 mt-1">One contact per line — agent matches issue type to the right person</p>
        </div>

        {/* Pet policy */}
        <div>
          <label className="text-[10px] t3 uppercase tracking-wider block mb-1">Pet policy</label>
          <textarea
            rows={3}
            value={petPolicy}
            onChange={e => setPetPolicy(e.target.value)}
            placeholder="e.g. Cats and small dogs allowed with $300 pet deposit. No aggressive breeds."
            className="w-full text-xs t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50 resize-none"
          />
        </div>

        {/* Parking policy */}
        <div>
          <label className="text-[10px] t3 uppercase tracking-wider block mb-1">Parking</label>
          <textarea
            rows={2}
            value={parking}
            onChange={e => setParking(e.target.value)}
            placeholder="e.g. One stall included per unit. Additional stalls $75/month."
            className="w-full text-xs t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50 resize-none"
          />
        </div>

        {/* Package handling */}
        <div>
          <label className="text-[10px] t3 uppercase tracking-wider block mb-1">Package handling</label>
          <textarea
            rows={2}
            value={packageHandling}
            onChange={e => setPackageHandling(e.target.value)}
            placeholder="e.g. Packages held in the mailroom for 7 days. Pick up during office hours."
            className="w-full text-xs t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50 resize-none"
          />
        </div>
      </div>
    </div>
  )
}
