'use client'

import SyncStatusChip from './SyncStatusChip'
import {
  getFieldSyncStatus,
  type FieldSyncEntry,
} from './usePatchSettings'

interface FieldSyncStatusChipProps {
  clientId: string
  fieldKey: string
  currentValue: unknown
  onRetry?: (fieldKey: string, currentValue: unknown) => Promise<void> | void
}

export function shouldRenderFieldSyncChip(entry: FieldSyncEntry | null): entry is FieldSyncEntry {
  return !!entry && entry.status !== 'success'
}

export default function FieldSyncStatusChip({
  clientId,
  fieldKey,
  currentValue,
  onRetry,
}: FieldSyncStatusChipProps) {
  const entry = getFieldSyncStatus(clientId, fieldKey)
  if (!shouldRenderFieldSyncChip(entry)) return null

  return (
    <SyncStatusChip
      status={entry.status}
      reason={entry.reason as never}
      onRetry={onRetry ? () => onRetry(fieldKey, currentValue) : undefined}
    />
  )
}
