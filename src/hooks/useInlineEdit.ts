'use client'

/**
 * useInlineEdit — single-instance modal state for the v2 Overview surface.
 *
 * Mirrors useHomeSheet's discard-confirm semantics, but addresses centered
 * inline modals instead of right-edge drawers. Each chip / row on
 * `/dashboard/v2` opens at most one modal at a time. Switching modals or
 * closing while dirty prompts the user before discarding edits.
 *
 * The optional `payload` lets callers attach per-open context (e.g. the
 * specific call_logs row when opening the `call` detail modal). It is reset
 * to `null` on close.
 */

import { useState, useCallback } from 'react'

export type ModalId =
  | 'greeting'
  | 'aftercall'
  | 'telegram'
  | 'ivr'
  | 'voicemail'
  | 'booking'
  | 'transfer'
  | 'website'
  | 'gbp'
  | 'today'
  | 'calendar'
  | 'voice'
  | 'callback'
  | 'hours'
  | 'services'
  | 'faqs'
  | 'knowledge'
  | 'gaps'
  | 'call'
  | null

export interface InlineEditState<P = unknown> {
  openModalId: ModalId
  payload: P | null
  isDirty: boolean
  openModal: (id: Exclude<ModalId, null>, payload?: P) => void
  closeModal: () => void
  forceClose: () => void
  markDirty: () => void
  markClean: () => void
}

export function useInlineEdit<P = unknown>(): InlineEditState<P> {
  const [openModalId, setOpenModalId] = useState<ModalId>(null)
  const [payload, setPayload] = useState<P | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const openModal = useCallback((id: Exclude<ModalId, null>, next?: P) => {
    if (openModalId && isDirty) {
      const ok = window.confirm('You have unsaved changes. Discard and switch?')
      if (!ok) return
    }
    setIsDirty(false)
    setPayload(next ?? null)
    setOpenModalId(id)
  }, [openModalId, isDirty])

  const closeModal = useCallback(() => {
    if (isDirty) {
      const ok = window.confirm('You have unsaved changes. Discard them?')
      if (!ok) return
    }
    setIsDirty(false)
    setPayload(null)
    setOpenModalId(null)
  }, [isDirty])

  const forceClose = useCallback(() => {
    setIsDirty(false)
    setPayload(null)
    setOpenModalId(null)
  }, [])

  const markDirty = useCallback(() => setIsDirty(true), [])
  const markClean = useCallback(() => setIsDirty(false), [])

  return { openModalId, payload, isDirty, openModal, closeModal, forceClose, markDirty, markClean }
}
