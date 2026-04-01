'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface VipContact {
  id: string
  name: string | null
  phone: string
  vip_relationship: string | null
  vip_notes: string | null
  document_url: string | null
  transfer_enabled: boolean
  created_at: string
}

interface VIPContactsCardProps {
  clientId: string
  isAdmin: boolean
  forwardingNumber: string | null
}

export default function VIPContactsCard({ clientId, isAdmin: _isAdmin, forwardingNumber }: VIPContactsCardProps) {
  const [contacts, setContacts] = useState<VipContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addRelationship, setAddRelationship] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addTransfer, setAddTransfer] = useState(true)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/contacts?client_id=${clientId}`)
      if (!res.ok) throw new Error(`Failed to load (${res.status})`)
      const data = await res.json()
      // Filter to VIP contacts only
      setContacts((data.contacts ?? []).filter((c: { is_vip: boolean }) => c.is_vip))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  async function handleAdd() {
    setAddError(null)
    if (!addName.trim() || !addPhone.trim()) {
      setAddError('Name and phone are required')
      return
    }
    setAdding(true)
    try {
      const res = await fetch('/api/dashboard/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: addPhone.trim(),
          name: addName.trim(),
          is_vip: true,
          vip_relationship: addRelationship.trim() || null,
          vip_notes: addNotes.trim() || null,
          transfer_enabled: addTransfer,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setAddError(json.error || 'Failed to add contact'); return }
      setContacts(prev => [...prev, json])
      setAddName(''); setAddPhone(''); setAddRelationship(''); setAddNotes(''); setAddTransfer(true)
      setShowAddForm(false)
    } catch {
      setAddError('Network error — please try again')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this VIP contact?')) return
    // Remove VIP status (keep the contact record)
    const res = await fetch('/api/dashboard/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_vip: false, vip_relationship: null, vip_notes: null }),
    })
    if (res.ok) {
      setContacts(prev => prev.filter(c => c.id !== id))
    }
  }

  async function handleToggleTransfer(contact: VipContact) {
    const next = !contact.transfer_enabled
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, transfer_enabled: next } : c))
    const res = await fetch('/api/dashboard/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, transfer_enabled: next }),
    })
    if (!res.ok) {
      // Roll back on failure
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, transfer_enabled: contact.transfer_enabled } : c))
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <div className="rounded-2xl border b-theme bg-surface p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">VIP Contacts</p>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-3 py-1 text-[11px] font-medium rounded-lg bg-white/5 hover:bg-white/10 t2 border b-theme transition-colors"
            >
              + Add Contact
            </button>
          )}
        </div>

        <p className="text-[11px] t3">
          Family and key callers get greeted by name and offered a live transfer to you.
        </p>

        {/* Warning: no forwarding number */}
        {!forwardingNumber && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3">
            <p className="text-[11px] text-amber-400">
              ⚠️ No forwarding number set. VIP callers will be greeted by name but live transfer won&apos;t be possible. Set a forwarding number in the Transfer Settings card.
            </p>
          </div>
        )}

        {/* Error */}
        {error && <p className="text-[11px] text-red-400">{error}</p>}

        {/* Loading */}
        {loading && (
          <p className="text-[11px] t3 text-center py-2">Loading...</p>
        )}

        {/* Contact list */}
        {!loading && contacts.length === 0 && (
          <p className="text-[11px] t3 text-center py-2">No VIP contacts yet. Add family members or key clients.</p>
        )}

        <AnimatePresence initial={false}>
          {contacts.map(contact => (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="rounded-xl border b-theme p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-[13px] font-medium t1 truncate">{contact.name ?? 'Unknown'}</p>
                    <p className="text-[11px] t3 font-mono">{contact.phone}</p>
                    {contact.vip_relationship && (
                      <p className="text-[11px] t3">{contact.vip_relationship}</p>
                    )}
                    {contact.vip_notes && (
                      <p className="text-[11px] t3 italic">&ldquo;{contact.vip_notes}&rdquo;</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(contact.id)}
                    className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                    title="Remove VIP status"
                  >
                    ✕
                  </button>
                </div>

                {/* Transfer toggle */}
                <div
                  onClick={() => handleToggleTransfer(contact)}
                  className="flex items-center justify-between rounded-lg border b-theme px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <p className="text-[11px] t2">Offer live transfer on call</p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={contact.transfer_enabled}
                    onClick={e => { e.stopPropagation(); handleToggleTransfer(contact) }}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      contact.transfer_enabled ? 'bg-indigo-600' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                        contact.transfer_enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
                <p className="text-[11px] font-semibold t2">New VIP Contact</p>
                {addError && <p className="text-[11px] text-red-400">{addError}</p>}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium t3 uppercase tracking-wider">Name *</p>
                    <input
                      type="text"
                      value={addName}
                      onChange={e => setAddName(e.target.value)}
                      placeholder="Nisha"
                      className="w-full bg-black/20 border b-theme rounded-lg px-3 py-1.5 text-[12px] t1 focus:outline-none focus:border-blue-500/40 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium t3 uppercase tracking-wider">Phone *</p>
                    <input
                      type="tel"
                      value={addPhone}
                      onChange={e => setAddPhone(e.target.value)}
                      placeholder="(403) 605-6470"
                      className="w-full bg-black/20 border b-theme rounded-lg px-3 py-1.5 text-[12px] t1 font-mono focus:outline-none focus:border-blue-500/40 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-medium t3 uppercase tracking-wider">Relationship</p>
                  <input
                    type="text"
                    value={addRelationship}
                    onChange={e => setAddRelationship(e.target.value)}
                    placeholder="Wife, daughter, investor…"
                    className="w-full bg-black/20 border b-theme rounded-lg px-3 py-1.5 text-[12px] t1 focus:outline-none focus:border-blue-500/40 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-medium t3 uppercase tracking-wider">Notes for agent</p>
                  <input
                    type="text"
                    value={addNotes}
                    onChange={e => setAddNotes(e.target.value)}
                    placeholder="Greet warmly, she may be calling about the Kensington listing"
                    className="w-full bg-black/20 border b-theme rounded-lg px-3 py-1.5 text-[12px] t1 focus:outline-none focus:border-blue-500/40 transition-colors"
                  />
                </div>

                {/* Transfer toggle in add form */}
                <div
                  onClick={() => setAddTransfer(v => !v)}
                  className="flex items-center justify-between rounded-lg border b-theme px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <p className="text-[11px] t2">Offer live transfer on call</p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={addTransfer}
                    onClick={e => { e.stopPropagation(); setAddTransfer(v => !v) }}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      addTransfer ? 'bg-indigo-600' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                        addTransfer ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setShowAddForm(false); setAddError(null) }}
                    className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-white/5 hover:bg-white/10 t3 border b-theme transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={adding}
                    className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                  >
                    {adding ? 'Adding...' : 'Add VIP'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
