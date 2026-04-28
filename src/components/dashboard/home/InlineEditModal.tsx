'use client'

/**
 * InlineEditModal — centered overlay primitive for the v2 Overview surface.
 *
 * Mirrors the `.modal` chrome at `dashboard-mockup.html:370-397`:
 *   - 480px wide (max 92vw), max-height 85vh, overflow-y auto
 *   - Backdrop blur + backdrop click closes (with dirty-state confirm via onRequestClose)
 *   - `<Esc>` closes (same dirty-state path)
 *   - Title + sub-label header, body slot for the form, footer auto-rendered
 *     by the modal content via a shared <ModalActions /> helper
 *
 * Save flow lives inside each content component — this primitive only owns
 * the chrome, focus management, and close affordances.
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  title: string
  subtitle?: string
  /** Called when the user requests close (Esc / backdrop / X). The hook decides whether to confirm-then-close. */
  onRequestClose: () => void
  children: React.ReactNode
}

export default function InlineEditModal({ open, title, subtitle, onRequestClose, children }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLElement | null>(null)

  // Esc closes
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onRequestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onRequestClose])

  // Focus the first focusable element on open
  useEffect(() => {
    if (!open || !dialogRef.current) return
    const focusable = dialogRef.current.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])',
    )
    if (focusable) {
      firstInputRef.current = focusable
      focusable.focus()
    }
  }, [open])

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onRequestClose() }}
      aria-hidden={false}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inline-edit-modal-title"
        className="rounded-2xl flex flex-col"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          width: '480px',
          maxWidth: '92vw',
          maxHeight: '85vh',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 pt-5 pb-3 shrink-0 flex items-start justify-between gap-3"
        >
          <div className="min-w-0">
            <h2 id="inline-edit-modal-title" className="text-[15px] font-semibold t1 leading-snug">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11px] t3 mt-1 leading-relaxed">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Close"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-hover transition-colors"
            style={{ color: 'var(--color-text-3)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * ModalActions — shared footer pattern (Cancel + Save changes).
 * Save button mirrors mockup `.btn-primary`, Cancel mirrors `.btn-secondary`.
 * Renders a "Synced X ago" trust line above the buttons when provided.
 */
export function ModalActions({
  onCancel,
  onSave,
  saving = false,
  saved = false,
  dirty = true,
  saveLabel = 'Save changes',
  syncedHint,
}: {
  onCancel: () => void
  onSave?: () => void
  saving?: boolean
  saved?: boolean
  dirty?: boolean
  saveLabel?: string
  syncedHint?: string | null
}) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-[10px] t3 leading-snug min-w-0">
        {syncedHint ?? 'Changes auto-sync to your live agent.'}
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-[12px] font-medium transition-colors cursor-pointer"
          style={{
            backgroundColor: 'var(--color-hover)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-2)',
          }}
        >
          Cancel
        </button>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white transition-opacity disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : saveLabel}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Field — small form-row helper to keep modal content tight + on-spec with mockup styling.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label
        className="block text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--color-text-3)' }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] t3 leading-snug">{hint}</p>
      )}
    </div>
  )
}
