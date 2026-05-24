'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useAdminClient } from '@/contexts/AdminClientContext'
import { Plus, Phone, Save, Trash2, Star, ChevronDown, ChevronUp, Eye, Sparkles } from 'lucide-react'

interface Template {
  id: string
  client_id: string
  name: string
  description: string | null
  tone: string
  goal: string
  opening: string | null
  vm_script: string | null
  call_notes: string | null
  special_instructions: string | null
  is_builtin: boolean
  is_default: boolean
}

type TabView = 'templates' | 'composer' | 'history'

const TONES: Record<string, { label: string; color: string }> = {
  warm: { label: 'Warm', color: '#22c55e' },
  professional: { label: 'Professional', color: '#3b82f6' },
  direct: { label: 'Direct', color: '#f59e0b' },
  flirty: { label: 'Flirty', color: '#ec4899' },
  busty: { label: 'Busty', color: '#a855f7' },
  custom: { label: 'Custom', color: '#64748b' },
}

export default function OutboundPage() {
  const supabase = createBrowserClient()
  const { selectedClient, previewMode } = useAdminClient()
  const clientId = previewMode && selectedClient ? selectedClient.id : null

  const [templates, setTemplates] = useState<Template[]>([])
  const [activeTab, setActiveTab] = useState<TabView>('templates')
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  // Create/edit form state
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formTone, setFormTone] = useState('warm')
  const [formGoal, setFormGoal] = useState('')
  const [formOpening, setFormOpening] = useState('')
  const [formVm, setFormVm] = useState('')

  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  async function loadTemplates() {
    if (!clientId) return
    setLoading(true)
    const res = await fetch(`/api/dashboard/outbound/templates?client_id=${clientId}`)
    if (res.ok) {
      const data = await res.json()
      setTemplates(data.templates ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (clientId) loadTemplates()
  }, [clientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function createTemplate() {
    if (!clientId || !formName || !formGoal) return
    setSaving(true)
    await fetch('/api/dashboard/outbound/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        name: formName,
        description: formDesc || null,
        tone: formTone,
        goal: formGoal,
        opening: formOpening || null,
        vm_script: formVm || null,
      }),
    })
    setSaving(false)
    setShowCreateForm(false)
    resetForm()
    loadTemplates()
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/dashboard/outbound/templates/${id}`, { method: 'DELETE' })
    loadTemplates()
  }

  async function setDefault(id: string) {
    await fetch(`/api/dashboard/outbound/templates/${id}/set-default`, { method: 'POST' })
    loadTemplates()
  }

  function resetForm() {
    setFormName('')
    setFormDesc('')
    setFormTone('warm')
    setFormGoal('')
    setFormOpening('')
    setFormVm('')
    setShowPreview(false)
  }

  function getAssembledPreview(): string {
    const toneDesc = TONES[formTone]?.label ?? 'Warm'
    return `You are {{AGENT_NAME}}, an outbound calling agent for {{BUSINESS_NAME}}.
Goal: ${formGoal}
Tone: ${toneDesc}

CALLER CONTEXT:
Name: {{LEAD_NAME}}
Phone: {{LEAD_PHONE}}

---
## LIVE CALL
Opening: "${formOpening || 'Hi, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}...'}"
[Agent waits for response, qualifies, advances, and closes with hangUp]

---
## VOICEMAIL
"${formVm || 'Hi {{LEAD_NAME}}, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}...'}"`
  }

  if (!clientId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-2xl p-8 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <Phone className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--color-text-3)' }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-1)' }}>Outbound Calling</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>Select a client to configure outbound calling templates.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-1)' }}>Outbound</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-3)' }}>
            Call leads with AI agent templates
          </p>
        </div>
        <button
          onClick={() => { setShowCreateForm(true); setEditing(null); resetForm() }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {([
          { key: 'templates' as TabView, label: 'Templates', icon: <Star className="h-3.5 w-3.5" /> },
          { key: 'composer' as TabView, label: 'Call Composer', icon: <Phone className="h-3.5 w-3.5" /> },
          { key: 'history' as TabView, label: 'History', icon: <Eye className="h-3.5 w-3.5" /> },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              backgroundColor: activeTab === tab.key ? 'var(--color-hover)' : 'transparent',
              color: activeTab === tab.key ? 'var(--color-text-1)' : 'var(--color-text-3)',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-3)' }}>Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>No templates yet. Create one to get started.</p>
            </div>
          ) : (
            templates.map(tpl => (
              <motion.div
                key={tpl.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-4"
                style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: `${TONES[tpl.tone]?.color ?? '#64748b'}20`, color: TONES[tpl.tone]?.color ?? '#64748b' }}
                    >
                      {tpl.name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>{tpl.name}</h3>
                        {tpl.is_default && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                            Default
                          </span>
                        )}
                        {tpl.is_builtin && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                            Built-in
                          </span>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>{tpl.description}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${TONES[tpl.tone]?.color ?? '#64748b'}20`, color: TONES[tpl.tone]?.color ?? '#64748b' }}
                  >
                    {TONES[tpl.tone]?.label ?? tpl.tone}
                  </span>
                </div>

                {/* Goal + preview */}
                <div className="space-y-2 mb-3">
                  <div className="text-xs" style={{ color: 'var(--color-text-2)' }}>
                    <span className="font-semibold">Goal:</span> {tpl.goal}
                  </div>
                  {tpl.opening && (
                    <div className="text-xs p-2 rounded-lg" style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-text-3)' }}>
                      <span className="font-mono">“{tpl.opening.slice(0, 100)}{tpl.opening.length > 100 ? '...' : ''}”</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button onClick={() => setDefault(tpl.id)} className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--color-text-2)', backgroundColor: 'var(--color-hover)' }}>
                    <Star className="h-3 w-3 inline mr-1" />Set Default
                  </button>
                  {!tpl.is_builtin && (
                    <button onClick={() => deleteTemplate(tpl.id)} className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' }}>
                      <Trash2 className="h-3 w-3 inline mr-1" />Delete
                    </button>
                  )}
                  <button onClick={() => setActiveTab('composer')} className="text-xs px-2.5 py-1.5 rounded-lg ml-auto transition-colors"
                    style={{ color: 'var(--color-cta)', backgroundColor: 'rgba(99,102,241,0.1)' }}>
                    <Phone className="h-3 w-3 inline mr-1" />Use Template
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowCreateForm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl p-5"
              style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            >
              <div className="max-w-lg mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-1)' }}>
                    {editing ? 'Edit Template' : 'New Template'}
                  </h2>
                  <button onClick={() => setShowCreateForm(false)} className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ color: 'var(--color-text-3)', backgroundColor: 'var(--color-hover)' }}>
                    Cancel
                  </button>
                </div>

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>Name</label>
                  <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Warm Follow-up"
                    className="w-full border rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }} />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>Description</label>
                  <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="What's this template for?"
                    className="w-full border rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }} />
                </div>

                {/* Tone selector */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>Tone</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(TONES).map(([key, val]) => (
                      <button key={key} onClick={() => setFormTone(key)}
                        className={`text-xs p-2 rounded-xl border transition-all ${formTone === key ? 'ring-2' : ''}`}
                        style={{
                          borderColor: formTone === key ? val.color : 'var(--color-border)',
                          backgroundColor: formTone === key ? `${val.color}15` : 'var(--color-surface)',
                          color: formTone === key ? val.color : 'var(--color-text-2)',
                        }}>
                        {val.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Goal */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>Goal</label>
                  <input value={formGoal} onChange={e => setFormGoal(e.target.value)} placeholder="e.g. Qualify lead and book appointment"
                    className="w-full border rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }} />
                </div>

                {/* Opening */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>Opening Line</label>
                  <textarea value={formOpening} onChange={e => setFormOpening(e.target.value)} rows={2} placeholder="Hi, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}..."
                    className="w-full border rounded-xl px-3 py-2 text-sm font-mono" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }} />
                </div>

                {/* Voicemail */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>Voicemail Script</label>
                  <textarea value={formVm} onChange={e => setFormVm(e.target.value)} rows={2} placeholder="Hi {{LEAD_NAME}}, this is {{AGENT_NAME}}..."
                    className="w-full border rounded-xl px-3 py-2 text-sm font-mono" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }} />
                </div>

                {/* Preview toggle */}
                <button onClick={() => setShowPreview(p => !p)}
                  className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
                  {showPreview ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Preview assembled prompt
                </button>
                {showPreview && (
                  <pre className="text-[11px] font-mono whitespace-pre-wrap p-3 rounded-xl" style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-text-2)' }}>
                    {getAssembledPreview()}
                  </pre>
                )}

                {/* Save */}
                <button onClick={createTemplate} disabled={saving || !formName || !formGoal}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary)' }}>
                  {saving ? 'Saving...' : <><Save className="h-4 w-4" /> Save Template</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Composer Tab - placeholder */}
      {activeTab === 'composer' && (
        <div className="rounded-2xl p-8 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <Phone className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--color-text-3)' }} />
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--color-text-1)' }}>Call Composer</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>
            Pick a template, add a contact, and fire the call. Coming next.
          </p>
        </div>
      )}

      {/* History Tab - placeholder */}
      {activeTab === 'history' && (
        <div className="rounded-2xl p-8 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <Eye className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--color-text-3)' }} />
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--color-text-1)' }}>Outbound Call History</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>
            View past outbound calls, recordings, and transcripts. Coming next.
          </p>
        </div>
      )}
    </div>
  )
}