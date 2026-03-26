'use client'

/**
 * useHomeSheet.ts
 *
 * Single-instance sheet state for HomeSideSheet system.
 * One sheet open at a time. Dirty-state confirmation before close.
 */

import { useState, useCallback } from 'react'

export type SheetId =
  | 'identity'
  | 'knowledge'
  | 'hours'
  | 'forwarding'
  | 'notifications'
  | 'billing'
  | null

export function useHomeSheet() {
  const [openSheet, setOpenSheet] = useState<SheetId>(null)
  const [isDirty, setIsDirty] = useState(false)

  const open = useCallback((id: SheetId) => {
    if (openSheet && isDirty) {
      // Ask before discarding unsaved changes in the current sheet
      const confirmed = window.confirm('You have unsaved changes. Discard and switch?')
      if (!confirmed) return
    }
    setIsDirty(false)
    setOpenSheet(id)
  }, [openSheet, isDirty])

  const close = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Discard them?')
      if (!confirmed) return
    }
    setIsDirty(false)
    setOpenSheet(null)
  }, [isDirty])

  const forceClose = useCallback(() => {
    setIsDirty(false)
    setOpenSheet(null)
  }, [])

  const markDirty = useCallback(() => setIsDirty(true), [])
  const markClean = useCallback(() => setIsDirty(false), [])

  return {
    openSheet,
    isDirty,
    open,
    close,
    forceClose,
    markDirty,
    markClean,
  }
}
