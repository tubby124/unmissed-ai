'use client'
import { useEffect, useCallback, useRef } from 'react'

// Module-level set tracking all dirty card keys
const dirtyKeys = new Set<string>()

export function isAnyDirty(): boolean {
  return dirtyKeys.size > 0
}

export function useDirtyGuard(key: string) {
  const keyRef = useRef(key)
  keyRef.current = key

  const markDirty = useCallback(() => { dirtyKeys.add(keyRef.current) }, [])
  const markClean = useCallback(() => { dirtyKeys.delete(keyRef.current) }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { dirtyKeys.delete(keyRef.current) }
  }, [])

  return { markDirty, markClean }
}

// Call this ONCE in the parent component (AgentTab)
export function useDirtyGuardEffect() {
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyKeys.size > 0) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])
}
