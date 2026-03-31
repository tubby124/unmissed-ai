'use client'

import { useState } from 'react'
import { usePatchSettings } from './usePatchSettings'
import { useDirtyGuard } from './useDirtyGuard'
import type { StaffMember } from '@/lib/staff-roster'

const MAX_STAFF = 10

interface StaffRosterCardProps {
  clientId: string
  isAdmin: boolean
  bookingEnabled: boolean
  initialRoster: StaffMember[]
  previewMode?: boolean
}

function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-emerald-400 shrink-0">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-zinc-500 hover:text-red-400 transition-colors">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function StaffRosterCard({
  clientId,
  isAdmin,
  bookingEnabled,
  initialRoster,
  previewMode,
}: StaffRosterCardProps) {
  const [roster, setRoster] = useState<StaffMember[]>(initialRoster)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newAvailNote, setNewAvailNote] = useState('')

  const { saving, saved, error, patch } = usePatchSettings(clientId, isAdmin)
  const { markDirty, markClean } = useDirtyGuard('staff-roster-' + clientId)

  async function save(updatedRoster: StaffMember[]) {
    const res = await patch({ staff_roster: updatedRoster })
    if (res?.ok) markClean()
  }

  function addMember() {
    const name = newName.trim()
    const role = newRole.trim()
    if (!name || !role) return
    const member: StaffMember = {
      name,
      role,
      ...(newAvailNote.trim() ? { availability_note: newAvailNote.trim() } : {}),
    }
    const updated = [...roster, member]
    setRoster(updated)
    setNewName('')
    setNewRole('')
    setNewAvailNote('')
    setShowForm(false)
    markDirty()
    save(updated)
  }

  function removeMember(index: number) {
    const updated = roster.filter((_, i) => i !== index)
    setRoster(updated)
    markDirty()
    save(updated)
  }

  const atLimit = roster.length >= MAX_STAFF

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
      <div className="flex items-center gap-2 mb-1">
        <UsersIcon />
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-emerald-400/80">Team Members</p>
      </div>

      {!bookingEnabled ? (
        <p className="text-[11px] t3 mt-1">Enable booking to manage team members.</p>
      ) : (
        <>
          <p className="text-[11px] t3 mb-4">Let callers book with a specific team member.</p>

          {/* Roster list */}
          {roster.length === 0 ? (
            <p className="text-[11px] t3 mb-3">No team members yet — add your first team member.</p>
          ) : (
            <ul className="space-y-2 mb-3">
              {roster.map((member, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                  <div className="min-w-0">
                    <p className="text-xs font-medium t1 truncate">{member.name}</p>
                    <p className="text-[11px] t3 truncate">{member.role}{member.availability_note ? ` — ${member.availability_note}` : ''}</p>
                  </div>
                  {!previewMode && (
                    <button
                      onClick={() => removeMember(i)}
                      className="mt-0.5 shrink-0 p-1 rounded hover:bg-red-500/10 transition-colors"
                      aria-label={`Remove ${member.name}`}
                    >
                      <TrashIcon />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Add member form */}
          {showForm ? (
            <div className="space-y-2 mb-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Name (required)"
                className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-xs t1 focus:outline-none focus:border-emerald-500/40"
              />
              <input
                type="text"
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                placeholder="Role (required, e.g. Technician, Stylist)"
                className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-xs t1 focus:outline-none focus:border-emerald-500/40"
              />
              <input
                type="text"
                value={newAvailNote}
                onChange={e => setNewAvailNote(e.target.value)}
                placeholder="Availability note (optional, e.g. Mon–Fri only)"
                className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-xs t1 focus:outline-none focus:border-emerald-500/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={addMember}
                  disabled={!newName.trim() || !newRole.trim() || saving || previewMode}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Add'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setNewName(''); setNewRole(''); setNewAvailNote('') }}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-zinc-500/10 hover:bg-zinc-500/20 t2 border b-theme transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            !previewMode && (
              atLimit ? (
                <p className="text-[11px] t3 mb-2">Team roster full ({MAX_STAFF} members max).</p>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 transition-all"
                >
                  + Add member
                </button>
              )
            )
          )}

          {saved && <p className="text-[11px] text-emerald-400 mt-1">✓ Saved</p>}
          {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
        </>
      )}
    </div>
  )
}
